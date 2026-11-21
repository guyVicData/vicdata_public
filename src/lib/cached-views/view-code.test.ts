// The results cache's per-view code versions (scripts/write-build-info.mjs, view_code).
//   node --import tsx --test src/lib/cached-views/view-code.test.ts
//
// 1. For every view, its TRUE dependency set -- what esbuild bundles from the view's module and from every
//    route that reaches it (esbuild's metafile, which knows nothing of the walker) -- is inside the walker's
//    set, and changing any file in it changes that view's version.
// 2. A change to a file changes exactly the views whose sets hold it: one only one view uses leaves every
//    other view's version as it was.
// 3. The list is checked at build time: a view without an entry, or a key built outside its module, fails the
//    build (exit 1); a walk that fails falls back to server_code for every view (exit 0).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { ALWAYS, VIEWS_DIR, ViewListError, checkedViews, importClosure, preloadCodeHash, viewCode, viewFiles } from "../../../scripts/write-build-info.mjs";
import { parseBuildInfo } from "../build-info";

const root = path.resolve(__dirname, "../../..");

type Metafile = { inputs: Record<string, { imports: { path: string; external?: boolean; original?: string }[] }> };
type Esbuild = { build(o: Record<string, unknown>): Promise<{ metafile: Metafile }> };
async function esbuild(): Promise<Esbuild> {
  // esbuild comes with tsx (a devDependency); not one of the app's own packages.
  const spec = "esbuild";
  return (await import(spec)) as Esbuild;
}

function codeFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...codeFilesUnder(p));
    else if (/\.(ts|tsx|mts|js|mjs|json)$/.test(p)) out.push(p);
  }
  return out;
}

/** What esbuild bundles from `entry`: every file of the repo it resolved (absolute), packages left out. */
async function trueClosure(es: Esbuild, entry: string): Promise<Set<string>> {
  // Packages are left out (package-lock.json covers them); esbuild resolves everything else itself, @/ through
  // tsconfig.json's paths. (Not `packages: "external"`: it leaves one @/ import of this repo unresolved.)
  const packages = { name: "packages", setup(b: { onResolve(o: { filter: RegExp }, cb: (a: { path: string }) => unknown): void }) {
    b.onResolve({ filter: /.*/ }, (a) => (/^(\.|\/|@\/)/.test(a.path) ? undefined : { path: a.path, external: true }));
  } };
  const r = await es.build({ entryPoints: [entry], absWorkingDir: root, bundle: true, platform: "node", format: "esm", plugins: [packages], metafile: true, write: false, outdir: path.join(tmpdir(), "view-code-esbuild"), logLevel: "silent", tsconfig: path.join(root, "tsconfig.json") });
  const out = new Set(Object.keys(r.metafile.inputs).map((f) => path.resolve(root, f)));
  // An import of this repo esbuild drops because only its types are used shows as external: it must still name a
  // real file (then it never runs, and is added anyway), or it is a mistake.
  for (const [file, i] of Object.entries(r.metafile.inputs))
    for (const imp of i.imports) {
      const spec = imp.original ?? imp.path;
      if (!imp.external || !/^(\.|@\/)/.test(spec)) continue;
      const base = spec.startsWith("@/") ? path.join(root, "src", spec.slice(2)) : path.resolve(root, path.dirname(file), spec);
      const hit = [base, ...[".ts", ".tsx", ".js", ".mjs", ".json"].map((e) => base + e), ...[".ts", ".tsx"].map((e) => path.join(base, "index" + e))].find((p) => existsSync(p) && statSync(p).isFile());
      assert.ok(hit, `esbuild left ${spec} (from ${file}) unresolved, and it names no file`);
      out.add(hit);
    }
  return out;
}

const rel = (f: string) => path.relative(root, f);

// The truth, computed once: each view's esbuild set (its module and the routes that reach it).
let truthMemo: Promise<{ views: Record<string, string>; truth: Record<string, Set<string>>; callers: Record<string, string[]> }> | null = null;
function truth() {
  return (truthMemo ??= (async () => {
    const es = await esbuild();
    const views = checkedViews(root) as Record<string, string>;
    const routes = codeFilesUnder(path.join(root, "src", "app")).filter((f) => /[/\\]route\.ts$/.test(f));
    assert.ok(routes.length > 50, `found the routes (${routes.length})`);
    const routeSets = new Map<string, Set<string>>();
    await Promise.all(routes.map(async (r) => routeSets.set(r, await trueClosure(es, r))));
    const out: Record<string, Set<string>> = {};
    const callers: Record<string, string[]> = {};
    for (const [view, mod] of Object.entries(views)) {
      const set = await trueClosure(es, mod);
      callers[view] = [];
      for (const [r, s] of routeSets) if (s.has(mod)) {
        callers[view].push(rel(r));
        for (const f of s) set.add(f);
      }
      out[view] = set;
    }
    return { views, truth: out, callers };
  })());
}

