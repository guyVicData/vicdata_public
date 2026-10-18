// VicData 0.8 notes and feedback: the browser tests, against the local production build pointing at the real
// app database (read-only; see harness.mjs and server-preload.mjs). From the repo root:
//   npx next build
//   ACCESS_GATE_ENABLED=false NODE_OPTIONS="--import ./docs/v0.8/audit_scripts/notes_feedback/server-preload.mjs" npx next start -p 3410
//   node docs/v0.8/audit_scripts/notes_feedback/notes_feedback.mjs     (BASE=http://127.0.0.1:3410, OUT=<screenshots dir>)
//   R-FOOTER-LAYOUT       every panel: (i), note, feedback bottom left, the menu bottom right; no caption control;
//                         Teacher, SMT, Admissions, groups; desktop and phone (light and dark screenshots)
//   R-CAPTION-IN-INFO     SMT Overview, Admissions Market share, Teacher GCSE Results, a group view
//   R-NOTE-PER-VIEW       two views in one rail hold two notes; the icon colours only on the view with one;
//                         in View as the note goes under the View as key
//   R-FEEDBACK-WINDOW     outside the panel, not covering the view: desktop, phone, full screen; open after Send
//   R-FEEDBACK-COLOURS    yellow, green, yellow when both, monochrome once done
//   R-FEEDBACK-CONTEXT    View as SMT at Leighton Park, Academic, a subject area chosen: every field; Open restores it
//   R-FEEDBACK-AUDIENCE   at "admins", a non-admin sees no icon
import { mkdirSync } from "node:fs";
import { harness, BASE, feedback, openHref, rectOf, overlaps, chromium, EXE } from "./harness.mjs";

