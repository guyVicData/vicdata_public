// VicData 0.8 feedback deploy gate: writes src/generated/build-info.json before `next build` (package.json's
// "build"), so the running app knows which commits it holds: its own commit, when it was built, and its
// history (`git rev-list --max-count=1000 HEAD`, 12-character shas, newest first).
//
// Render's checkout may be shallow. In order:
//   1. git, deepened first if the clone is shallow (`git fetch --deepen`, over the public HTTPS remote);
//   2. if git can't list enough (no .git, no network for the deepen), GitHub's public commits API for the
//      build's commit (the repo is public; no token);
//   3. otherwise `commits: null` -- the build says it has no list, rather than pretend.
// It never fails the build. Each step it takes is printed, so Render's build log says which one was used.
//
//   node scripts/write-build-info.mjs            (writes the file)
//   node scripts/write-build-info.mjs --print    (prints it instead; for checking)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX = 1000;
const REPO = "guyVicData/vicdata_public";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src", "generated", "build-info.json");
const log = (m) => console.log(`[build-info] ${m}`);

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60_000 }).trim();
const short = (s) => s.slice(0, 12).toLowerCase();

function fromGit() {
  let head;
  try {
    head = git("rev-parse", "HEAD");
  } catch {
    log("no git checkout here");
    return null;
  }
  const count = () => Number(git("rev-list", "--count", "HEAD"));
  let shallow = false;
  try {
    shallow = git("rev-parse", "--is-shallow-repository") === "true";
  } catch {
    // An old git without the flag: judge by the count below.
  }
  log(`git HEAD ${short(head)}; ${shallow ? "shallow" : "full"} clone, ${count()} commit(s) reachable`);
  if (shallow && count() < MAX) {
    try {
      git("fetch", "--quiet", `--deepen=${MAX}`, `https://github.com/${REPO}.git`, head);
      log(`deepened: ${count()} commit(s) reachable`);
    } catch (e) {
      log(`couldn't deepen the clone (${e.message.split("\n")[0]})`);
    }
  }
  const list = git("rev-list", `--max-count=${MAX}`, "HEAD").split("\n").filter(Boolean).map(short);
  let stillShallow = false;
  try {
    stillShallow = git("rev-parse", "--is-shallow-repository") === "true";
  } catch {
    // As above.
  }
  // A shallow history short of MAX is incomplete: its oldest commits would read as "not in the build".
  if (stillShallow && list.length < MAX) {
    log(`still shallow at ${list.length} commit(s): not trusted as the history`);
    return { commit: short(head), commits: null };
  }
  return { commit: short(head), commits: list, source: "git" };
}

async function fromGitHub(commit) {
  const list = [];
  try {
    for (let page = 1; list.length < MAX && page <= MAX / 100; page++) {
      const res = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${commit}&per_page=100&page=${page}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "vicdata-build-info" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("not a list");
      list.push(...rows.map((r) => short(String(r.sha))));
      if (rows.length < 100) break;
    }
  } catch (e) {
    log(`GitHub's commits API failed (${e.message})`);
    return null;
  }
  if (!list.length || !list[0].startsWith(short(commit).slice(0, 7))) {
    log("GitHub's list doesn't start at the build's commit");
    return null;
  }
  return list.slice(0, MAX);
}

const envCommit = (process.env.RENDER_GIT_COMMIT ?? "").trim();
let info = fromGit();
const commit = info?.commit ?? (envCommit ? short(envCommit) : null);
if (info?.commits == null && commit) {
  const list = await fromGitHub(envCommit || commit);
  if (list) info = { commit, commits: list, source: "github" };
}
const result = {
  commit,
  built_at: new Date().toISOString(),
  commits: info?.commits ?? null,
  source: info?.commits ? info.source : null,
};
log(result.commits ? `${result.commits.length} commit(s) listed from ${result.source}, newest ${result.commit}` : `no commit list (commits: null); commit ${result.commit ?? "unknown"}`);

if (process.argv.includes("--print")) {
  console.log(JSON.stringify({ ...result, commits: result.commits ? `${result.commits.length} commits` : null }, null, 2));
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result) + "\n");
  log(`wrote ${out.slice(root.length + 1)}`);
}
