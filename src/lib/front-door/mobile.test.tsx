// Run: npx -y tsx --test --test-force-exit src/lib/front-door/mobile.test.tsx
// VicData 0.8 front door, part 2 (G; R-FRONT-DOOR-MOBILE): every front-door surface of Parts 1 and 2 at phone
// width -- every control with a 44 px hit area and no phone markup wider than the 358 px card (the scanner over
// the source), and the designed phone layouts rendered on the server: the walk's screen order (question, chart,
// mini-map), its rail as a row of chips and Back/Next in a sticky bar; the guided editor's 220 px map strip, two
// tabs and sticky bar; the School-Admin's pages as one column of cards. The headless measurement at 390 x 844 (no
// horizontal scroll, every control's box) is in the report.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FRONT_DOOR_SURFACES, MOBILE_EXCEPTIONS, scanControls, tallEnough, wideFindings } from "./mobile-scan";

const root = new URL("../../../", import.meta.url).pathname;

test("R-FRONT-DOOR-MOBILE: every control on every front-door surface has a 44 px hit area at phone width", () => {
  const found = FRONT_DOOR_SURFACES.flatMap((f) => scanControls(f, readFileSync(root + f, "utf8")));
  assert.deepEqual(found.map((x) => `${x.file}:${x.line} ${x.tag}`), []);
  for (const e of MOBILE_EXCEPTIONS) assert.ok(readFileSync(root + e.file, "utf8").includes(e.has), `exception still matches: ${e.file} ${e.has}`);
});

test("R-FRONT-DOOR-MOBILE: no phone markup is wider than the shell's 358 px card", () => {
  const wide = FRONT_DOOR_SURFACES.flatMap((f) => wideFindings(f, readFileSync(root + f, "utf8")));
  assert.deepEqual(wide.map((x) => `${x.file}:${x.line} ${x.tag}`), []);
});

test("R-FRONT-DOOR-MOBILE: the scanner reads phone classes, not desktop ones", () => {
  assert.equal(tallEnough("px-2 text-[12px]"), false);
  assert.equal(tallEnough("sm:min-h-[44px] px-2"), false, "a breakpoint class is desktop only");
  assert.equal(tallEnough("min-h-[44px] sm:min-h-0"), true);
  assert.equal(tallEnough("h-11 w-11 sm:h-8 sm:w-8"), true);
  assert.equal(tallEnough("px-4 py-3 text-[15px]"), true);
  assert.equal(tallEnough("px-4 py-3 text-[12px]"), false);
  const t = 'const hit = phone ? "min-h-[44px]" : "min-h-[30px]";\n<button className={`px-2 ${hit}`}>x</button>\n<button onClick={() => go()} className="px-2">y</button>';
  assert.deepEqual(scanControls("x.tsx", t).map((f) => f.line), [3], "the arrow in onClick doesn't end the tag; the phone branch of a shared class counts");
});

