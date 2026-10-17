// Run: npx -y tsx --test --test-force-exit src/lib/view-as-pages.test.ts  (the browser client keeps a timer alive)
// VicData 0.8 View as, R-EDIT-FOOTER-EVERYWHERE (the part a test can hold): the SMT and Admissions pages'
// own member loaders, in View as SMT at Leighton Park, reach the dashboard -- so the page registers it
// and the footer's Edit shows. Its own file: the View as module pins the cookie per page load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { installFakeSupabase, LEIGHTON } from "./view-as-testkit";
import { serializeViewAsCookie, VIEW_AS_COOKIE } from "./view-as";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
installFakeSupabase();
const src = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");
const M = { callerRoute: null as unknown as typeof import("../app/api/view-as/caller/route") };

// ------------------------------------------------------------------ R-EDIT-FOOTER-EVERYWHERE (the part a test can hold)

test("R-EDIT-FOOTER-EVERYWHERE: SMT and Admissions in View as SMT at Leighton Park reach the dashboard (so they register it for the Edit switch)", async () => {
  // A browser signed in as the platform admin, in View as SMT at Leighton Park (no membership there).
  M.callerRoute = await import("../app/api/view-as/caller/route");
  const store = new Map<string, string>();
  const jar = new Map<string, string>([[VIEW_AS_COOKIE, serializeViewAsCookie({ urn: LEIGHTON, role: "smt", schoolName: "Leighton Park School" })]]);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  store.set("sb-supabase-auth-token", JSON.stringify({ access_token: "tok-guy", refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: "guy", aud: "authenticated", email: "guy@test" } }));
  const g = globalThis as unknown as Record<string, unknown>;
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  g.document = { get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); }, set cookie(_: string) {} };
  g.window = { location: { search: "", protocol: "https:", origin: "http://app.test", href: "http://app.test/teacher/smt" }, localStorage: storage, sessionStorage: storage, dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} };
  g.localStorage = storage;
  // The page's own /api/ calls go to the real route handlers, with the browser's cookie.
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/view-as/caller")) {
      const h = new Headers(init?.headers);
      h.set("cookie", (g.document as { cookie: string }).cookie);
      return M.callerRoute.GET(new NextRequest(`http://app.test${url}`, { headers: h }));
    }
    return real(input, init);
  }) as typeof fetch;
  try {
    const { loadSmtMember } = await import("../components/smt/member");
    const smt = await loadSmtMember();
    assert.equal(smt.status, "ready", "before this round: no-school, and the page said 'use View as'");
    if (smt.status === "ready") {
      assert.equal(smt.member.access, "viewAs");
      assert.equal(smt.member.schoolAccountId, "acc-lp");
      assert.equal(smt.member.readOnly, true);
    }
    const { loadAdmissionsMember } = await import("../components/admissions/member");
    const adm = await loadAdmissionsMember();
    assert.equal(adm.status, "ready");
    if (adm.status === "ready") assert.equal(adm.member.access, "viewAs");
  } finally {
    globalThis.fetch = real;
    // The browser client's token refresh timer would keep the test process alive.
    const { createBrowserSupabaseClient } = await import("./supabase");
    await createBrowserSupabaseClient().auth.stopAutoRefresh();
  }
  // Every config-driven VicData dashboard page registers its dashboard (useInPlaceEdit) once it draws
  // one, so the footer's Edit (admin && registered: edit-mode.ts useEditSwitch) shows there.
  const reg: [string, RegExp][] = [
    ["components/dashboard-config/TeacherDashboard.tsx", /useInPlaceEdit\(supabase, vicDataSlug\)/],
    ["components/dashboard-config/CustomDashboardScreen.tsx", /useInPlaceEdit\(supabaseClient, vicDataSlug\)/],
    ["components/smt/SmtDashboard.tsx", /useInPlaceEdit\(supabase, shows \? DASH_ID\[dash\] : null\)/],
    ["components/admissions/AdmissionsDashboard.tsx", /useInPlaceEdit\(supabase, showsDashboard \? DASH_ID\[dash\] : null\)/],
  ];
  for (const [f, re] of reg) assert.match(src(f), re, f);
  assert.match(src("lib/edit-mode.ts"), /const shown = admin && !!slug;/, "never for a non-admin");
});
