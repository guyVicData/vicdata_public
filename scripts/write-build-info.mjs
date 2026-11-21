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
// Every form the server code uses: `import x from`, `import { a } from` (over several lines too), `import type`,
// `import * as`, `export { a } from`, `export * from`, a bare `import "x"`, `import("x")` and `require("x")`.
// Type-only imports are followed too (they change nothing at run time, so following them only adds files). It
// reads the text, comments included: an import in a comment is followed as well (more, never fewer).
const IMPORT_RE = /(?:^|[^\w$.])(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\)/g;

function resolveImport(spec, fromFile, rootDir = root) {
  let base;
  if (spec.startsWith("@/")) base = join(rootDir, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null; // a package: package-lock.json covers it
  const tries = [base, ...CODE_EXT.map((e) => base + e), ...CODE_EXT.map((e) => join(base, "index" + e))];
  for (const t of tries) if (existsSync(t) && statSync(t).isFile()) return t;
  return undefined; // a path that names no file
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

const isTest = (f) => /\.test\.[a-z]+$/.test(f);

/** The files `f` imports (resolved, absolute); `strict`: a relative or @/ import that names no file throws. */
function importsOf(f, rootDir, strict) {
  if (f.endsWith(".json")) return [];
  const deps = [];
  for (const m of readFileSync(f, "utf8").matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    const r = resolveImport(spec, f, rootDir);
    if (r) deps.push(r);
    else if (r === undefined && strict) throw new Error(`${relative(rootDir, f)} imports "${spec}", which names no file`);
  }
  return deps;
}

/** Every file reachable by import from `entries` (the entries included). */
export function importClosure(entries, rootDir = root, strict = false) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const r of importsOf(f, rootDir, strict)) if (!seen.has(r)) stack.push(r);
  }
  return seen;
}

