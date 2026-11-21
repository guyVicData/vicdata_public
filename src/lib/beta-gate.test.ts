// Run: node --import tsx --test --test-force-exit src/lib/beta-gate.test.ts
// 0.8 front door part 3, milestone 2: R-BETA-GATE (the private-beta gate replaces Basic Auth), R-LANDING-MINIMAL
// (the landing page is the logo, "Private beta" and Sign in) and R-NOINDEX-SCHOOLS (A3, on main since 837a3cf:
// a school page is never indexed, whatever ALLOW_INDEXING says).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, type NextFetchEvent } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { AUTH_URL, accessToken, forgedToken, installFakeAuth, session, sessionCookie } from "./auth-testkit";
import { gateDecision } from "./beta-gate";

process.env.NEXT_PUBLIC_SUPABASE_URL = AUTH_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
installFakeAuth();
const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

async function gate(path: string, headers: Record<string, string> = {}) {
  const { proxy } = await import("../proxy");
  const waits: Promise<unknown>[] = [];
  const event = { waitUntil: (p: Promise<unknown>) => void waits.push(p) } as unknown as NextFetchEvent;
  const res = await proxy(new NextRequest(`http://app.test${path}`, { headers }), event);
  return { res, waits, location: res.headers.get("location"), passed: res.headers.get("x-middleware-next") === "1" };
}
const signedIn = () => ({ cookie: sessionCookie(session("teacher-1")) });

// ------------------------------------------------------------------ R-BETA-GATE

test("R-BETA-GATE: signed out, only the allowed routes respond", async () => {
  for (const p of ["/", "/login", "/auth/callback", "/reset-password", "/join/110110", "/robots.txt", "/sitemap.xml"]) {
    const g = await gate(p);
    assert.ok(g.passed, `${p} should open signed out`);
  }
  for (const p of ["/api/health", "/api/version", "/api/testing/preview-session"]) assert.equal(gateDecision(p, false), "pass", p);
});

test("R-BETA-GATE: signed out, every school page, set page and the rest redirect to the landing page", async () => {
  for (const p of ["/schools/100053", "/schools/100053/data", "/sets", "/sets/abc", "/teacher", "/teacher/smt", "/member", "/account", "/platform", "/sources", "/dashboards", "/join"]) {
    const g = await gate(p);
    assert.equal(g.res.status, 307, p);
    assert.equal(g.location, "http://app.test/", p);
  }
});

test("R-BETA-GATE: /join/<urn> stays open signed out (Q2) and is always noindex", async () => {
  assert.ok((await gate("/join/110110")).passed);
  assert.equal(gateDecision("/join/110110/extra", false), "landing", "only the join page itself");
  const { NOINDEX_SOURCES } = await import("../../next.config");
  assert.ok(NOINDEX_SOURCES.includes("/join/:path*"));
});

test("R-BETA-GATE: signed out, API routes answer 401", async () => {
  for (const p of ["/api/teacher/phases?urn=110110", "/api/view-as/caller", "/api/smt/school?urn=110110", "/api/feedback"]) {
    const g = await gate(p);
    assert.equal(g.res.status, 401, p);
  }
});

test("R-BETA-GATE: a forged or expired session, or a junk Bearer header, is not signed in", async () => {
  const forged = { ...session("x"), access_token: forgedToken("x"), refresh_token: "not-a-refresh-token" };
  assert.equal((await gate("/teacher", { cookie: sessionCookie(forged) })).res.status, 307);
  assert.equal((await gate("/api/teacher/phases", { authorization: `Bearer ${forgedToken("x")}` })).res.status, 401);
  assert.equal((await gate("/api/teacher/phases", { authorization: "Bearer not-a-jwt" })).res.status, 401);
  assert.equal((await gate("/api/teacher/phases", { authorization: `Bearer ${accessToken("x", "s", -60)}` })).res.status, 401);
});

test("R-BETA-GATE: signed in, school pages open, the landing page sends you home, and a script's verified Bearer passes", async () => {
  assert.ok((await gate("/schools/100053", signedIn())).passed);
  assert.ok((await gate("/teacher/smt", signedIn())).passed);
  const home = await gate("/", signedIn());
  assert.equal(home.location, "http://app.test/member");
  assert.ok((await gate("/api/teacher/phases?urn=1", { authorization: `Bearer ${accessToken("script-user")}` })).passed);
});