test("view_code: every view has a module, and is called only from routes (so the routes are its callers)", async () => {
  const { views, callers } = await truth();
  assert.ok(Object.keys(views).length >= 17, "every stored view is listed");
  for (const [view, c] of Object.entries(callers)) assert.ok(c.length > 0, `${view} is reached from a route`);
  // The modules' functions are named only in the modules, the routes and the tests -- no lib in between
  // (which would make its own callers the ones resolving the inputs).
  const names = new Set<string>();
  for (const mod of Object.values(views)) for (const m of readFileSync(mod, "utf8").matchAll(/export (?:async )?function (\w+)/g)) names.add(m[1]);
  const modules = new Set(Object.values(views));
  for (const f of codeFilesUnder(path.join(root, "src"))) {
    if (modules.has(f) || /\.test\.[a-z]+$/.test(f) || /[/\\]route\.ts$/.test(f) || f.endsWith(".json")) continue;
    const text = readFileSync(f, "utf8");
    for (const n of names) assert.ok(!new RegExp(`\\b${n}\\b`).test(text), `${rel(f)} names ${n}: only routes may call a view (or the test must follow its callers too)`);
  }
});

test("view_code: the walker's set for every view holds everything esbuild bundles for it (a superset)", async (ctx) => {
  const { truth: t, callers } = await truth();
  const walked = viewFiles(root) as Record<string, string[]>;
  for (const [view, set] of Object.entries(t)) {
    const w = new Set(walked[view]);
    const missing = [...set].filter((f) => !w.has(f)).map(rel);
    assert.deepEqual(missing, [], `${view}: files esbuild bundles but the walker missed`);
    for (const a of ALWAYS) if (existsSync(path.join(root, a))) assert.ok(w.has(path.join(root, a)), `${view} has ${a}`);
    assert.ok(set.size > 10, `${view}: esbuild's set is real (${set.size})`);
    ctx.diagnostic(`${view}: esbuild ${set.size} file(s) from its module and ${callers[view].join(", ")}; walker ${w.size}`);
  }
});

// A copy of what the build reads, to change files in without touching the checkout.
function copyRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "view-code-"));
  cpSync(path.join(root, "src"), path.join(dir, "src"), { recursive: true, filter: (p) => !p.includes(`${path.sep}generated`) });
  for (const f of ["scripts/write-build-info.mjs", "tsconfig.json", "next.config.ts", "package.json", "package-lock.json"]) cpSync(path.join(root, f), path.join(dir, f));
  return dir;
}

