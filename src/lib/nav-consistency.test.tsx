// R-NAV-ONE and R-NAV-FEEDBACK (0.8 nav consistency, Guy 21 Nov): one nav on every page, and "Send feedback" in it.
// Run: node --env-file=.env --env-file=.env.local --import tsx --test src/lib/nav-consistency.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NAV_ROUTES, navModeFor } from "../components/shell/nav-routes";
import { NavFeedbackButton, NAV_FEEDBACK_COLOURS, NAV_FEEDBACK_LABEL, navPageName, navProduct, navSurface } from "../components/feedback/NavFeedbackButton";
import { FeedbackIcon } from "../components/feedback/FeedbackButton";
import { resetFeedbackStore } from "../components/feedback/store";
import { feedbackPayload, type FormState } from "../components/feedback/FeedbackWindow";
import { feedbackRow } from "./feedback-server";
import { pageKey } from "./view-ref";
import { SEL, tokensOf } from "./front-door/contrast";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const pages = walk(join(ROOT, "src/app"))
  .filter((p) => p.endsWith("/page.tsx"))
  .map((p) => "/" + relative(join(ROOT, "src/app"), p).replace(/\/?page\.tsx$/, ""))
  .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));

// The components a page draws, by its @/components imports, one level deep (the page and the components it imports).
function tree(file: string, depth = 1, seen = new Set<string>()): string[] {
  if (seen.has(file) || !existsSync(file)) return [];
  seen.add(file);
  const src = readFileSync(file, "utf8");
  const out = [src];
  if (depth === 0) return out;
  for (const m of src.matchAll(/from "@\/components\/([^"]+)"/g)) {
    for (const ext of [".tsx", ".ts", "/index.tsx"]) {
      const f = join(ROOT, "src/components", m[1] + ext);
      if (existsSync(f)) {
        out.push(...tree(f, depth - 1, seen));
        break;
      }
    }
  }
  return out;
}
const DRAWS_NAV = /<(TeacherNav|AdmissionsTeacherNav|PhoneNav|HomeFrame)\b/;
const pageFile = (route: string) => join(ROOT, "src/app", route === "/" ? "" : route.slice(1), "page.tsx");

test("R-NAV-ONE: every page says how it gets the nav, and nothing else is listed", () => {
  for (const r of pages) assert.ok(r in NAV_ROUTES, `${r}: not in nav-routes.ts -- say whether it draws the nav itself (own), the layout draws it (host), or it is a walk`);
  for (const r of Object.keys(NAV_ROUTES)) assert.ok(pages.includes(r), `${r}: listed in nav-routes.ts but there is no such page`);
});

test("R-NAV-ONE: the root layout draws the one nav host, and the host draws TeacherNav and nothing else", () => {
  const layout = read("src/app/layout.tsx");
  assert.equal((layout.match(/<NavBar\b/g) ?? []).length, 1);
  const bar = read("src/components/NavBar.tsx");
  assert.match(bar, /<TeacherNav\b/);
  assert.match(bar, /navModeFor\(pathname\) !== "host"\) return null/);
  // The retired site bar's own links and header are gone.
  assert.doesNotMatch(bar, /<header\b|href="\/sets"|href="\/member"|href="\/account"|href="\/login"/);
});

test("R-NAV-ONE: a page that draws its own nav draws TeacherNav; a hosted page doesn't (no second header)", () => {
  for (const [route, mode] of Object.entries(NAV_ROUTES)) {
    const src = tree(pageFile(route)).join("\n");
    if (mode === "own") assert.match(src, DRAWS_NAV, `${route}: listed as drawing its own nav, but draws no TeacherNav`);
    if (mode === "host") assert.doesNotMatch(src, DRAWS_NAV, `${route}: the layout draws the nav here, and so does the page -- two headers`);
    if (mode === "walk") assert.match(src, /<WalkHeader\b/, `${route}: a walk draws its own band`);
  }
});