test("R-FRONT-DOOR-MOBILE: a walk on a phone -- question and answer, then the chart, then the mini-map; the rail as chips; Back/Next sticky", async () => {
  const { WalkScreen, RAIL_LIST, RAIL_ROW } = await import("../../components/front-door/WalkPage");
  const html = renderToStaticMarkup(h(WalkScreen, { head: h("h1", null, "Q"), panel: h("div", { id: "panel" }), map: h("aside", { id: "map" }) }));
  assert.ok(html.indexOf("<h1>Q</h1>") < html.indexOf('id="panel"') && html.indexOf('id="panel"') < html.indexOf('id="map"'), "phone order: question, chart, mini-map");
  assert.match(html, /sm:grid-cols-\[minmax\(0,1fr\)_220px\]/, "from sm up the mini-map sits beside the question again");
  assert.match(RAIL_LIST, /^-mx-3 flex flex-row gap-1\.5 overflow-x-auto/, "the rail scrolls sideways on a phone");
  assert.match(RAIL_LIST, /md:flex-col/);
  assert.match(RAIL_ROW, /min-h-\[44px\].*whitespace-nowrap rounded-full/, "named chips, 44 px");
  const src = readFileSync(root + "src/components/front-door/WalkPage.tsx", "utf8");
  assert.match(src, /data-walk-footer="" className="sticky bottom-0 z-30/, "Back and Next in a sticky bottom bar");
  assert.match(src, /sm:static/, "…the row under the panel from sm up");
  for (const f of ["src/components/front-door/WalkPage.tsx", "src/components/front-door/role-walks.tsx"]) assert.doesNotMatch(readFileSync(root + f, "utf8"), /flex-col-reverse gap-4 sm:flex-row/, `${f}: every screen uses WalkScreen`);
});

test("R-FRONT-DOOR-MOBILE: welcome and setup -- one column; the subject list as full-width rows; homes stack one tile per row", () => {
  const fv = readFileSync(root + "src/components/front-door/first-visit.tsx", "utf8");
  assert.match(fv, /<ul className="flex flex-col gap-1\.5 sm:flex-row sm:flex-wrap sm:gap-2">/, "subjects stack on a phone");
  assert.match(fv, /data-setup-subject=\{s\.key\} onClick=\{\(\) => onToggle\(s\.key\)\} className=\{`flex min-h-\[44px\] w-full/, "each a full-width 44 px row");
  const home = readFileSync(root + "src/components/front-door/home.tsx", "utf8");
  assert.match(home, /grid grid-cols-1 gap-\[18px\]/, "one tile per row below md");
  assert.match(home, /<ul className="flex min-w-0 flex-wrap gap-1\.5"/, "the walk's icon row wraps");
  assert.match(home, /<span className="grow" \/>\s*\{href \?/, "the arrow stays on the right");
});

test("R-FRONT-DOOR-MOBILE: the guided editor on a phone -- a 220 px map strip with Expand map, two tabs, This set now and Save in a sticky bar", async () => {
  const { GuidedSetEditor } = await import("../../components/sets/GuidedSetEditor");
  const page = { urn: "110110", schoolName: "Leighton Park School", kind: "feeders" as const, g: "feeders" as const, entry: "11+", entryAge: 11, phase: null, entryChoices: [{ label: "11+", href: "#", on: true }], setChoices: [{ label: "Day feeders", href: "#", on: true }], newSetHref: "#", product: "admissions" as const, accentHex: "#22d3ee", returnTo: "/teacher", returnFallback: false, returnLabel: "Admissions home", profileId: "p", schoolAccountId: "a", schoolCreator: "admissions" as const, readOnly: false };
  const row = (urn: string, km: number) => ({ urn, name: `School ${urn}`, km, sector: "state" as const, boarding: false, gender: "mixed" as const, laName: null, laCode: null, town: null, pupils: 30, trend: null, changePct: null, hasGcse: false, hasPost16: false, igcse: false, easting: 470000, northing: 170000, low: 4, high: 11, roll: 300, gcse: null, post16: null });
  const data = { kind: "feeders" as const, entry: "11+", age: 10, period: 2025, focus: { ...row("110110", 0), roll: null } as never, rows: [row("1", 1.2)], suggestions: [row("2", 2.5), row("3", 4)], suggestionsTotal: 2 };
  const html = renderToStaticMarkup(h(GuidedSetEditor, { page, start: { set: null, name: "Day feeders", members: [{ urn: "1" }], mode: "save" }, phone: true, initialData: data }));
  assert.match(html, /data-guided-editor="phone"/);
  assert.match(html, /data-guided-expand=""[^>]*>Expand map</, "Expand map");
  assert.match(readFileSync(root + "src/components/sets/GuidedSetEditor.tsx", "utf8"), /mapOpen \? "h-\[420px\] w-full" : "h-\[220px\] w-full"/, "a 220 px strip");
  assert.match(html, /role="tablist"[^>]*>[\s\S]*In your set · 1[\s\S]*Add schools/, "two tabs");
  assert.match(html, /data-guided-bar="" class="sticky bottom-0[^"]*">[\s\S]*This set now[\s\S]*data-guided-save/, "This set now and Save in a sticky bar");
});

test("R-FRONT-DOOR-MOBILE: the School-Admin's pages on a phone -- one column of cards", async () => {
  const { MembershipBody } = await import("../../components/school-admin/SchoolAccount");
  const data = { school: { urn: "110110", name: "Leighton Park School" }, readOnly: false, rows: [], waiting: 0, who: { people: 1, activeThisMonth: 1, roles: 1 }, membershipNotSetUp: false, membership: { status: "pilot" as const, planName: "School membership", planLine: "Secondary school", price: { month: "£10 a month", year: "£120 a year, billed annually" }, included: ["Unlimited staff"], banner: { title: "Pilot", body: "Free", tone: "pilot" as const }, addCard: null, renewal: { date: "7 Mar 2027", auto: "renews automatically", charge: "£120", reminders: "We'll email" }, billing: { contact: "x", card: "No card yet", purchaseOrder: "Optional", invoiceAddress: "x" }, coveredContact: null, invoices: [], actions: [{ label: "Add a card", disabled: true as const, why: "Coming before the pilot ends" }] } };
  const phone = renderToStaticMarkup(h(MembershipBody, { data, phone: true }));
  const desk = renderToStaticMarkup(h(MembershipBody, { data, phone: false }));
  assert.match(phone, /class="flex flex-col gap-3"/, "Renewal and Who uses it stack");
  assert.doesNotMatch(phone, /grid-cols-2/);
  assert.match(desk, /grid grid-cols-2 gap-4/);
  assert.match(phone, /grid gap-y-2 text-\[14px\] grid-cols-1/, "Billing in one column");
});