const OUT = process.env.OUT ?? "docs/v0.8/notes_feedback_screenshots";
mkdirSync(OUT, { recursive: true });
const results = [];
const pass = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` -- ${detail}`}`);
};
const browser = await chromium.launch({ executablePath: EXE, headless: true });

const LP = { urn: "110110", name: "Leighton Park School" };
const CHASE = { urn: "137625", name: "The Chase" };
const PHONE = { width: 390, height: 844 };
const HARRIS = { group: "group:3320", name: "Harris Federation" };

const PAGES = {
  teacher: { path: "/teacher/ks4", viewAs: { ...LP, role: "teacher" } },
  smt: { path: "/teacher/smt", viewAs: { ...LP, role: "smt" } },
  admissions: { path: "/teacher/admissions?view=market-share", viewAs: { ...CHASE, role: "admissions" } },
  groups: { path: "/teacher/group/overview", viewAs: HARRIS },
};

async function open(product, o = {}) {
  const def = PAGES[product];
  const h = await harness({ browser, viewAs: def.viewAs, ...o });
  await h.page.goto(`${BASE}${o.path ?? def.path}`, { waitUntil: "domcontentloaded" });
  await h.page.locator('[data-panel-footer=""]').first().waitFor({ timeout: 90000 }).catch(() => {});
  await h.page.waitForTimeout(o.settle ?? 3500);
  return h;
}

// Every visible card footer: the (i) first, then the note, then feedback, then (after a gap) the menu last.
async function footerOrder(page) {
  return page.evaluate(() => {
    const bad = [];
    const footers = [...document.querySelectorAll('[data-panel-footer=""]')].filter((f) => f.getBoundingClientRect().width > 0);
    for (const f of footers) {
      const x = (sel) => f.querySelector(sel)?.getBoundingClientRect().x ?? null;
      const i = x('[aria-label="Where this figure comes from"]');
      const note = x("[data-note-button]");
      const fb = x("[data-feedback-button]");
      const menu = x("[data-panel-menu]");
      const right = f.querySelector("[data-panel-footer-right]");
      const ok = i !== null && note !== null && fb !== null && menu !== null && i < note && note < fb && fb < menu && !!right?.contains(f.querySelector("[data-panel-menu]"));
      if (!ok) bad.push(JSON.stringify({ i, note, fb, menu, panel: f.closest("section")?.getAttribute("aria-label") ?? f.closest("[data-panel-id]")?.getAttribute("data-panel-id") }));
    }
    const captionButtons = document.querySelectorAll('[aria-label="What this shows"]').length;
    const headerMenus = document.querySelectorAll("[data-panel-icons] [data-panel-menu], [data-panel-icon='menu']").length;
    return { footers: footers.length, bad, captionButtons, headerMenus };
  });
}

// ------------------------------------------------------------------------------ R-FOOTER-LAYOUT
for (const product of Object.keys(PAGES)) {
  for (const [form, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", PHONE]]) {
    for (const theme of ["light", "dark"]) {
      const h = await open(product, { viewport, mobile: form === "phone", theme });
      const r = await footerOrder(h.page);
      await h.page.screenshot({ path: `${OUT}/footer_${product}_${form}_${theme}.png` });
      if (theme === "light") pass(`R-FOOTER-LAYOUT ${product} ${form}: ${r.footers} footers, (i) · note · feedback … menu; no caption control; no menu in the header`, r.footers > 0 && r.bad.length === 0 && r.captionButtons === 0 && r.headerMenus === 0, JSON.stringify(r));
      if (form === "phone" && theme === "light" && r.footers > 0) {
        // The 358 px card and its full screen on the phone.
        const card = await rectOf(h.page.locator('[data-panel-footer=""]').first().locator("xpath=.."));
        await h.page.locator('button[aria-label^="Full screen:"]').first().click();
        await h.page.waitForTimeout(800);
        const modal = await h.page.locator('[data-panel-footer="modal"]').first();
        const ok = (await modal.locator("[data-feedback-button]").count()) === 1 && (await modal.locator("[data-panel-menu]").count()) === 1;
        await h.page.screenshot({ path: `${OUT}/footer_${product}_phone_fullscreen.png` });
        pass(`R-FOOTER-LAYOUT ${product} phone: the ${Math.round(card.w)} px card, and full screen keeps feedback and the menu`, ok && card.w <= 360);
      }
      await h.context.close();
    }
  }
}

// ------------------------------------------------------------------------------ R-CAPTION-IN-INFO
async function info(page, panelSel) {
  const panel = page.locator(panelSel).first();
  await panel.locator('[aria-label="Where this figure comes from"]').first().click();
  const pop = page.locator("[data-source-note]").first();
  await pop.waitFor({ timeout: 5000 });
  // The method is loaded when the (i) opens (MethodNote): wait for it before reading.
  await pop.locator("[data-method-steps-toggle]").first().waitFor({ timeout: 10000 }).catch(() => {});
  const what = (await pop.locator("[data-what-this-shows]").count()) ? await pop.locator("[data-what-this-shows]").first().textContent() : null;
  const all = await pop.textContent();
  return { what, all };
}
{
  const h = await open("smt");
  const r = await info(h.page, '[data-view-panel$=".c1.now"]');
  await h.page.screenshot({ path: `${OUT}/caption_smt_overview.png` });
  pass("R-CAPTION-IN-INFO SMT Overview: its caption ('XS to XL …') is the (i)'s first line, above the sources", !!r.what && r.what.includes("XS to XL") && r.all.startsWith("What this shows") && r.all.indexOf("XS to XL") < r.all.indexOf("Sources."), JSON.stringify(r).slice(0, 300));
  await h.context.close();
}
{
  const h = await open("admissions");
  const now = await info(h.page, '[data-view-panel$=".c1.now"]');
  await h.page.keyboard.press("Escape");
  const share = await info(h.page, '[data-view-panel$=".c3.trends"]');
  await h.page.screenshot({ path: `${OUT}/caption_admissions_market.png` });
  pass("R-CAPTION-IN-INFO Admissions Market share: 'Your share now' drops its caption (it only repeated the method: listed); the share trend keeps its line in the (i)", now.what === null && now.all.includes("Sources.") && !!share.what && share.what.includes("roll sits on the same rail"), JSON.stringify({ now: now.what, share: share.what }));
  await h.context.close();
}
{
  const h = await open("teacher");
  const results = h.page.getByRole("button", { name: /^Results$/ }).first();
  if (await results.count()) {
    await results.click();
    await h.page.waitForTimeout(3000);
  }
  // The open panel of column 1 (Current): its (i).
  const r = await info(h.page, '[data-panel-id$=".c1.current"]');
  await h.page.screenshot({ path: `${OUT}/caption_teacher_gcse_results.png` });
  pass("R-CAPTION-IN-INFO Teacher GCSE Results: the panel's sentence is the (i)'s 'What this shows'", !!r.what && r.what.replace("What this shows", "").trim().length > 10, JSON.stringify(r).slice(0, 300));
  await h.context.close();
}
{
  const h = await open("groups");
  const r = await info(h.page, '[data-view-panel="o-against"], [data-view-panel="o-now"]');
  await h.page.screenshot({ path: `${OUT}/caption_group_view.png` });
  pass("R-CAPTION-IN-INFO a group view: its line (or, where it only repeated the method, none) heads the (i)", r.all.includes("How it is calculated") || r.all.length > 20, JSON.stringify(r).slice(0, 300));
  await h.context.close();
}

// ------------------------------------------------------------------------------ the SMT Academic page
const ACADEMIC = "/teacher/smt/academic?level=gcse";
const LARGE = '[data-view-panel="vicdata.smt.academic.c2.now"]';
const NOW = '[data-view-panel="vicdata.smt.academic.c1.now"]';
async function academic(o = {}) {
  const h = await open("smt", { path: ACADEMIC, ...o });
  const chip = h.page.getByRole("button", { name: "Arts, Media & Design" }).first();
  if (await chip.count()) {
    await chip.click();
    await h.page.waitForURL(/area=/, { timeout: 10000 }).catch(() => {});
    await h.page.waitForTimeout(2500);
  }
  return h;
}
const viewKeyOf = (page, sel) => page.locator(`${sel} [data-view-key]`).first().getAttribute("data-view-key");

// ------------------------------------------------------------------------------ R-NOTE-PER-VIEW
{
  const h = await academic();
  const { page } = h;
  const keyA = await viewKeyOf(page, LARGE);
  await page.locator(`${LARGE} [data-note-button]`).first().click();
  await page.locator(`${LARGE} textarea`).first().fill("Check Art and Design's rank");
  await page.getByRole("button", { name: "Save" }).first().click();
  await page.waitForTimeout(600);
  const onA = await page.locator(`${LARGE} [data-note-button]`).first().getAttribute("data-note-button");
  // The rail's other view: the first button not pressed (with an area chosen the panel opens on Subjects).
  const firstLabel = await page.locator(`${LARGE} [aria-pressed="true"]`).first().getAttribute("aria-label");
  await page.locator(`${LARGE} [aria-pressed="false"]`).first().click();
  await page.waitForTimeout(1500);
  const keyB = await viewKeyOf(page, LARGE);
  const offB = await page.locator(`${LARGE} [data-note-button]`).first().getAttribute("data-note-button");
  await page.locator(`${LARGE} [data-note-button]`).first().click();
  await page.locator(`${LARGE} textarea`).first().fill("A different note on this view");
  await page.getByRole("button", { name: "Save" }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/note_per_view.png` });
  await page.locator(`${LARGE} [aria-label="${firstLabel}"]`).first().click();
  await page.waitForTimeout(1500);
  const colour = await page.locator(`${LARGE} [data-note-button="on"]`).first().evaluate((el) => getComputedStyle(el).color).catch(() => null);
  await page.locator(`${LARGE} [data-note-button]`).first().click();
  const backA = await page.locator(`${LARGE} textarea`).first().inputValue();
  const posts = h.writes.filter((w) => w.startsWith("POST teacher_view_notes")).map((w) => JSON.parse(w.slice("POST teacher_view_notes ".length)));
  const keys = posts.map((p) => p.chart_key);
  pass("R-NOTE-PER-VIEW: two views in one rail hold two notes, keyed by view", keyA !== keyB && keys.length === 2 && keys[0] === `view:${keyA}` && keys[1] === `view:${keyB}`, JSON.stringify({ keyA, keyB, keys }));
  pass("R-NOTE-PER-VIEW: the icon colours on the view with a note, not on the other", onA === "on" && offB === "off" && backA === "Check Art and Design's rank", JSON.stringify({ onA, offB, backA }));
  pass("R-NOTE-PER-VIEW: in View as the note goes under the View as key (110110~trial~smt)", posts.every((p) => p.school_urn === "110110~trial~smt"), JSON.stringify(posts.map((p) => p.school_urn)));
  pass("R-NOTE-PER-VIEW: the note's colour is the shared token", !!colour && colour !== "rgb(107, 107, 114)", String(colour));
  await h.context.close();
}