function quietly<T>(fn: () => T): T {
  const log = console.log;
  console.log = () => undefined;
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

test("view_code: changing any file a view depends on changes that view's version, and only the views that hold it", { timeout: 600_000 }, async (ctx) => {
  const { truth: t } = await truth();
  const dir = copyRepo();
  try {
    const walked = quietly(() => viewFiles(dir)) as Record<string, string[]>;
    const base = quietly(() => viewCode(dir)) as Record<string, string>;
    assert.ok(base && Object.keys(base).length === Object.keys(t).length);
    const inCopy = (f: string) => path.join(dir, rel(f));
    // Every file in any view's set (walker's or esbuild's: the first holds the second), and the lockfile.
    const files = new Set<string>([...Object.values(walked).flat(), ...Object.values(t).flatMap((s) => [...s].map(inCopy))]);
    const onlyOne: string[] = [];
    for (const f of files) {
      const was = readFileSync(f);
      appendFileSync(f, f.endsWith(".json") ? " " : "\n// changed\n");
      try {
        const now = quietly(() => viewCode(dir)) as Record<string, string>;
        const changed = Object.keys(base).filter((v) => now[v] !== base[v]).sort();
        const holders = Object.keys(walked).filter((v) => walked[v].includes(f)).sort();
        const mustChange = Object.keys(t).filter((v) => t[v].has(path.join(root, path.relative(dir, f))));
        for (const v of mustChange) assert.ok(changed.includes(v), `${v} depends on ${path.relative(dir, f)} but its version didn't change`);
        assert.deepEqual(changed, holders, `a change to ${path.relative(dir, f)} changes exactly the views that hold it`);
        if (holders.length === 1) onlyOne.push(`${holders[0]}: ${path.relative(dir, f)}`);
      } finally {
        writeFileSync(f, was);
      }
    }
    assert.ok(onlyOne.length > 10, `files only one view uses leave the others alone (${onlyOne.length}, e.g. ${onlyOne.slice(0, 3).join("; ")})`);
    ctx.diagnostic(`${files.size} file(s) changed one at a time; ${onlyOne.length} of them in one view only, e.g. ${onlyOne.slice(0, 4).join("; ")}`);
    // The lockfile: every view.
    const lock = path.join(dir, "package-lock.json");
    const was = readFileSync(lock);
    appendFileSync(lock, " ");
    const now = quietly(() => viewCode(dir)) as Record<string, string>;
    writeFileSync(lock, was);
    for (const v of Object.keys(base)) assert.notEqual(now[v], base[v], `${v} changes with package-lock.json`);
    // A file no view reaches (a page's component): no view.
    const ui = path.join(dir, "src/components/smt/SmtDashboard.tsx");
    assert.ok(!Object.values(walked).flat().includes(ui));
    appendFileSync(ui, "\n// changed\n");
    assert.deepEqual(quietly(() => viewCode(dir)), base, "a design-only change keeps every view's version");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("view_code: versions are never a server_code, and differ by view", () => {
  const v = quietly(() => viewCode(root)) as Record<string, string>;
  assert.ok(v);
  for (const x of Object.values(v)) assert.match(x, /^[0-9a-f]{16}$/);
  assert.equal(new Set(Object.values(v)).size, Object.keys(v).length, "the view's name is in its hash");
});

function runScript(dir: string): { code: number; out: string; info: Record<string, unknown> | null } {
  const r = spawnSync("node", ["scripts/write-build-info.mjs"], { cwd: dir, encoding: "utf8", env: { ...process.env, RENDER_GIT_COMMIT: "" } });
  const file = path.join(dir, "src/generated/build-info.json");
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? ""), info: existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null };
}

test("view_code: a view list that doesn't match the code fails the build; a walk that fails falls back to server_code", () => {
  const dir = copyRepo();
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const ok = runScript(dir);
    assert.equal(ok.code, 0, ok.out);
    assert.ok(ok.info && typeof ok.info.view_code === "object" && ok.info.view_code, "view_code written");
    assert.match(String(ok.info.preload_code), /^[0-9a-f]{16}$/, "preload_code written");

    const lib = path.join(dir, "src/lib/smt/overview.ts");
    const libWas = readFileSync(lib, "utf8");
    // A view with no entry.
    writeFileSync(lib, libWas + `\nexport const k = () => resultKey("made/up", "1", {});\n`);
    assert.throws(() => quietly(() => checkedViews(dir)), (e: unknown) => e instanceof ViewListError && /"made\/up" isn't in/.test(e.message));
    const a = runScript(dir);
    assert.equal(a.code, 1, "the build fails");
    assert.match(a.out, /view list doesn't match the code/);
    // A listed view's key built outside its module.
    writeFileSync(lib, libWas + `\nexport const k = () => resultKey("smt/overview", "1", {});\n`);
    assert.throws(() => checkedViews(dir), (e: unknown) => e instanceof ViewListError && /only src\/lib\/cached-views\/smt-overview\.ts may/.test(e.message));
    // A view named by a variable.
    writeFileSync(lib, libWas + `\nexport const k = (v: string) => resultKey(v, "1", {});\n`);
    assert.throws(() => checkedViews(dir), (e: unknown) => e instanceof ViewListError && /string literal/.test(e.message));
    // cachedResult outside a view module.
    writeFileSync(lib, libWas + `\nexport const k = () => cachedResult("x", async () => 1);\n`);
    assert.throws(() => checkedViews(dir), (e: unknown) => e instanceof ViewListError && /outside a view module/.test(e.message));
    writeFileSync(lib, libWas);
    // A listed module that isn't there.
    const list = path.join(dir, VIEWS_DIR, "views.json");
    const listWas = readFileSync(list, "utf8");
    writeFileSync(list, JSON.stringify({ ...JSON.parse(listWas), "smt/overview": "nowhere.ts" }));
    assert.throws(() => checkedViews(dir), (e: unknown) => e instanceof ViewListError && /nowhere\.ts, which isn't there/.test(e.message));
    assert.equal(runScript(dir).code, 1);
    writeFileSync(list, listWas);

    // The walk failing (an import that names no file): view_code null, server_code kept, exit 0.
    writeFileSync(lib, libWas + `\nimport "./no-such-file";\n`);
    const b = runScript(dir);
    assert.equal(b.code, 0, b.out);
    assert.equal(b.info?.view_code, null);
    assert.match(String(b.info?.server_code), /^[0-9a-f]{16}$/);
    assert.match(b.out, /every view uses server_code/);
    writeFileSync(lib, libWas);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("build-info: view_code is read only when every entry is a view name and a 16-hex version", () => {
  const base = { commit: "6bddb6dbe91e", server_code: "0123456789abcdef" };
  const read = (view_code: unknown) => parseBuildInfo(JSON.stringify({ ...base, view_code }), {}).view_code;
  assert.deepEqual(read({ "smt/overview": "aaaaaaaaaaaaaaaa", "teacher/dashboard": "bbbbbbbbbbbbbbbb" }), { "smt/overview": "aaaaaaaaaaaaaaaa", "teacher/dashboard": "bbbbbbbbbbbbbbbb" });
  for (const bad of [null, undefined, {}, [], "x", { "smt/overview": "short" }, { "smt/overview": "aaaaaaaaaaaaaaaa", other: 1 }, { "a|b": "aaaaaaaaaaaaaaaa" }, { "": "aaaaaaaaaaaaaaaa" }]) assert.equal(read(bad), null, JSON.stringify(bad));
  assert.equal(parseBuildInfo(JSON.stringify({ ...base, view_code: { "smt/overview": "aaaaaaaaaaaaaaaa" } }), {}).server_code, base.server_code, "server_code kept beside it");
});

test("preload_code: changing anything the boot preload reaches changes it; nothing else does", { timeout: 300_000 }, () => {
  const dir = copyRepo();
  try {
    const base = preloadCodeHash(dir);
    assert.match(String(base), /^[0-9a-f]{16}$/);
    const files = [...importClosure([path.join(dir, "src/instrumentation.ts")], dir)] as string[];
    assert.ok(files.some((f) => f.endsWith("src/lib/national-loads.ts")) && files.some((f) => f.endsWith("src/lib/national-preload.ts")), "it follows the dynamic import to the preload and its loads");
    for (const f of files) {
      const was = readFileSync(f);
      appendFileSync(f, f.endsWith(".json") ? " " : "\n// changed\n");
      try {
        assert.notEqual(preloadCodeHash(dir), base, path.relative(dir, f));
      } finally {
        writeFileSync(f, was);
      }
    }
    const ui = path.join(dir, "src/components/smt/SmtDashboard.tsx");
    appendFileSync(ui, "\n// changed\n");
    assert.equal(preloadCodeHash(dir), base);
    rmSync(path.join(dir, "src/instrumentation.ts"));
    assert.equal(preloadCodeHash(dir), null, "no preload in the build");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("view_code: adding a view, or pointing one at another module, moves only that view", () => {
  const dir = copyRepo();
  try {
    const base = quietly(() => viewCode(dir)) as Record<string, string>;
    const list = path.join(dir, VIEWS_DIR, "views.json");
    const was = JSON.parse(readFileSync(list, "utf8"));
    // chooser/urns moved to a module with the same text under another name.
    cpSync(path.join(dir, VIEWS_DIR, "chooser-urns.ts"), path.join(dir, VIEWS_DIR, "chooser-urns-2.ts"));
    rmSync(path.join(dir, VIEWS_DIR, "chooser-urns.ts"));
    for (const r of ["src/app/api/teacher/chooser-set/route.ts"]) writeFileSync(path.join(dir, r), readFileSync(path.join(dir, r), "utf8").replace("cached-views/chooser-urns\"", "cached-views/chooser-urns-2\""));
    writeFileSync(list, JSON.stringify({ ...was, "chooser/urns": "chooser-urns-2.ts" }, null, 2));
    const moved = quietly(() => viewCode(dir)) as Record<string, string>;
    const changed = Object.keys(base).filter((v) => moved[v] !== base[v]);
    // The route changed too, so every view it serves moves; nothing else.
    assert.deepEqual(changed.sort(), ["chooser/nearest", "chooser/ranking", "chooser/ranking-full", "chooser/urns"]);
    // A new view in its own module, called from a new route: the others keep their versions.
    writeFileSync(path.join(dir, VIEWS_DIR, "new-view.ts"), `import { cachedResult, resultKey } from "../results-cache";\nexport const cachedNew = (urn: string) => cachedResult(resultKey("new/view", urn, {}), async () => 1);\n`);
    writeFileSync(path.join(dir, "src/app/api/new-view-route.ts"), `import { cachedNew } from "@/lib/cached-views/new-view";\nexport const GET = () => cachedNew("1");\n`);
    writeFileSync(list, JSON.stringify({ ...was, "chooser/urns": "chooser-urns-2.ts", "new/view": "new-view.ts" }, null, 2));
    const added = quietly(() => viewCode(dir)) as Record<string, string>;
    assert.match(added["new/view"], /^[0-9a-f]{16}$/);
    for (const v of Object.keys(moved)) assert.equal(added[v], moved[v], `${v} unmoved by a new view`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
