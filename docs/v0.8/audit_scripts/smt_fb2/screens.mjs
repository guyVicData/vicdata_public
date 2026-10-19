// VicData 0.8 SMT feedback round 2: before and after screenshots of Leighton Park's SMT Overview with the set
// changed twice (the 10 nearest with a sixth form, "Local rivals", a saved-style set, as linked sets: ?set=…),
// desktop and phone, and the round's browser checks. The notes and feedback round's harness: a stub platform
// admin in View as; the real app database, read-only; every write answered here, never sent.
//   ACCESS_GATE_ENABLED=false NODE_OPTIONS="--import ./docs/v0.8/audit_scripts/notes_feedback/server-preload.mjs" npx next start -p 3420
//   BASE=http://127.0.0.1:3420 OUT=docs/v0.8/smt_fb2_screenshots TAG=after CHECKS=1 node docs/v0.8/audit_scripts/smt_fb2/screens.mjs
// CHECKS=1 (the branch only):
//   R-SMT-SET-DRIVES-OVERVIEW  under each set: size by phase, the market title and the roll lines name it
//   R-ROLL-INDEXED-SET         the set's day and boarding averages; no England or Reading line
//   item 5                     the entry tiles' % names Year 7 and Year 12
//   R-FEEDBACK-PAGE            "Feedback on this page": the window reads "This page: SMT Overview · Leighton
//                              Park School"; the Area chips; Send records the context with no panel or view;
//                              the button turns yellow; the inbox lists it as "Page"
import { mkdirSync } from "node:fs";
import { harness, BASE, feedback, chromium, EXE } from "../notes_feedback/harness.mjs";