test("R-NAV-ONE: the address decides the nav, a literal page before a dynamic one", () => {
  assert.equal(navModeFor("/teacher/smt"), "own");
  assert.equal(navModeFor("/teacher/ks4"), "own");
  assert.equal(navModeFor("/teacher/smt/academic/"), "own");
  assert.equal(navModeFor("/teacher/walk/gcse-many"), "walk");
  assert.equal(navModeFor("/teacher/meetings/abc-123"), "host");
  assert.equal(navModeFor("/teacher/people"), "host");
  assert.equal(navModeFor("/teacher/school-account/membership"), "host");
  assert.equal(navModeFor("/sets/guided"), "host");
  assert.equal(navModeFor("/no-such-page"), "host");
});

test("R-NAV-ONE: one VicData wordmark, TeacherNav's, going to the person's home", () => {
  const ALLOWED = new Set(["src/components/shell/TeacherNav.tsx", "src/components/auth/AuthShell.tsx"]);
  for (const f of walk(join(ROOT, "src")).filter((p) => p.endsWith(".tsx") && !/\.test\.tsx$/.test(p))) {
    const rel = relative(ROOT, f);
    if (ALLOWED.has(rel)) continue;
    assert.doesNotMatch(readFileSync(f, "utf8"), />\s*VicData\s*<\/(Link|a)>/, `${rel}: a second VicData wordmark`);
  }
  const nav = read("src/components/shell/TeacherNav.tsx");
  assert.match(nav, /href=\{signedIn === false \? "\/" : "\/teacher"\}/);
  // The account menu holds Sets (the retired site bar's item) for everyone signed in.
  assert.match(nav, /<Link href="\/sets" data-nav-sets=""/);
});