/** sha256 (16 hex) over every file the API routes import, and the lockfile; null if it can't be read. */
function serverCodeHash() {
  const api = join(root, "src", "app", "api");
  if (!existsSync(api)) return null;
  const seen = importClosure(filesUnder(api).filter((f) => !isTest(f)));
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

// ---- view_code: one code version per stored view -----------------------------------------------
// The results cache keys each answer on its view's own code (src/lib/results-cache.ts), so a deploy discards
// only the answers whose code changed. The views are listed in src/lib/cached-views/views.json, each with its
// own module there (the one place that view's resultKey and cachedResult are called). A view's files:
//   1. everything its module imports, followed import by import;
//   2. every file that imports the module, and those that import them, up to the routes (the code that
//      resolves the view's inputs: a route's caller check, the set, the school, the catchment), with
//      everything each of them imports -- so another view whose answer feeds this one (SMT's school, which
//      the SMT views take but key on its URN alone) is in it;
//   3. ALWAYS (below): the cache itself, how answers are keyed and serialised, the in-process caches, the
//      build's own settings, this script and the list; and package-lock.json.
// Over-including only discards more. Tests are left out (they never run in the app). The version is
// sha256 (16 hex) over "view-code v1", the view's name and each file's path and text, in order; never equal
// to a server_code, so a row stored under the single version can't match.
//
// The list is checked first, and a mistake fails the build (not a request): every resultKey under src is
// called with a string literal, in the module views.json names for that view; every module named exists and
// calls resultKey with its view; cachedResult is called only in those modules. If the walk itself fails (a
// file unreadable, an import that names no file), view_code is null and every view uses server_code (more
// discarded, never less).
export const VIEWS_DIR = "src/lib/cached-views";
export const ALWAYS = [
  "src/lib/results-cache.ts",
  "src/lib/build-trace.ts",
  "src/lib/server-cache.ts",
  "src/lib/reference-cache.ts",
  "src/lib/build-info.ts",
  "src/lib/supabase.ts",
  "src/lib/cached-views/views.json",
  "scripts/write-build-info.mjs",
  "tsconfig.json",
  "next.config.ts",
  "package.json",
];
const VIEW_SALT = "view-code v1";

export class ViewListError extends Error {}

/** The views (name -> module, absolute), checked against every resultKey and cachedResult call under src. */
export function checkedViews(rootDir = root) {
  const file = join(rootDir, VIEWS_DIR, "views.json");
  const list = JSON.parse(readFileSync(file, "utf8"));
  const views = {};
  const problems = [];
  for (const [view, mod] of Object.entries(list)) {
    if (typeof mod !== "string" || !/^[a-z0-9-]+\.ts$/.test(mod)) {
      problems.push(`views.json: "${view}" names no module file`);
      continue;
    }
    const p = join(rootDir, VIEWS_DIR, mod);
    if (!existsSync(p)) problems.push(`views.json: "${view}" -> ${mod}, which isn't there`);
    else if (!readFileSync(p, "utf8").includes(`resultKey("${view}"`)) problems.push(`${VIEWS_DIR}/${mod} doesn't call resultKey("${view}", ...)`);
    views[view] = p;
  }
  const modules = new Set(Object.values(views));
  const cacheFile = join(rootDir, "src", "lib", "results-cache.ts");
  for (const f of filesUnder(join(rootDir, "src"))) {
    if (isTest(f) || f === cacheFile || f.endsWith(".json")) continue;
    const text = readFileSync(f, "utf8");
    const rel = relative(rootDir, f);
    for (const m of text.matchAll(/\bresultKey\(\s*(["'`])?([^"'`,)]*)/g)) {
      const view = m[2];
      if (m[1] !== '"' && m[1] !== "'") problems.push(`${rel}: resultKey(${view}...) -- the view must be a string literal`);
      else if (!views[view]) problems.push(`${rel}: resultKey("${view}") -- "${view}" isn't in ${VIEWS_DIR}/views.json`);
      else if (views[view] !== f) problems.push(`${rel}: resultKey("${view}") -- only ${relative(rootDir, views[view])} may build that view's key`);
    }
    if (/\bcachedResult\s*(?:<[^>]*>)?\(/.test(text) && !modules.has(f)) problems.push(`${rel}: calls cachedResult outside a view module named in ${VIEWS_DIR}/views.json`);
  }
  if (problems.length) throw new ViewListError(problems.join("\n"));
  return views;
}

/** Each view's files (absolute, sorted), as described above. */
export function viewFiles(rootDir = root, views = checkedViews(rootDir)) {
  const src = filesUnder(join(rootDir, "src")).filter((f) => !isTest(f));
  // Who imports whom, for the walk up to the routes.
  const importers = new Map();
  for (const f of src) for (const d of importsOf(f, rootDir, true)) {
    if (!importers.has(d)) importers.set(d, new Set());
    importers.get(d).add(f);
  }
  const always = ALWAYS.map((p) => join(rootDir, p)).filter((p) => existsSync(p));
  const out = {};
  for (const [view, mod] of Object.entries(views)) {
    const up = new Set([mod]);
    const stack = [mod];
    while (stack.length) for (const i of importers.get(stack.pop()) ?? []) if (!up.has(i)) (up.add(i), stack.push(i));
    out[view] = [...importClosure([...up, ...always], rootDir, true)].sort();
  }
  return out;
}

/** The hash of one view's files (and the lockfile). */
export function hashViewFiles(view, files, rootDir = root) {
  const h = createHash("sha256").update(VIEW_SALT).update("\0").update(view).update("\0");
  for (const f of files) h.update(relative(rootDir, f)).update("\0").update(readFileSync(f)).update("\0");
  const lock = join(rootDir, "package-lock.json");
  if (existsSync(lock)) h.update("package-lock.json\0").update(readFileSync(lock));
  return h.digest("hex").slice(0, 16);
}

/** { view: version } for every view; null when there's no list here or the walk failed. Throws ViewListError
 * (fails the build) when the list doesn't match the code. */
export function viewCode(rootDir = root) {
  if (!existsSync(join(rootDir, VIEWS_DIR, "views.json"))) {
    log("view_code: no view list here; every view uses server_code");
    return null;
  }
  let views;
  try {
    views = checkedViews(rootDir);
  } catch (e) {
    if (e instanceof ViewListError) throw e;
    log(`view_code: the view list couldn't be read (${e.message.split("\n")[0]}); every view uses server_code`);
    return null;
  }
  try {
    const files = viewFiles(rootDir, views);
    const out = {};
    for (const [view, fs] of Object.entries(files)) out[view] = hashViewFiles(view, fs, rootDir);
    log(`view_code for ${Object.keys(out).length} view(s): ${Object.entries(files).map(([v, fs]) => `${v} ${fs.length}`).join(", ")} file(s)`);
    return out;
  } catch (e) {
    log(`view_code: the walk failed (${e.message.split("\n")[0]}); every view uses server_code`);
    return null;
  }
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
    view_code: viewCode(),
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

// Never fail the build over the history: on any error, say so, write `commits: null` if the file can still be
// written, and exit 0. The one exception is a view list that doesn't match the code (ViewListError, above):
// that fails the build, so a view can't go live without its own code version.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let code = 0;
  main().catch((e) => {
    if (e instanceof ViewListError) {
      console.error(`[build-info] the results cache's view list doesn't match the code:\n${e.message}`);
      code = 1;
      return;
    }
    log(`failed (${e && e.message ? e.message.split("\n")[0] : e}); writing commits: null`);
    try {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, JSON.stringify({ commit: null, built_at: new Date().toISOString(), commits: null, source: null, server_code: null, view_code: null }) + "\n");
    } catch {
      // The app reads a missing file as "no list" too.
    }
  }).finally(() => process.exit(code));
}
