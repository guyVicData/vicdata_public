// Run: npx -y tsx --test --test-force-exit src/lib/feedback-deploy-gate.test.ts
// VicData 0.8 feedback deploy gate, the app's half (the database's: supabase/tests/v08_feedback_deploy_gate_pglite.mjs):
//   R-FEEDBACK-STATUSES   fixed and deployed are statuses; both are open, so the icon stays yellow until done;
//                         "deployed" can't be set by hand; "fixed" needs its commit.
//   R-FEEDBACK-PROMOTE    the server records its build once, with its commit list, through the service role.
//   R-BUILD-INFO          the build's list is trusted only when it starts at the build's commit; none is null.
//   R-REPUBLISH-GUARD     the republish exits non-zero unless the live /api/version commit holds HEAD (mocked).
//   R-REPORT-COMMANDS-ORDER  a report's "Guy's commands" follow the template's seven steps, in order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { feedbackColour, FEEDBACK_SETTABLE_STATUSES, FEEDBACK_OPEN_STATUSES, isOpenFeedback, type FeedbackMark } from "./view-ref";
import { triagePatch } from "./feedback-server";
import { parseBuildInfo } from "./build-info";
import { recordBuild } from "./app-build-server";
import { statusText } from "@/components/admin/FeedbackInbox";
import { checkCommands } from "../../scripts/report-template";
import { liveUrlFrom } from "../../scripts/live-guard";

const root = path.resolve(__dirname, "../..");
const here = "school:110110";
const mark = (o: Partial<FeedbackMark>): FeedbackMark => ({ status: "new", looksGood: false, hasText: true, kinds: [], schoolKey: here, ...o });

test("R-FEEDBACK-STATUSES: fixed and deployed stay open (yellow) until done", () => {
  for (const status of ["fixed", "deployed"] as const) {
    assert.equal(isOpenFeedback(mark({ status })), true, `${status} is open`);
    assert.equal(feedbackColour([mark({ status })], here), "open", `${status}: the icon is yellow`);
  }
  assert.equal(feedbackColour([mark({ status: "done" })], here), "none", "done: monochrome");
  assert.deepEqual(FEEDBACK_OPEN_STATUSES, ["new", "triaged", "planned", "fixed", "deployed"]);
  assert.ok(!FEEDBACK_SETTABLE_STATUSES.includes("deployed"), "nobody sets deployed");
});

test("R-FEEDBACK-STATUSES: the triage patch refuses deployed, and fixed needs a commit", () => {
  assert.ok("error" in triagePatch({ status: "deployed" }));
  assert.ok("error" in triagePatch({ status: "fixed" }));
  assert.ok("error" in triagePatch({ status: "fixed", resolved_commit: "not a sha" }));
  assert.deepEqual(triagePatch({ status: "fixed", resolved_commit: "6bddb6d" }), { patch: { status: "fixed", resolved_commit: "6bddb6d" } });
  assert.deepEqual(triagePatch({ status: "done" }), { patch: { status: "done" } }, "Checked live");
  const id = "0f0e0d0c-0b0a-0908-0706-050403020100";
  assert.deepEqual(triagePatch({ follows_up: id }), { patch: { follows_up: id } });
  assert.deepEqual(triagePatch({ follows_up: "F-17" }), { patch: { follows_up: null } }, "an id, not an F-number");
});

test("the inbox says what a status rests on", () => {
  const base = { planned_version: null, resolved_commit: null, deployed_build: null, deployed_at: null, checked_live_at: null };
  assert.equal(statusText({ ...base, status: "fixed", resolved_commit: "6bddb6d" }), "Fixed (6bddb6d)");
  assert.equal(statusText({ ...base, status: "deployed", deployed_build: "777777777777", deployed_at: "2026-11-06T11:00:00Z" }), "Deployed (in 7777777, 2026-11-06)");
  assert.equal(statusText({ ...base, status: "done", resolved_commit: "6bddb6d", checked_live_at: "2026-11-07T09:00:00Z" }), "Done (6bddb6d, checked live 2026-11-07)");
});

test("R-BUILD-INFO: the list is the build's own, or null", () => {
  const list = ["6bddb6dbe91e", "030d546fef79"];
  assert.deepEqual(parseBuildInfo(JSON.stringify({ commit: "6bddb6dbe91e", built_at: "2026-11-06T10:40:00Z", commits: list }), {}), { commit: "6bddb6dbe91e", built_at: "2026-11-06T10:40:00Z", commits: list });
  assert.equal(parseBuildInfo(JSON.stringify({ commit: "6bddb6dbe91e", commits: ["030d546fef79"] }), {}).commits, null, "a list that doesn't start at the build isn't its own");
  assert.equal(parseBuildInfo(JSON.stringify({ commit: "6bddb6dbe91e", commits: null }), {}).commits, null, "no list says so");
  assert.equal(parseBuildInfo("not json", { RENDER_GIT_COMMIT: "6bddb6dbe91eb0fa" }).commit, "6bddb6dbe91e", "no file: the commit from Render, no list");
  assert.equal(parseBuildInfo(null, { NODE_ENV: "development" }).commit, null, "a dev server has no commit");
});