test("R-BETA-GATE: the preview route sits outside the gate (it is what signs the agent in) and fails closed itself", async () => {
  const { config } = await import("../proxy");
  assert.match(config.matcher, /api\/testing\/preview-session/);
  const { GET } = await import("../app/api/testing/preview-session/route");
  for (const k of ["PREVIEW_ACCESS_ENABLED", "PREVIEW_ACCESS_TOKEN", "PREVIEW_ACCESS_EMAIL", "PREVIEW_ACCESS_SITE_URL"]) delete process.env[k];
  assert.equal((await GET(new NextRequest("http://app.test/api/testing/preview-session?token=x"))).status, 404);
  // Working with its secret: R-COOKIE-SESSION's preview test (src/lib/auth-session.test.ts).
});

test("R-BETA-GATE: no Basic Auth remains (no realm, no ACCESS_GATE_* env, no gate-bypass cookie)", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts")) files.push(p);
    }
  };
  walk(join(root, "src"));
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/WWW-Authenticate|Basic realm|ACCESS_GATE_(ENABLED|USER|PASSWORD)|PREVIEW_GATE_COOKIE|vicdata_preview_gate/.test(s), f);
  }
});

test("R-BETA-GATE: Q4 -- a signed-in view of /schools/<urn> is counted, a signed-out request never reaches one", async () => {
  const prev = globalThis.fetch;
  const counted: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (u.includes("/rpc/count_public_page_view")) {
      counted.push(JSON.parse(String(init?.body)).p_urn);
      return new Response("null", { status: 200 });
    }
    return prev(input, init);
  }) as typeof fetch;
  try {
    const a = await gate("/schools/100053", { ...signedIn(), "user-agent": "Mozilla/5.0" });
    await Promise.all(a.waits);
    const b = await gate("/schools/100054", { "user-agent": "Mozilla/5.0" });
    await Promise.all(b.waits);
    assert.deepEqual(counted, ["100053"]);
  } finally {
    globalThis.fetch = prev;
  }
});

// ------------------------------------------------------------------ R-LANDING-MINIMAL

test("R-LANDING-MINIMAL: the landing page is the logo, Private beta and Sign in -- no search, no school names, no scripts", async () => {
  const { default: Landing, metadata } = await import("../app/page");
  const html = renderToStaticMarkup(Landing());
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  assert.equal(text, "V VicData Private beta Sign in");
  assert.ok(!/<input|<form|<script|<iframe|<img/i.test(html));
  assert.match(html, /href="\/login"/);
  // Metadata: a plain title, noindex, no description, Open Graph or Twitter.
  assert.deepEqual(metadata.title, { absolute: "VicData" });
  assert.deepEqual(metadata.robots, { index: false, follow: false, nocache: true });
  assert.ok(!("openGraph" in metadata) && !("twitter" in metadata) && !("description" in metadata));
  const layout = src("src/app/layout.tsx");
  assert.ok(!/description:|openGraph|twitter|<Script|next\/script|googletagmanager|plausible|analytics/i.test(layout.replace(/\/\/.*$/gm, "")));
  assert.ok(!/next\/script|<script/i.test(src("src/app/page.tsx")));
});

test("R-LANDING-MINIMAL: no site nav or footer on the landing page and sign-in, and both send X-Robots-Tag noindex", async () => {
  const { isBarePath } = await import("../components/front-door/BareRoutes");
  assert.ok(isBarePath("/") && isBarePath("/login") && isBarePath("/reset-password"));
  assert.ok(!isBarePath("/teacher") && !isBarePath("/schools/100053") && !isBarePath("/join/110110"));
  const { default: cfg } = await import("../../next.config");
  const headers = await cfg.headers!();
  for (const p of ["/", "/login"]) assert.ok(headers.some((h) => h.source === p && h.headers.some((x) => x.key === "X-Robots-Tag" && x.value === "noindex, nofollow")), p);
});

// ------------------------------------------------------------------ R-NOINDEX-SCHOOLS (A3, kept)

test("R-NOINDEX-SCHOOLS: with ALLOW_INDEXING=true a school page still sends X-Robots-Tag noindex and page-level noindex", async () => {
  process.env.ALLOW_INDEXING = "true";
  const { default: cfg } = await import("../../next.config");
  const headers = await cfg.headers!();
  for (const p of ["/schools/:path*", "/join/:path*", "/sets", "/sets/:path*", "/teacher/:path*", "/dashboards/:path*", "/member/:path*"]) {
    assert.ok(headers.some((h) => h.source === p && h.headers.some((x) => x.key === "X-Robots-Tag" && x.value === "noindex, nofollow")), p);
  }
  for (const seg of ["schools", "join", "sets", "teacher", "dashboards", "member"]) {
    const { metadata } = (await import(`../app/${seg}/layout`)) as { metadata: { robots: unknown } };
    assert.deepEqual(metadata.robots, { index: false, follow: false, nocache: true }, seg);
  }
});