test("R-NAV-FEEDBACK: Send feedback sits in the desktop and phone navs, before Account, and in a walk's band", () => {
  const nav = read("src/components/shell/TeacherNav.tsx");
  const both = nav.match(/<NavFeedbackButton( className="[^"]*")? \/>\s*<AccountMenu \/>/g) ?? [];
  assert.equal(both.length, 2, "the desktop nav and the phone row (TeacherNav's and PhoneNav's): Send feedback, then Account");
  assert.match(nav, /<NavPhoneRow theme=\{theme\} onTheme=\{onTheme\} className="sm:hidden" \/>/, "every page's phone row");
  assert.match(read("src/components/front-door/WalkPage.tsx"), /<NavFeedbackButton \/>/);
  // The existing icon, imported, not a lookalike.
  assert.match(read("src/components/feedback/NavFeedbackButton.tsx"), /import \{ FeedbackIcon \} from "\.\/FeedbackButton"/);
});

const SURFACE = navSurface({ path: "/sets/guided", urn: "110110", name: "Leighton Park School", role: "member", viewAs: false, peek: false });

test("R-NAV-FEEDBACK: drawn for those the feedback setting lets in, named, 44 px on a phone, the dashboards' icon", () => {
  resetFeedbackStore({ status: "ready", allowed: false, items: [], page: SURFACE });
  assert.equal(renderToStaticMarkup(createElement(NavFeedbackButton)), "", "not let in: nothing");
  resetFeedbackStore({ status: "ready", allowed: true, items: [], page: SURFACE });
  const html = renderToStaticMarkup(createElement(NavFeedbackButton));
  assert.match(html, /<button type="button" data-nav-feedback="" aria-label="Send feedback"/);
  assert.match(html, /class="[^"]*\bh-11 min-w-11\b[^"]*sm:h-\[34px\]/, "44 px hit area below sm");
  assert.ok(html.includes(renderToStaticMarkup(FeedbackIcon)), "the same svg as every view's feedback icon");
  assert.match(html, /bg-\[var\(--nav-fb-fill\)\][^"]*text-\[var\(--nav-fb-ink\)\]/);
  assert.equal(NAV_FEEDBACK_LABEL, "Send feedback");
  resetFeedbackStore();
});

// WCAG relative luminance.
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test("R-NAV-FEEDBACK: amber with legible ink, and a pill that stands off the bar in Light and Dark", () => {
  const C = NAV_FEEDBACK_COLOURS;
  assert.ok(ratio(C.ink, C.fill) >= 7, `ink on amber ${ratio(C.ink, C.fill).toFixed(2)}`);
  // The bar's backgrounds: Light #f7f7f8 (and white panels), Dark #0a0a0b.
  for (const bg of ["#f7f7f8", "#ffffff"]) assert.ok(ratio(C.edgeLight, bg) >= 3, `Light edge on ${bg}: ${ratio(C.edgeLight, bg).toFixed(2)}`);
  assert.ok(ratio(C.edgeDark, "#0a0a0b") >= 3, `Dark edge: ${ratio(C.edgeDark, "#0a0a0b").toFixed(2)}`);
  const css = read("src/app/globals.css");
  assert.ok(css.includes(`--nav-fb-fill: ${C.fill}; --nav-fb-ink: ${C.ink}; --nav-fb-edge: ${C.edgeLight};`));
  assert.ok(css.includes(`--nav-fb-edge: ${C.edgeDark};`));
});

const FORM: FormState = { kinds: [], importance: null, scope: null, applies: null, where: [], area: ["layout"], saw: "", expected: "", text: "The map is too small" };

test("R-NAV-FEEDBACK: on a page with no surface of its own, the item records the page, the school and the role", () => {
  assert.equal(SURFACE.product, "home");
  assert.equal(SURFACE.dashboard.id, "nav:/sets/guided");
  assert.equal(SURFACE.dashboard.name, "Sets · guided");
  assert.deepEqual(SURFACE.scope, { kind: "school", urn: "110110", name: "Leighton Park School" });
  assert.equal(SURFACE.noteScope, null);
  assert.equal(navProduct("/teacher/smt/academic"), "smt");
  assert.equal(navProduct("/teacher/admissions/team"), "admissions");
  assert.equal(navProduct("/teacher/group/access"), "group");
  assert.equal(navProduct("/teacher/meetings/abc"), "meeting");
  assert.equal(navProduct("/account"), "home");
  assert.equal(navPageName("/teacher/school-account/membership"), "School account · membership");
  assert.equal(navPageName("/sets/0d6f7c1e-2b9a-4b1e-9b7e-1c2d3e4f5a6b"), "Sets · one");
  const target = { view: { panelId: "", panelName: null, instanceId: "", dataview: null, label: SURFACE.dashboard.name }, viewKey: pageKey(SURFACE.dashboard.id), page: true };
  const p = feedbackPayload(SURFACE, target, FORM, { path: "/sets/guided", search: "?kind=feeders", width: 390, theme: "dark" });
  assert.equal(p.view_key, "page:nav:/sets/guided");
  const r = feedbackRow(p, "abc");
  assert.ok("row" in r, "the server takes it as a page item, with no new column or product");
  assert.equal(r.row.product, "home");
  assert.equal(r.row.school_urn, "110110");
  assert.equal(r.row.page_path, "/sets/guided");
  assert.equal(r.row.page_query, "kind=feeders");
  assert.equal(r.row.panel_id, null);
});

test("R-NAV-ONE: the nav the layout draws takes #teacher-root's tokens, Light and Dark", () => {
  const css = read("src/app/globals.css");
  const nav = { light: tokensOf(css, "[data-shell-nav]"), dark: tokensOf(css, '[data-shell-nav][data-theme="dark"]') };
  const root = { light: tokensOf(css, SEL.light), dark: tokensOf(css, SEL.dark) };
  for (const theme of ["light", "dark"] as const) {
    assert.ok(Object.keys(nav[theme]).length >= 10, theme);
    for (const [k, v] of Object.entries(nav[theme])) assert.equal(v, root[theme][k], `${theme} ${k}`);
  }
});
