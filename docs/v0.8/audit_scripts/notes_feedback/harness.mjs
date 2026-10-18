// VicData 0.8 notes and feedback: the browser half of the round's browser tests (notes_feedback.mjs).
// Playwright against the local production build (next start, with server-preload.mjs), as the View as fixes
// round's harness (docs/v0.8/audit_scripts/view_as_fixes/harness.mjs), with two stand-ins added:
//   * teacher_view_notes: the browser's note reads and writes are answered here, per stub user, in memory
//     (RLS: profile_id = the caller), and every write is recorded -- never sent;
//   * /api/feedback and /api/platform/feedback: answered here from an in-memory list, with the audience
//     setting as an option (`allowed`), so the page's items are what the test gave -- never stored.
// The signed-in platform admin is a stub (a fake session in localStorage); every other read goes to the real
// app database with the anon key; every other write is answered here and recorded, never sent.
//   PLAYWRIGHT_CORE  a directory whose node_modules holds playwright-core (default: this machine's npx cache)
//   CHROME           the browser to launch (default: Playwright's cached Chrome for Testing)
import { createRequire } from "node:module";
const require = createRequire(`${process.env.PLAYWRIGHT_CORE ?? "/Users/guy/.npm/_npx/e41f203b7505f1fb"}/node_modules/`);
export const { chromium, devices } = require("playwright-core");

export const BASE = process.env.BASE ?? "http://127.0.0.1:3410";
export const REF = "lnhulykjlxmoneappnsp";
export const GUY = "52a08818-9132-48a0-8665-8362361eff11";
const SUPA = `https://${REF}.supabase.co`;
export const EXE = process.env.CHROME ?? "/Users/guy/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 6;
const tokenFor = (sub) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", aud: "authenticated", exp, email: "admin@example.test" })}.sig`;

/** The View as cookie for a school and role (src/lib/view-as.ts), or a head office of a group ref. */
export const viewAsCookie = (o) => ({
  name: "vicdata_view_as",
  value: encodeURIComponent(JSON.stringify(o.group ? { r: "head_office", g: o.group, n: o.name } : { u: o.urn, r: o.role, n: o.name })),
  url: BASE,
});

// The feedback list the stand-in routes answer from (shared across a run, as the database would be).
export const feedback = { items: [], posted: [], allowed: true };