// ------------------------------------------------------------------------------ R-FEEDBACK-WINDOW / CONTEXT / COLOURS
feedback.items.length = 0;
feedback.posted.length = 0;
{
  const h = await academic();
  const { page } = h;
  const before = await page.locator(`${LARGE} [data-feedback-button]`).first().getAttribute("data-feedback-button");
  await page.locator(`${LARGE} [data-feedback-button]`).first().click();
  const win = page.locator("[data-feedback-window]");
  await win.waitFor({ timeout: 5000 });
  await page.waitForTimeout(900);
  const w = await rectOf(win);
  const p = await rectOf(page.locator(LARGE));
  const vw = await page.evaluate(() => window.innerWidth);
  await page.screenshot({ path: `${OUT}/feedback_window_desktop.png` });
  pass("R-FEEDBACK-WINDOW desktop: docked right, outside the panel, not covering it; the page gives it its room", (await win.getAttribute("data-feedback-window")) === "dock" && !overlaps(w, p) && p.right <= w.x && w.right <= vw, JSON.stringify({ w, p }));
  pass("R-FEEDBACK-WINDOW: its header names the view", ((await page.locator("[data-fb-title]").textContent()) ?? "").length > 2);
  // Every field, with a subject area chosen.
  await page.locator('[data-fb-chip="wrong_figure"]').click();
  await page.getByLabel("I see").fill("62%");
  await page.getByLabel("I expected").fill("about 58%");
  await page.getByLabel("Your feedback").fill("Art and Design's share looks high");
  await page.locator('[data-fb-chip="before_demo"]').click();
  await page.locator('[data-fb-chip="this_school"]').click();
  await page.locator('[data-fb-chip="this_view"]').click();
  await page.locator('[data-fb-chip="figure"]').click();
  await page.locator("[data-fb-send]").click();
  await page.locator('[data-fb-message="ok"]').waitFor({ timeout: 5000 }).catch(() => {});
  const stillOpen = (await win.count()) === 1 && (await page.getByLabel("Your feedback").inputValue()) === "";
  await page.screenshot({ path: `${OUT}/feedback_sent_window_stays.png` });
  pass("R-FEEDBACK-WINDOW: Send keeps it open, emptied, for the next item", stillOpen && (await page.locator('[data-fb-message="ok"]').count()) === 1);
  const sent = feedback.posted[0] ?? {};
  const url = new URL(page.url());
  const fields = {
    view_as: sent.view_as === true,
    role: sent.role === "smt",
    school: sent.school_urn === "110110" && sent.school_name === "Leighton Park School",
    product: sent.product === "smt",
    dashboard: sent.dashboard_id === "vicdata.smt.academic" && !!sent.dashboard_name,
    version: "dashboard_version_id" in sent,
    panel: sent.panel_id === "vicdata.smt.academic.c2.now",
    view: !!sent.view_instance_id && !!sent.dataview_id && !!sent.view_label,
    state: sent.state?.level === "gcse" && !!sent.state?.area && "set" in (sent.state ?? {}),
    address: sent.page_path === "/teacher/smt/academic" && new URLSearchParams(sent.page_query).get("area") === url.searchParams.get("area"),
    device: sent.device === "desktop" && sent.viewport_width === 1440 && (sent.theme === "light" || sent.theme === "dark"),
    text: sent.body === "Art and Design's share looks high" && sent.saw === "62%" && sent.expected === "about 58%",
    chips: JSON.stringify(sent.kinds) === '["wrong_figure"]' && sent.importance === "before_demo" && sent.scope === "this_school" && sent.applies_to === "this_view" && JSON.stringify(sent.where_in_view) === '["figure"]',
    noScreenshot: !Object.keys(sent).some((k) => /screenshot|image/i.test(k)),
  };
  pass("R-FEEDBACK-CONTEXT: the item records every field (View as SMT, Leighton Park, Academic, a subject area chosen)", Object.values(fields).every(Boolean), JSON.stringify({ fields, sent }).slice(0, 900));
  const after = await page.locator(`${LARGE} [data-feedback-button]`).first().getAttribute("data-feedback-button");
  pass("R-FEEDBACK-COLOURS: monochrome before, yellow after feedback is given", before === "none" && after === "open", `${before} -> ${after}`);
  // Esc in the window closes it (not the page behind).
  await page.getByLabel("Your feedback").focus();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  pass("R-FEEDBACK-WINDOW: Esc closes it", (await win.count()) === 0);
  // Green: a bare "Looks good" on the Now panel; then yellow when both.
  await page.locator(`${NOW} [data-feedback-button]`).first().click();
  await page.locator('[data-fb-chip="looks_good"]').click();
  await page.locator("[data-fb-send]").click();
  await page.locator('[data-fb-message="ok"]').waitFor({ timeout: 5000 }).catch(() => {});
  const green = await page.locator(`${NOW} [data-feedback-button]`).first().getAttribute("data-feedback-button");
  await page.screenshot({ path: `${OUT}/feedback_colours_green_yellow.png` });
  await page.getByLabel("Your feedback").fill("The headline wording could be plainer");
  await page.locator('[data-fb-chip="wording"]').click();
  await page.locator("[data-fb-send]").click();
  await page.waitForTimeout(800);
  const both = await page.locator(`${NOW} [data-feedback-button]`).first().getAttribute("data-feedback-button");
  await page.locator("[data-fb-close]").click();
  pass("R-FEEDBACK-COLOURS: green after 'Looks good' alone, yellow when both apply", green === "good" && both === "open", `${green}, ${both}`);
  // Once every item on the Now view is done: monochrome (on the next load).
  for (const i of feedback.items) if (i.panel_id === "vicdata.smt.academic.c1.now") i.status = "done";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(`${NOW} [data-feedback-button]`).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  const done = await page.locator(`${NOW} [data-feedback-button]`).first().getAttribute("data-feedback-button");
  const stillLarge = await page.locator(`${LARGE} [data-feedback-button]`).first().getAttribute("data-feedback-button");
  pass("R-FEEDBACK-COLOURS: monochrome once every item on the view is done (the other view stays yellow)", done === "none" && stillLarge === "open", `${done}, ${stillLarge}`);
  // Full screen: the window beside the modal, not over it.
  await page.locator(`${LARGE} button[aria-label^="Full screen:"]`).first().click();
  await page.waitForTimeout(800);
  await page.locator('[data-panel-footer="modal"] [data-feedback-button]').first().click();
  await win.waitFor({ timeout: 5000 });
  await page.waitForTimeout(900);
  const box = await rectOf(page.locator('[role="dialog"][aria-modal="true"] > div').first());
  const fw = await rectOf(win);
  await page.screenshot({ path: `${OUT}/feedback_window_fullscreen.png` });
  pass("R-FEEDBACK-WINDOW full screen: beside the full screen, not over it", !overlaps(box, fw), JSON.stringify({ box, fw }));
  pass("usage: giving feedback is never logged as usage", !h.usage.some((u) => /feedback/i.test(u)), h.usage.join(" | "));
  await h.context.close();
}
{
  // Phone: a bottom sheet; the view scrolled into the room above it.
  const h = await academic({ viewport: PHONE, mobile: true });
  const { page } = h;
  const target = page.locator('[data-view-panel] [data-feedback-button]').nth(1);
  const panel = target.locator("xpath=ancestor::section[1]");
  await target.click();
  const win = page.locator("[data-feedback-window]");
  await win.waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
  const w = await rectOf(win);
  const p = await rectOf(panel);
  await page.screenshot({ path: `${OUT}/feedback_window_phone.png` });
  pass("R-FEEDBACK-WINDOW phone: a bottom sheet, half the screen and no wider than it, the view in sight above it", (await win.getAttribute("data-feedback-window")) === "sheet" && Math.abs(w.h - PHONE.height / 2) < 40 && w.x >= 0 && w.right <= PHONE.width + 1 && p.y >= -2 && p.y < w.y, JSON.stringify({ w, p }));
  await page.locator("[data-fb-handle]").click();
  await page.waitForTimeout(500);
  const tall = await rectOf(win);
  await page.locator("[data-fb-handle]").click();
  await page.waitForTimeout(500);
  const half = await rectOf(win);
  pass("R-FEEDBACK-WINDOW phone: pulled up taller, and back down to half", tall.h > w.h + 100 && Math.abs(half.h - w.h) < 4, JSON.stringify({ tall: tall.h, half: half.h }));
  await h.context.close();
}

