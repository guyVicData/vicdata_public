// VicData 0.8 SMT feedback round 1: before and after screenshots of Leighton Park's SMT Overview (desktop and
// phone) and Admissions Pipelines at 16+, and the round's browser checks. The notes and feedback round's
// harness (stub platform admin in View as; real app database, read-only; every write answered here, never sent).
//   ACCESS_GATE_ENABLED=false NODE_OPTIONS="--import ./docs/v0.8/audit_scripts/notes_feedback/server-preload.mjs" npx next start -p 3420
//   BASE=http://127.0.0.1:3420 OUT=docs/v0.8/smt_fb1_screenshots TAG=after CHECKS=1 node docs/v0.8/audit_scripts/smt_fb1/screens.mjs
// TAG names the shots ("before" on main's build, "after" on the branch's). CHECKS=1 (the branch only) runs:
//   R-RAIL-HIDES-EMPTY       no Flags icon on the Scorecard panel's rail (Leighton Park has no flags)
//   R-SCORECARD-ROWS-BY-TYPE the set column reads "10 nearest", no GCSE row, a boarders row; "Trends"
//   R-INDEP-ENTRY-TILES      Joining at 11 and Net change at 16 tiles
//   F-2                      the map's colour and size keys
//   R-FEEDBACK-FOLLOWS-VIEW  feedback open on the Scorecard; the rail moves to Map; "Move to Map" moves it
//   F-1                      Admissions' Entry point now: Day and Boarding boxed, "in whole school"
import { mkdirSync } from "node:fs";
import { harness, BASE, chromium, EXE } from "../notes_feedback/harness.mjs";

const OUT = process.env.OUT ?? "docs/v0.8/smt_fb1_screenshots";
const TAG = process.env.TAG ?? "after";
const CHECKS = process.env.CHECKS === "1";
mkdirSync(OUT, { recursive: true });
const LP = { urn: "110110", name: "Leighton Park School" };
const results = [];
const pass = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`);
};
const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function open(path, viewAs, o = {}) {
  const h = await harness({ browser, viewAs, ...o });
  await h.page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await h.page.locator('[data-panel-footer=""]').first().waitFor({ timeout: 120000 }).catch(() => {});
  await h.page.locator("[data-score-row]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await h.page.waitForTimeout(o.settle ?? 5000);
  return h;
}

// ------------------------------------------------------------------ SMT Overview, desktop and phone
for (const [name, o] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { viewport: { width: 390, height: 844 }, mobile: true }]]) {
  for (const theme of ["light", "dark"]) {
    const h = await open("/teacher/smt", { ...LP, role: "smt" }, { ...o, theme });
    await h.page.screenshot({ path: `${OUT}/smt_overview_${name}_${theme}_${TAG}.png`, fullPage: true });
    if (CHECKS && name === "desktop" && theme === "light") {
      const p = h.page;
      const sc = p.locator('section[data-view-panel="vicdata.smt.overview.c2.now"]').first();
      const rail = await sc.locator("button[aria-pressed]").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")));
      pass("R-RAIL-HIDES-EMPTY: no Flags icon at Leighton Park", rail.length > 0 && !rail.includes("Flags"), `rail=${rail.join("/")}`);
      const head = await sc.locator("thead th").allInnerTexts();
      const rows = await sc.locator("[data-score-row]").evaluateAll((r) => r.map((x) => x.getAttribute("data-score-row")));
      pass("R-SCORECARD-ROWS-BY-TYPE: short set name, Trends, rows by type", head.map((x) => x.trim().toUpperCase()).includes("10 NEAREST") && head.map((x) => x.trim().toUpperCase()).includes("TRENDS") && rows.includes("boarders") && !rows.includes("attainment8_average"), `head=${head.join("|")} rows=${rows.join(",")}`);
      const tiles = await p.locator("[data-entry-tile]").evaluateAll((t) => t.map((x) => `${x.getAttribute("data-entry-tile")}: ${x.textContent}`));
      pass("R-INDEP-ENTRY-TILES: Joining at 11, Net change at 16", tiles.some((t) => t.startsWith("join11")) && tiles.some((t) => t.startsWith("net16")), tiles.join(" | "));
      // The map: the rail's Map, its keys; and the feedback window following the rail.
      await sc.locator('[data-feedback-button]').first().click();
      await p.locator("[data-fb-title]").waitFor({ timeout: 10000 });
      const before = await p.locator("[data-fb-title]").innerText();
      await sc.locator('button[aria-label="Map"]').first().click();
      await p.waitForTimeout(2500);
      const offer = await p.locator("[data-fb-move]").innerText().catch(() => "");
      await p.screenshot({ path: `${OUT}/feedback_move_offer_${TAG}.png` });
      await p.locator("[data-fb-move]").click().catch(() => {});
      await p.waitForTimeout(500);
      const after = await p.locator("[data-fb-title]").innerText().catch(() => "");
      pass("R-FEEDBACK-FOLLOWS-VIEW: Move to Map", before === "Scorecard" && /Move to Map/.test(offer) && after === "Map" && (await p.locator("[data-fb-move]").count()) === 0, `before=${before} offer=${offer} after=${after}`);
      await p.locator("[data-fb-close]").click().catch(() => {});
      await p.waitForTimeout(800);
      const keys = await p.locator("[data-map-keys]").innerText().catch(() => "");
      pass("F-2: the map's colour and size keys", /Growing/.test(keys) && /Steady/.test(keys) && /Shrinking/.test(keys) && (await p.locator("[data-size-key]").count()) === 1, keys.replace(/\s+/g, " "));
      await sc.screenshot({ path: `${OUT}/smt_map_desktop_${TAG}.png` });
      const pageErrors = h.log.filter((l) => l.startsWith("PAGEERROR"));
      pass("no page errors on SMT Overview", pageErrors.length === 0, pageErrors.join(" | "));
      pass("no writes sent", h.writes.length === 0, h.writes.join(" | "));
    }
    if (TAG === "before" && name === "desktop" && theme === "light") {
      const sc = h.page.locator('section[data-view-panel="vicdata.smt.overview.c2.now"]').first();
      await sc.locator('button[aria-label="Map"]').first().click().catch(() => {});
      await h.page.waitForTimeout(2500);
      await sc.screenshot({ path: `${OUT}/smt_map_desktop_${TAG}.png` });
    }
    await h.context.close();
  }
}

// ------------------------------------------------------------------ Admissions Pipelines at 16+ (F-1)
{
  const h = await open("/teacher/admissions?view=pipelines&entry=16%2B", { ...LP, role: "admissions" }, { theme: "dark" });
  const now = h.page.locator("section").filter({ hasText: "entry point now" }).first();
  await now.screenshot({ path: `${OUT}/admissions_entry_now_${TAG}.png` }).catch(() => {});
  if (CHECKS) {
    const pairs = await h.page.locator("[data-pair]").evaluateAll((p) => p.map((x) => x.getAttribute("data-pair")));
    const text = await h.page.locator("[data-pair-tile]").allInnerTexts();
    pass("F-1: Day and Boarding boxed, in whole school; Girls and Boys in Year 12", ["Day", "Boarding", "Girls", "Boys"].every((l) => pairs.includes(l)) && text.some((t) => /in whole school/.test(t)) && text.some((t) => /in Year 12/.test(t)), `${pairs.join(",")} | ${text.map((t) => t.replace(/\s+/g, " ")).join(" | ")}`);
  }
  await h.context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);
