// VicData 0.8 View as fixes: the browser half of the View as browser tests (lands.mjs). Playwright against
// the local production build (next start, with server-preload.mjs). The signed-in platform admin is a stub:
// a fake session in localStorage, and every Supabase call the BROWSER makes that needs the user (auth,
// is_platform_admin, their memberships, trial_contexts, the audit log) is answered here. Every other read
// goes to the real app database with the anon key; every write is answered here and recorded, never sent.
// The page's own /api calls go to the local server (which answers the same stub user: server-preload.mjs),
// except /api/usage, which is recorded and never sent.
//   PLAYWRIGHT_CORE  a directory whose node_modules holds playwright-core (default: this machine's npx cache)
//   CHROME           the browser to launch (default: Playwright's cached Chrome for Testing)
import { createRequire } from "node:module";
const require = createRequire(`${process.env.PLAYWRIGHT_CORE ?? "/Users/guy/.npm/_npx/e41f203b7505f1fb"}/node_modules/`);
export const { chromium } = require("playwright-core");

export const BASE = process.env.BASE ?? "http://127.0.0.1:3410";
export const REF = "lnhulykjlxmoneappnsp";
export const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const SUPA = `https://${REF}.supabase.co`;
export const EXE = process.env.CHROME ?? "/Users/guy/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 6;
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: GUY, role: "authenticated", aud: "authenticated", exp, email: "admin@example.test" })}.sig`;
const user = { id: GUY, aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-09-01T00:00:00Z" };
const session = { access_token: token, refresh_token: "stub-refresh", expires_in: 21600, expires_at: exp, token_type: "bearer", user };

const ACLAND = { id: "7dca67ce-78e8-4391-8b72-5fe9c79f805d", status: "approved", role: "admissions", roles: ["admissions", "teacher"], is_admin: true, approved_at: "2026-09-21T18:57:24Z", admissions_lead: false, school_account_id: "643e0267-865b-49cf-8c91-79cbfb9deb65", school_accounts: { school_urn: "100053", account_holder_membership_id: null, schools: { current_name: "Acland Burghley School" } } };

// opts: memberships (the admin's own rows), admin: "ok" | "error" | "neterror" | "no" | fn(n) -> one of
// those, adminDelayMs, recent (trial_contexts rows), stubApi (answer /api here instead of the server: the
// first reproduction, before server-preload.mjs), api: extra /api handlers.
export async function harness(opts = {}) {
  const log = [];
  const writes = [];
  const usage = [];
  let adminCalls = 0;
  const state = { memberships: opts.memberships ?? [ACLAND], recent: opts.recent ?? [
    { school_urn: "110110", role: "smt", last_used_at: "2026-10-18T08:07:54Z" },
    { school_urn: "137625", role: "admissions", last_used_at: "2026-10-18T07:58:34Z" },
  ] };
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await context.route(`${SUPA}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const m = req.method();
    log.push(`${m} ${p}${url.search.slice(0, 120)}`);
    if (p.startsWith("/auth/v1/user")) return json(route, user);
    if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204 });
    if (p.startsWith("/auth/v1/")) return json(route, session);
    if (p === "/rest/v1/rpc/is_platform_admin") {
      adminCalls++;
      const mode = typeof opts.admin === "function" ? opts.admin(adminCalls) : (opts.admin ?? "ok");
      if (opts.adminDelayMs) await new Promise((r) => setTimeout(r, opts.adminDelayMs));
      if (mode === "error") return json(route, { message: "stub: upstream timeout", code: "57014" }, 500);
      if (mode === "neterror") return route.abort("failed");
      return json(route, mode === "ok");
    }
    if (p === "/rest/v1/trial_contexts" && m === "GET") {
      const urn = url.searchParams.get("school_urn")?.replace(/^eq\./, "");
      const role = url.searchParams.get("role")?.replace(/^eq\./, "");
      const rows = state.recent.filter((r) => (!urn || r.school_urn === urn) && (!role || r.role === role));
      return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? (rows[0] ? json(route, rows[0]) : json(route, null)) : json(route, rows);
    }
    if (p === "/rest/v1/school_memberships" && m === "GET") {
      const rows = url.searchParams.get("profile_id") === `eq.${GUY}` || !url.searchParams.get("profile_id") ? state.memberships : [];
      const urn = url.searchParams.get("school_accounts.school_urn")?.replace(/^eq\./, "");
      const hit = urn ? rows.filter((r) => r.school_accounts?.school_urn === urn) : rows;
      return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(route, hit[0] ?? null) : json(route, hit);
    }
    if (p === "/rest/v1/profiles" && m === "GET") return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(route, { email: "admin@example.test", full_name: "Platform Admin" }) : json(route, [{ email: "admin@example.test", full_name: "Platform Admin" }]);
    if (opts.supa) { const r = await opts.supa(route, req, url); if (r !== undefined) return; }
    if (m !== "GET" && m !== "HEAD" && !(m === "POST" && p.startsWith("/rest/v1/rpc/") && !/log_platform_action|record_sign_in|reset_trial/.test(p))) {
      writes.push(`${m} ${p} ${req.postData()?.slice(0, 200) ?? ""}`);
      return route.fulfill({ status: m === "POST" && p.startsWith("/rest/v1/rpc/") ? 204 : 201, body: "" });
    }
    // A read (or a read-only rpc): the real database, as anon.
    const h = { ...req.headers() };
    h["authorization"] = `Bearer ${h["apikey"]}`;
    try {
      const resp = await route.fetch({ headers: h });
      return route.fulfill({ response: resp });
    } catch {
      return route.abort("failed");
    }
  });

  await context.route(`${BASE}/api/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    log.push(`API ${req.method()} ${p}${url.search}`);
    if (p.startsWith("/api/usage")) { usage.push(`${req.method()} ${p} ${req.postData() ?? ""}`); return route.fulfill({ status: 204 }); }
    if (opts.api) { const r = await opts.api(route, req, url); if (r !== undefined) return; }
    if (!opts.stubApi) return route.fallback();
    if (p === "/api/teacher/phases") return json(route, { phases: ["ks4", "ks5"] });
    if (p === "/api/group/me") return json(route, { offices: [] });
    if (p === "/api/view-as/caller") {
      const urn = url.searchParams.get("urn");
      return json(route, { urn, name: urn, accountId: "", catchmentKm: null, roles: [], access: "viewAs", readOnly: true });
    }
    return json(route, { error: "stub: not answered" }, 404);
  });

  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") log.push(`CONSOLE ${msg.text().slice(0, 200)}`); });
  const cookie = async () => (await context.cookies()).find((c) => c.name === "vicdata_view_as")?.value ?? null;
  return { browser, context, page, log, writes, usage, cookie, state, adminCalls: () => adminCalls };
}

export const decode = (v) => (v ? JSON.parse(decodeURIComponent(v)) : null);