// opts: viewport ({width,height}), mobile (bool), theme ("light" | "dark"), viewAs (cookie options), sub
// (the stub user's id; default the platform admin), allowed (the feedback setting lets this user in).
export async function harness(opts = {}) {
  const log = [];
  const writes = [];
  const usage = [];
  const notes = opts.notes ?? [];
  const sub = opts.sub ?? GUY;
  const user = { id: sub, aud: "authenticated", role: "authenticated", email: "admin@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-09-01T00:00:00Z" };
  const session = { access_token: tokenFor(sub), refresh_token: "stub-refresh", expires_in: 21600, expires_at: exp, token_type: "bearer", user };
  const browser = opts.browser ?? (await chromium.launch({ executablePath: EXE, headless: true }));
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: opts.mobile ? 2 : 1,
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    colorScheme: opts.theme ?? "light",
  });
  await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  if (opts.viewAs) await context.addCookies([viewAsCookie(opts.viewAs)]);
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
    if (p === "/rest/v1/rpc/is_platform_admin") return json(route, sub === GUY);
    if (p === "/rest/v1/school_memberships" && m === "GET") return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(route, null) : json(route, []);
    if (p === "/rest/v1/trial_contexts" && m === "GET") return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(route, null) : json(route, []);
    if (p === "/rest/v1/profiles" && m === "GET") return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(route, { email: "admin@example.test", full_name: "Platform Admin" }) : json(route, [{ email: "admin@example.test", full_name: "Platform Admin" }]);
    // Teacher's onboarding and preferences, in memory: onboarded on both phases, two subjects ticked (so the
    // dashboard draws its panels rather than the first-visit steps). Their writes are recorded, never sent.
    const prefs = opts.teacherPrefs ?? { ks4: ["Mathematics::GCSE (9-1) Full Course", "Biology::GCSE (9-1) Full Course"], ks5: ["Mathematics::GCE A level"] };
    if (p === "/rest/v1/teacher_view_onboarding" && m === "GET") return json(route, Object.keys(prefs).map((phase) => ({ phase })));
    if (p === "/rest/v1/teacher_view_preferences" && m === "GET") {
      const phase = url.searchParams.get("phase")?.replace(/^eq\./, "");
      const row = prefs[phase] ? { subjects: prefs[phase], columns: {}, last_seen_period: null } : null;
      return (req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(route, row) : json(route, row ? [row] : []);
    }
    // teacher_view_notes, in memory, the caller's own rows only (its RLS).
    if (p === "/rest/v1/teacher_view_notes") {
      const eq = (k) => url.searchParams.get(k)?.replace(/^eq\./, "") ?? null;
      if (m === "GET") return json(route, notes.filter((n) => n.profile_id === sub && (!eq("school_urn") || n.school_urn === eq("school_urn"))).map((n) => ({ chart_key: n.chart_key, body: n.body })));
      if (m === "POST") {
        const row = JSON.parse(req.postData() ?? "{}");
        writes.push(`POST teacher_view_notes ${JSON.stringify(row)}`);
        if (row.profile_id !== sub) return json(route, { code: "42501", message: "row-level security" }, 403);
        const i = notes.findIndex((n) => n.profile_id === sub && n.school_urn === row.school_urn && n.chart_key === row.chart_key);
        if (i >= 0) notes[i] = row;
        else notes.push(row);
        return json(route, [row], 201);
      }
      if (m === "DELETE") {
        writes.push(`DELETE teacher_view_notes ${url.search}`);
        for (let i = notes.length - 1; i >= 0; i--) if (notes[i].profile_id === sub && notes[i].school_urn === eq("school_urn") && notes[i].chart_key === eq("chart_key")) notes.splice(i, 1);
        return route.fulfill({ status: 204 });
      }
    }
    if (opts.supa) { const r = await opts.supa(route, req, url); if (r !== undefined) return; }
    if (m !== "GET" && m !== "HEAD" && !(m === "POST" && p.startsWith("/rest/v1/rpc/") && !/log_platform_action|record_sign_in|reset_trial/.test(p))) {
      writes.push(`${m} ${p} ${req.postData()?.slice(0, 200) ?? ""}`);
      return route.fulfill({ status: m === "POST" && p.startsWith("/rest/v1/rpc/") ? 204 : 201, body: "" });
    }
    const h = { ...req.headers() };
    h["authorization"] = `Bearer ${h["apikey"]}`;
    try {
      const resp = await route.fetch({ headers: h });
      return route.fulfill({ response: resp });
    } catch {
      return route.abort("failed");
    }
  });

  // The audience setting at "admins": the platform admin is let in, anyone else isn't (opts.allowed overrides).
  const allowed = () => opts.allowed ?? (sub === GUY && feedback.allowed);
  await context.route(`${BASE}/api/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    log.push(`API ${req.method()} ${p}${url.search}`);
    if (p.startsWith("/api/usage")) { usage.push(`${req.method()} ${p} ${req.postData() ?? ""}`); return route.fulfill({ status: 204 }); }
    if (p === "/api/feedback" && req.method() === "GET") {
      const mine = feedback.items.filter((i) => i.author_id === sub).map((i) => ({ id: i.id, number: i.number, created_at: i.created_at, view_key: i.view_key, school_urn: i.school_urn, school_name: i.school_name, group_id: i.group_id, group_name: i.group_name, status: i.status, looks_good: i.looks_good, kinds: i.kinds, has_text: !!i.body.trim(), excerpt: i.body.trim().slice(0, 140) }));
      return json(route, allowed() ? { allowed: true, items: mine } : { allowed: false, items: [] });
    }
    if (p === "/api/feedback" && req.method() === "POST") {
      const body = JSON.parse(req.postData() ?? "{}");
      feedback.posted.push(body);
      if (!allowed()) return json(route, { error: "Feedback isn't open to you yet." }, 403);
      const n = feedback.items.length + 1;
      const item = { ...body, id: `fb-${n}`, number: n, created_at: new Date().toISOString(), status: "new", author_id: sub, looks_good: !!body.looks_good || (body.kinds ?? []).includes("looks_good"), app_version: "test" };
      feedback.items.push(item);
      return json(route, { item: { id: item.id, number: n, created_at: item.created_at, status: "new" } });
    }
    if (p === "/api/platform/feedback" && req.method() === "GET") {
      const n = Number((url.searchParams.get("number") ?? "").replace(/^F-/i, ""));
      const rows = feedback.items.filter((i) => !n || i.number === n).map((i) => ({ ...i, ref: `F-${i.number}`, created_london: i.created_at.slice(0, 16).replace("T", " "), author_name: "Platform Admin", school_or_group: i.school_name ?? i.group_name, is_open: i.status !== "done" && (!!i.body.trim() || !i.looks_good) }));
      return json(route, { items: rows });
    }
    if (opts.api) { const r = await opts.api(route, req, url); if (r !== undefined) return; }
    return route.fallback();
  });

  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") log.push(`CONSOLE ${msg.text().slice(0, 200)}`); });
  page.on("pageerror", (e) => log.push(`PAGEERROR ${e.message.slice(0, 200)}`));
  return { browser, context, page, log, writes, usage, notes };
}

/** The Open link, as src/lib/view-ref.ts feedbackOpenHref builds it. */
export function openHref(item) {
  const sp = new URLSearchParams(item.page_query ?? "");
  for (const k of ["fb", "fbPanel", "fbView", "lookAs", "as", "peek"]) sp.delete(k);
  const lookAs = item.group_ref ?? item.school_urn;
  if (lookAs && item.role) {
    sp.set("lookAs", lookAs);
    sp.set("as", item.role);
    sp.set("peek", "1");
  }
  sp.set("fb", `F-${item.number}`);
  if (item.panel_id) sp.set("fbPanel", item.panel_id);
  if (item.view_instance_id) sp.set("fbView", item.view_instance_id);
  return `${item.page_path}?${sp.toString()}`;
}

export const rectOf = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; });
export const overlaps = (a, b) => a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1;