const OUT = process.env.OUT ?? "docs/v0.8/smt_fb2_screenshots";
const TAG = process.env.TAG ?? "after";
const CHECKS = process.env.CHECKS === "1";
mkdirSync(OUT, { recursive: true });
const LP = { urn: "110110", name: "Leighton Park School" };
// The three sets (docs/v0.8/audit_scripts/smt_fb2/sets.ts, threeSets("110110")): the default; its 5 nearest;
// its 6th to 10th nearest and the next 5 nearby.
const NEAR = (process.env.NEAR ?? "").split(",").filter(Boolean);
const MORE = (process.env.MORE ?? "").split(",").filter(Boolean);
const SETS = [
  // The bar's default (DEFAULT_SET_LABEL); the chooser's own "10 nearest with a sixth form…" names the same schools.
  { key: "nearest", label: "10 nearest schools", q: "" },
  { key: "local", label: "Local rivals", q: `?set=${NEAR.slice(0, 5).join(",")}&setLabel=${encodeURIComponent("Local rivals")}` },
  { key: "saved", label: "Our saved comparison set", q: `?set=${[...NEAR.slice(5), ...MORE].join(",")}&setLabel=${encodeURIComponent("Our saved comparison set")}` },
];
const results = [];
const pass = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` -- ${detail}` : ""}`);
};
const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function open(path, o = {}) {
  const h = await harness({ browser, viewAs: { ...LP, role: "smt" }, ...o });
  await h.page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await h.page.locator("[data-score-row]").first().waitFor({ timeout: 120000 }).catch(() => {});
  await h.page.waitForTimeout(o.settle ?? 5000);
  return h;
}
const text = (p, sel) => p.locator(sel).first().innerText().catch(() => "");

for (const set of SETS) {
  if (set.key !== "nearest" && !NEAR.length) continue;
  for (const [name, o] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { viewport: { width: 390, height: 844 }, mobile: true }]]) {
    const h = await open(`/teacher/smt${set.q}`, o);
    await h.page.screenshot({ path: `${OUT}/smt_overview_${set.key}_${name}_${TAG}.png`, fullPage: true });
    if (CHECKS && name === "desktop") {
      const p = h.page;
      const short = set.key === "nearest" ? "10 nearest" : set.key === "local" ? "Local rivals" : "Our saved comparison…";
      const sizes = await text(p, "[data-set-sizes]");
      const market = await text(p, 'section[data-view-panel="vicdata.smt.overview.c3.trends"]');
      const roll = await text(p, 'section[data-view-panel="vicdata.smt.overview.c1.trends"]');
      pass(`R-SMT-SET-DRIVES-OVERVIEW (${set.key}): size by phase, market share and the roll name the set`, sizes.toLowerCase().includes(`in ${short}`.toLowerCase()) && market.includes(`against ${set.label}`) && roll.includes(`${short} average, day`), `sizes="${sizes.split("\n")[0]}" market=${market.includes(set.label)} roll=${roll.includes(short)}`);
      pass(`R-ROLL-INDEXED-SET (${set.key}): the set's day and boarding averages; no England or Reading`, roll.includes("average, boarding") && !/England|Reading/.test(roll.replace(/Leighton Park/g, "")), roll.replace(/\s+/g, " ").slice(0, 200));
      if (set.key === "nearest") {
        const tiles = await p.locator("[data-entry-tile]").allInnerTexts();
        pass("item 5: the entry tiles' % names the year group", tiles.some((t) => /Year 7 \+21% since 2019\/20/.test(t)) && tiles.some((t) => /Year 12 \+10% since 2019\/20/.test(t)), tiles.map((t) => t.replace(/\s+/g, " ")).join(" | "));
        // R-FEEDBACK-PAGE: the footer's button, the page window, send, the colour.
        const btn = p.locator("[data-page-feedback]");
        const before = await btn.getAttribute("data-page-feedback").catch(() => null);
        await btn.click();
        await p.locator("[data-fb-page]").waitFor({ timeout: 10000 });
        const title = await text(p, "[data-fb-title]");
        await p.locator('[data-fb-chip="set_bar"]').click();
        await p.locator('[data-fb-chip="level_pills"]').click();
        await p.locator('[data-fb-chip="layout"]').first().click();
        await p.locator('textarea[aria-label="Your feedback"]').fill("The comparison-set bar is easy to miss.");
        await p.screenshot({ path: `${OUT}/page_feedback_window_${TAG}.png` });
        await p.locator("[data-fb-send]").click();
        await p.locator('[data-fb-message="ok"]').waitFor({ timeout: 10000 }).catch(() => {});
        const sent = feedback.posted.at(-1) ?? {};
        const after = await btn.getAttribute("data-page-feedback").catch(() => null);
        pass("R-FEEDBACK-PAGE: the page window, its header and areas", title === "This page: SMT Overview · Leighton Park School" && (await p.locator('[data-fb-chip="navigation"]').count()) === 1 && (await p.locator('[data-fb-chip="figure"]').count()) === 0, `title="${title}"`);
        pass(
          "R-FEEDBACK-PAGE: the item records the context, no panel or view, and its areas",
          sent.view_key === "page:vicdata.smt.overview" && sent.panel_id === null && sent.view_instance_id === null && sent.dataview_id === null && JSON.stringify(sent.area) === '["set_bar","level_pills"]' && sent.product === "smt" && sent.school_urn === "110110" && sent.view_as === true && sent.role === "smt" && sent.page_path === "/teacher/smt" && !!sent.state?.set && sent.device === "desktop" && !!sent.theme,
          JSON.stringify({ k: sent.view_key, p: sent.panel_id, a: sent.area, s: sent.state?.set, r: sent.role }),
        );
        pass("R-FEEDBACK-PAGE: the button turns yellow", before === "none" && after === "open", `${before} -> ${after}`);
        await p.locator("[data-fb-close]").click().catch(() => {});
        // The inbox: the item reads "Page", and the Items filter finds it.
        await p.goto(`${BASE}/platform/feedback`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-fb-row-kind]").first().waitFor({ timeout: 60000 }).catch(() => {});
        const kinds = await p.locator("[data-fb-row-kind]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-fb-row-kind")}:${e.textContent}`));
        await p.screenshot({ path: `${OUT}/inbox_page_item_${TAG}.png` });
        pass("R-FEEDBACK-PAGE: the inbox lists it as Page", kinds.includes("page:Page"), kinds.join(", "));
        const errs = h.log.filter((l) => l.startsWith("PAGEERROR"));
        pass("no page errors", errs.length === 0, errs.join(" | "));
        pass("no writes sent", h.writes.length === 0, h.writes.join(" | "));
      }
    }
    await h.context.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);
