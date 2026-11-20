// VicData 0.8 feedback deploy gate: writes src/generated/build-info.json before `next build` (package.json's
// "build"), so the running app knows which commits it holds: its own commit, when it was built, and its
// history (`git rev-list --max-count=1000 HEAD`, 12-character shas, newest first).
//
// Render's checkout may be shallow. In order:
//   1. git, deepened first if the clone is shallow (`git fetch --deepen`, over the public HTTPS remote);
//   2. if git can't list enough (no .git, no network for the deepen), GitHub's public commits API for the
//      build's commit (the repo is public; no token);
//   3. otherwise `commits: null` -- the build says it has no list, rather than pretend.
// It never fails the build: every step has a short timeout (git fetch 20 s; GitHub 8 s a page, 20 s in all),
// and any error anywhere -- a step, the write itself -- ends in `commits: null` and exit 0. Each step it takes
// is printed, so Render's build log says which one was used. (Render's failed auto-deploy of 6bddb6d on
// 30 Oct predates this step; see docs/v0.8/feedback_deploy_gate_report_v1.md.)
//
// Speed plan §4.2 item 2 (the shared results cache): `server_code`, a hash of the server's own code -- every
// file the API routes import, followed import by import from src/app/api (whatever folder it lives in:
// src/lib, src/catalogue, the few src/components helpers the server uses), plus package-lock.json. A
// deploy that changes none of them (a page's design) keeps the cached answers; any that does discards
// them. It reads files, not git, so a shallow clone gives the same answer. If the walk fails, the build's
// commit stands in (it changes every deploy, which only discards more); with neither, null (the results
// cache stays off).
//
// For the tests only: BUILD_INFO_GIT_REMOTE and BUILD_INFO_GITHUB_API point the two network calls elsewhere.
//
//   node scripts/write-build-info.mjs            (writes the file)
//   node scripts/write-build-info.mjs --print    (prints it instead; for checking)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX = 1000;
const REPO = "guyVicData/vicdata_public";
const GIT_REMOTE = process.env.BUILD_INFO_GIT_REMOTE || `https://github.com/${REPO}.git`;
const GITHUB_API = (process.env.BUILD_INFO_GITHUB_API || "https://api.github.com").replace(/\/+$/, "");
const GITHUB_DEADLINE_MS = 20_000;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "src", "generated", "build-info.json");
const log = (m) => console.log(`[build-info] ${m}`);

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
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
      git("fetch", "--quiet", `--deepen=${MAX}`, GIT_REMOTE, head);
      log(`deepened: ${count()} commit(s) reachable`);
    } catch (e) {
      log(`couldn't deepen the clone (${e.message.split("\n")[0]})`);
    }
  }
  let list;
  try {
    list = git("rev-list", `--max-count=${MAX}`, "HEAD").split("\n").filter(Boolean).map(short);
  } catch (e) {
    log(`git rev-list failed (${e.message.split("\n")[0]})`);
    return { commit: short(head), commits: null };
  }
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
  const deadline = Date.now() + GITHUB_DEADLINE_MS;
  try {
    for (let page = 1; list.length < MAX && page <= MAX / 100; page++) {
      const left = deadline - Date.now();
      if (left <= 0) throw new Error("out of time");
      const res = await fetch(`${GITHUB_API}/repos/${REPO}/commits?sha=${commit}&per_page=100&page=${page}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "vicdata-build-info" },
        signal: AbortSignal.timeout(Math.min(8_000, left)),
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

// ---- server_code -------------------------------------------------------------------------------
const CODE_EXT = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];
const IMPORT_RE = /(?:^|[^\w$.])(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // a package: package-lock.json covers it
  const tries = [base, ...CODE_EXT.map((e) => base + e), ...CODE_EXT.map((e) => join(base, "index" + e))];
  for (const t of tries) if (existsSync(t) && statSync(t).isFile()) return t;
  return null;
}

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p));
    else if (CODE_EXT.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

/** sha256 (16 hex) over every file the API routes import, and the lockfile; null if it can't be read. */
function serverCodeHash() {
  const api = join(root, "src", "app", "api");
  if (!existsSync(api)) return null;
  const seen = new Set();
  const stack = filesUnder(api).filter((f) => !/\.test\.[a-z]+$/.test(f));
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (f.endsWith(".json")) continue;
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const r = resolveImport(m[1] ?? m[2] ?? m[3], f);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  const h = createHash("sha256");
  for (const f of [...seen].sort()) h.update(relative(root, f)).update("\0").update(readFileSync(f)).update("\0");
  const lock = join(root, "package-lock.json");
  if (existsSync(lock)) h.update("package-lock.json\0").update(readFileSync(lock));
  log(`server_code over ${seen.size} file(s) imported from src/app/api`);
  return h.digest("hex").slice(0, 16);
}

function serverCode(commit) {
  try {
    const h = serverCodeHash();
    if (h) return h;
    log("server_code: no src/app/api here");
  } catch (e) {
    log(`server_code: the import walk failed (${e.message.split("\n")[0]})`);
  }
  return commit ? `commit:${commit}` : null;
}

async function main() {
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
    server_code: serverCode(commit),
  };
  log(result.commits ? `${result.commits.length} commit(s) listed from ${result.source}, newest ${result.commit}` : `no commit list (commits: null); commit ${result.commit ?? "unknown"}`);

  if (process.argv.includes("--print")) {
    console.log(JSON.stringify({ ...result, commits: result.commits ? `${result.commits.length} commits` : null }, null, 2));
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result) + "\n");
    log(`wrote ${out.slice(root.length + 1)}`);
  }
}

// Never fail the build: on any error, say so, write `commits: null` if the file can still be written, and exit 0.
main().catch((e) => {
  log(`failed (${e && e.message ? e.message.split("\n")[0] : e}); writing commits: null`);
  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ commit: null, built_at: new Date().toISOString(), commits: null, source: null, server_code: null }) + "\n");
  } catch {
    // The app reads a missing file as "no list" too.
  }
}).finally(() => process.exit(0));