test("R-FEEDBACK-PROMOTE: the server records its build through the service role, with its list", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const logs: string[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("9", { status: 200 });
  }) as unknown as typeof fetch;
  const moved = await recordBuild({ commit: "6bddb6dbe91e", built_at: null, commits: ["6bddb6dbe91e"] }, { fetch: fake, url: "https://x.supabase.co", key: "service", log: (m) => logs.push(m) });
  assert.equal(moved, 9);
  assert.equal(calls[0].url, "https://x.supabase.co/rest/v1/rpc/record_app_build");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { p_commit: "6bddb6dbe91e", p_commits: ["6bddb6dbe91e"], p_built_at: null });
  assert.match(logs[0], /9 fixed item\(s\) moved to deployed/);
  assert.equal(await recordBuild({ commit: null, built_at: null, commits: null }, { fetch: fake, url: "u", key: "k", log: () => {} }), null, "no commit: not recorded");
  assert.equal(calls.length, 1);
  // The key is the server's: nothing a client bundle imports reads it.
  const clientFiles = execFileSync("grep", ["-rl", "--include=*.tsx", "--include=*.ts", "use client", path.join(root, "src")], { encoding: "utf8" }).split("\n").filter(Boolean);
  const client = clientFiles.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
  assert.ok(client.length > 10, "the client files are found");
  for (const f of client) assert.ok(!/app-build-server|build-info|SUPABASE_SERVICE_ROLE_KEY/.test(readFileSync(f, "utf8")), `${f} must not reach the service key`);
});

// ------------------------------------------------------------------------------- the republish guard

function runSeed(args: string[], env: Record<string, string> = {}): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    execFile("npx", ["-y", "tsx", "scripts/dashboards-seed-sql.ts", ...args], { cwd: root, env: { ...process.env, VICDATA_LIVE_URL: "", ...env }, maxBuffer: 1e8 }, (err, stdout, stderr) => {
      resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stderr, stdout });
    });
  });
}

async function mockLive(commit: string | null): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(req.url === "/api/version" ? JSON.stringify({ commit, built_at: null, commits: null }) : "{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() };
}

test("R-REPUBLISH-GUARD: no live address, no default", async () => {
  assert.equal(liveUrlFrom([], {}), null);
  assert.equal(liveUrlFrom(["--live", "https://example.org/"], {}), "https://example.org");
  assert.equal(liveUrlFrom([], { VICDATA_LIVE_URL: "https://env.example" }), "https://env.example");
  const r = await runSeed(["--only", "vicdata.admissions.pipelines"]);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /No live address/);
  assert.equal(r.stdout.trim(), "", "nothing is printed to apply");
});

test("R-REPUBLISH-GUARD: refused while the live commit doesn't hold HEAD; runs once it does; --force says why it's unsafe", async () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const parent = execFileSync("git", ["rev-parse", "HEAD~1"], { cwd: root, encoding: "utf8" }).trim();
  const old = await mockLive(parent.slice(0, 12));
  try {
    const r = await runSeed(["--live", old.url, "--only", "vicdata.admissions.pipelines"]);
    assert.notEqual(r.code, 0, "live is HEAD's parent: refused");
    assert.match(r.stderr, /doesn't hold this checkout's HEAD/);
    assert.equal(r.stdout.trim(), "");
  } finally {
    old.close();
  }
  const none = await mockLive(null);
  try {
    const r = await runSeed(["--live", none.url, "--only", "vicdata.admissions.pipelines"]);
    assert.notEqual(r.code, 0, "a live build with no commit: refused");
  } finally {
    none.close();
  }
  const live = await mockLive(head.slice(0, 12));
  try {
    const r = await runSeed(["--only", "vicdata.admissions.pipelines"], { VICDATA_LIVE_URL: live.url });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^begin;/);
  } finally {
    live.close();
  }
  const forced = await runSeed(["--force", "--only", "vicdata.admissions.pipelines"]);
  assert.equal(forced.code, 0);
  assert.match(forced.stderr, /unsafe/);
});

// ------------------------------------------------------------------------------- the report template

test("R-REPORT-COMMANDS-ORDER: the template's seven steps, in order", () => {
  const good = `# R\n\n## Guy's commands, in order\n\n**1. Migrations** a\n\n**2. Merge and push** b\n\n**3. Render deploy** c\n\n**4. Wait until /api/version shows the merge** d\n\n**5. Republish:** none this round.\n\n**6. Set fixed** e\n\n**7. Live check** f\n\n## Next\n`;
  assert.deepEqual(checkCommands(good), []);
  const round1 = readFileSync(path.join(root, "docs/v0.8/admissions_feedback_round1_report_v1.md"), "utf8");
  assert.ok(checkCommands(round1).length > 0, "round 1's order (republish and mark done with no wait for the deploy) fails it");
  assert.ok(checkCommands(good.replace("**5. Republish:** none this round.\n\n**6. Set fixed** e", "**5. Set fixed** e\n\n**6. Republish**")).length > 0, "out of order fails");
  assert.deepEqual(checkCommands("# no commands"), ["no \"## Guy's commands\" section"]);
});