test("R-NOINDEX-SCHOOLS: the sitemap lists no school page and robots.txt has no Disallow for them", async () => {
  process.env.ALLOW_INDEXING = "true";
  const { default: sitemap } = await import("../app/sitemap");
  assert.deepEqual(sitemap(), []);
  const { default: robots } = await import("../app/robots");
  const r = robots();
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  assert.ok(rules.every((x) => !x.disallow), "a crawler that can't fetch a page never sees its noindex");
  delete process.env.ALLOW_INDEXING;
});

test("R-LANDING-MINIMAL: each landing background is decoration only -- hidden from assistive tech, no text, no links; one constant picks it", async () => {
  const { LandingArt, SpectrumLine } = await import("../components/auth/LandingArt");
  for (const v of ["bands", "bands-long", "bars", "arcs", "spectrum"] as const) {
    const html = renderToStaticMarkup(LandingArt({ variant: v }) ?? "");
    assert.equal(html.replace(/<[^>]+>/g, "").trim(), "", v);
    assert.ok(!/<a |href=|<script|<img/i.test(html), v);
    if (html) assert.match(html, /aria-hidden/, v);
  }
  assert.match(renderToStaticMarkup(SpectrumLine({})), /aria-hidden/);
  assert.match(src("src/components/auth/landing-variant.ts"), /export const LANDING_VARIANT: LandingVariant = "bands";/);
  assert.match(src("src/app/globals.css"), /@media \(prefers-reduced-motion: no-preference\) \{\s*\.landing-arc \{ animation/, "the one movement is off under reduced motion");
  assert.match(src("src/app/globals.css"), /@media \(prefers-reduced-motion: no-preference\) \{\s*\.landing-bar \{ transform-origin: left center; animation/, "the bars grow only without reduced motion");
  // "bands" (the default): v1 exactly as first committed (970b4892) -- five ribbons of one length, fanned across the
  // lower right, 16% Light / 20% Dark, still, no reserved space (Guy, 22 Nov: "looked better").
  const v1 = renderToStaticMarkup(LandingArt({ variant: "bands" }) ?? "");
  assert.match(v1, /-bottom-\[30%\] -right-\[25%\] h-\[90%\] w-\[90%\] rotate-\[-24deg\] sm:-right-\[10%\] sm:w-\[70%\]/);
  assert.equal((v1.match(/opacity-\[0\.16\] dark:opacity-\[0\.2\]/g) ?? []).length, 5);
  assert.deepEqual([...v1.matchAll(/top:(\d+)%/g)].map((m) => Number(m[1])), [18, 31, 44, 57, 70]);
  assert.ok(!/landing-bar|landing-arc/.test(v1), "v1 doesn't move");
  // "bands-long" (v3) and "bars" (v2): five bars of different lengths; v3 diagonal behind the content, v2 in a
  // strip the page reserves below its content.
  for (const v of ["bands-long", "bars"] as const) {
    const html = renderToStaticMarkup(LandingArt({ variant: v }) ?? "");
    const widths = [...html.matchAll(/width:(\d+)%/g)].map((m) => Number(m[1]));
    assert.equal(widths.length, 5, v);
    assert.equal(new Set(widths).size, 5, `${v}: every bar a different length`);
  }
  assert.match(renderToStaticMarkup(LandingArt({ variant: "bands-long" }) ?? ""), /rotate-\[-24deg\]/, "v3 is diagonal");
  const page = src("src/app/page.tsx");
  assert.match(page, /LANDING_VARIANT === "bars" \? BANDS_RESERVE : "pb-16"/, "bars reserves its strip; the others keep v1's py-16");
  // "Private beta": v1's colours where nothing passes behind it (measured 4.54 Light / 7.66 Dark, worst pixel, the bare
  // page); one shade stronger only under "bands-long", whose bars cross behind it.
  assert.match(page, /const BETA_TEXT = LANDING_VARIANT === "bands-long" \? "text-neutral-600 dark:text-neutral-300" : "text-neutral-500 dark:text-neutral-400";/);
});