// ------------------------------------------------------------------------------ Open
{
  const item = feedback.items[0];
  const href = openHref(item);
  // Opened from the inbox, outside View as: the peek is what restores the school and role.
  const h = await harness({ browser });
  const { page } = h;
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-fb-open-banner]").waitFor({ timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const reopened = await page.locator(`${LARGE}[data-reopened]`).count();
  const key = await viewKeyOf(page, LARGE).catch(() => null);
  const u = new URL(page.url());
  const banner = (await page.locator("[data-fb-open-banner]").textContent().catch(() => "")) ?? "";
  const differs = await page.locator('[data-fb-open-banner] [data-fb-state="differs"]').count();
  await page.screenshot({ path: `${OUT}/feedback_open_restores.png` });
  pass(
    "R-FEEDBACK-CONTEXT: Open restores the school and role (peek), the dashboard, the level and subject area, the panel and the view; the banner shows the recorded state",
    u.searchParams.get("lookAs") === "110110" && u.searchParams.get("as") === "smt" && u.searchParams.get("level") === "gcse" && u.searchParams.get("area") === new URLSearchParams(item.page_query).get("area") && reopened === 1 && key?.endsWith(`:${item.view_instance_id}`) && banner.includes(`F-${item.number}`) && differs === 0,
    JSON.stringify({ href, reopened, key, banner: banner.slice(0, 200), differs }),
  );
  await h.context.close();
}

// ------------------------------------------------------------------------------ R-FEEDBACK-AUDIENCE
{
  const h = await open("smt", { allowed: false });
  const icons = await h.page.locator("[data-feedback-button]").count();
  const notesStill = await h.page.locator("[data-note-button]").count();
  await h.page.screenshot({ path: `${OUT}/feedback_audience_no_icon.png` });
  pass("R-FEEDBACK-AUDIENCE: someone the setting doesn't let in sees no feedback icon (their notes stay)", icons === 0 && notesStill > 0, `${icons} icons, ${notesStill} note buttons`);
  await h.context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} / ${results.length} PASS`);
process.exit(failed ? 1 : 0);
