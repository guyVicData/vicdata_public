// Run: npx -y tsx --test src/lib/sets/return-to.test.ts
// The set editor's return address (safeReturnTo): only a path on this site, on a page that opens the
// editor. The breadcrumb, Save, Archive and Delete all go through it (src/app/sets/edit/page.tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "./return-to";

test("accepts every page that opens the editor, keeping its query and hash", () => {
  const ok = [
    "/teacher/admissions",
    "/teacher/admissions?view=pipelines&entry=11%2B&fset=set%3Aabc",
    "/teacher/admissions?view=market-share&entry=16+&rset=adm:nearest-sector",
    "/teacher/ks4",
    "/teacher/ks5?x=1#comparisons",
    "/teacher/smt?phase=ks4",
    "/teacher/smt/academic?headOffice=110110&lookAs=abc&as=head_office&peek=1",
    "/sets",
    "/sets?urn=110110&kind=feeders",
    "/sets/8a3c1d9e-0000-4000-8000-000000000000?urn=110110",
    "/sets/default?urn=110110&kind=feeders&entry=11%2B&from=default:day-all&name=Day&urns=1,2",
  ];
  for (const p of ok) assert.equal(safeReturnTo(p), p, p);
});

test("normalises the path before checking it", () => {
  assert.equal(safeReturnTo("/sets/./abc"), "/sets/abc");
  assert.equal(safeReturnTo("/teacher/x/../ks4"), "/teacher/ks4");
  assert.equal(safeReturnTo("/sets/../platform/feedback"), null, ".. out of an allowed page");
  assert.equal(safeReturnTo("/teacher/admissions/../../api/whoami"), null);
});

test("refuses other sites", () => {
  for (const p of [
    "https://evil.example",
    "https://evil.example/teacher/admissions",
    "http:/evil.example",
    "//evil.example",
    "//evil.example/sets",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "\\/evil.example",
    "/%2F%2Fevil.example",
    "/%5Cevil.example",
    "/@evil.example",
    "/sets@evil.example",
    "evil.example",
  ]) assert.equal(safeReturnTo(p), null, p);
});

test("refuses script and data URLs, however they're written", () => {
  for (const p of [
    "javascript:alert(document.cookie)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:alert(1)",
    "java\nscript:alert(1)",
    "javascript://%0aalert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ]) assert.equal(safeReturnTo(p), null, JSON.stringify(p));
});

test("refuses control characters the URL parser would quietly drop", () => {
  for (const p of ["/\t/evil.example", "/\n/evil.example", "/sets\r\n", "/sets\u0000", "/sets\u007f"]) assert.equal(safeReturnTo(p), null, JSON.stringify(p));
});

test("refuses pages that don't open the editor, look-alikes, and the editor itself", () => {
  for (const p of ["/", "/platform/feedback", "/api/sets/editor", "/account", "/teacher", "/teacher/admissionsX", "/teacher/ks44", "/setsX", "/sets-old", "/sets/edit", "/sets/edit?urn=110110&back=/sets", "/sets/edit/x"]) {
    assert.equal(safeReturnTo(p), null, p);
  }
});

test("refuses nothing, empty, non-strings and very long values", () => {
  assert.equal(safeReturnTo(null), null);
  assert.equal(safeReturnTo(undefined), null);
  assert.equal(safeReturnTo(""), null);
  assert.equal(safeReturnTo(42 as unknown as string), null);
  assert.equal(safeReturnTo(`/sets?x=${"a".repeat(2000)}`), null);
  assert.ok(safeReturnTo(`/sets?x=${"a".repeat(1900)}`));
});

// ------------------------------------------------------------------------------------------------
// The way back: withSchool, fallbackReturn, returnLabel, planLeave and the handover.
import { HANDOVER_KEY, HANDOVER_TTL_MS, fallbackReturn, hasHandover, planLeave, returnLabel, sameTarget, takeHandover, withSchool, writeHandover } from "./return-to";

const LP = { urn: "110110", schoolName: "Leighton Park" };
const ID = "8a3c1d9e-0000-4000-8000-000000000001";
const ID2 = "8a3c1d9e-0000-4000-8000-000000000002";
const ORIGIN = "https://vicdata.co.uk";
const memStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

test("withSchool names the school: school= on dashboards, urn= on the sets pages, never overriding one", () => {
  assert.equal(withSchool("/teacher/admissions?view=pipelines&entry=11%2B", "110110"), "/teacher/admissions?view=pipelines&entry=11%2B&school=110110");
  assert.equal(withSchool("/teacher/ks4", "110110"), "/teacher/ks4?school=110110");
  assert.equal(withSchool("/teacher/smt?school=137625", "110110"), "/teacher/smt?school=137625");
  assert.equal(withSchool("/sets?kind=feeders", "110110"), "/sets?kind=feeders&urn=110110");
  assert.equal(withSchool(`/sets/${ID}?urn=110110`, "110110"), `/sets/${ID}?urn=110110`);
});

test("the fallback is the dashboard the set is for, at its school and entry", () => {
  assert.equal(fallbackReturn({ kind: "feeders", entry: "11+", phase: null, product: "admissions", urn: "110110" }), "/teacher/admissions?view=pipelines&entry=11%2B&school=110110");
  assert.equal(fallbackReturn({ kind: "compared_against", entry: "16+", phase: null, product: "admissions", urn: "110110" }), "/teacher/admissions?view=market-share&entry=16%2B&school=110110");
  assert.equal(fallbackReturn({ kind: "compared_against", entry: "11+", phase: "ks4", product: "teacher", urn: "110110" }), "/teacher/ks4?school=110110");
  assert.equal(fallbackReturn({ kind: "compared_against", entry: "16+", phase: "ks5", product: "smt", urn: "110110" }), "/teacher/smt?school=110110");
  for (const f of [fallbackReturn({ kind: "feeders", entry: "16+", phase: null, product: "admissions", urn: "110110" }), fallbackReturn({ kind: "compared_against", entry: "16+", phase: "ks5", product: "teacher", urn: "110110" })]) {
    assert.equal(safeReturnTo(f), f, "a fallback passes the same check");
  }
});

test("the label names the page and its context, from the address itself", () => {
  const c = { kind: "feeders" as const, entry: "11+", phase: null, product: "admissions" as const, ...LP };
  assert.equal(returnLabel("/teacher/admissions?view=pipelines&entry=11%2B", c), "Back to Leighton Park · Pipelines 11+");
  assert.equal(returnLabel("/teacher/admissions?view=market-share&entry=16%2B", { ...c, kind: "compared_against" }), "Back to Leighton Park · Market share 16+");
  assert.equal(returnLabel("/teacher/admissions", c), "Back to Leighton Park · Pipelines 11+", "no view or entry in the address: the set's own");
  const t = { kind: "compared_against" as const, entry: "16+", phase: "ks5" as const, product: "teacher" as const, ...LP };
  assert.equal(returnLabel("/teacher/ks4?school=110110", { ...t, phase: "ks4", entry: "11+" }), "Back to Leighton Park · GCSE");
  assert.equal(returnLabel("/teacher/ks5", t), "Back to Leighton Park · Post-16");
  assert.equal(returnLabel("/teacher/smt/academic?school=110110", { ...t, product: "smt" }), "Back to SMT · Post-16");
  assert.equal(returnLabel("/sets?urn=110110&kind=feeders", c), "Back to Sets");
  assert.equal(returnLabel(`/sets/${ID}?urn=110110`, { ...c, originSetName: "Day feeders" }), "Back to Day feeders");
  assert.equal(returnLabel(`/sets/${ID}?urn=110110`, c), "Back to the set");
  assert.equal(returnLabel("/sets/default?urn=110110&name=Day%20%7C%20all%20sectors", c), "Back to Day | all sectors");
});

test("sameTarget: the same page, whatever the order of its parameters or the useSet/school the trip adds", () => {
  assert.ok(sameTarget("/teacher/admissions?view=pipelines&entry=11%2B", "/teacher/admissions?entry=11%2B&view=pipelines&school=110110"));
  assert.ok(sameTarget("/teacher/ks4?school=110110", `/teacher/ks4?useSet=${ID}`));
  assert.ok(!sameTarget("/teacher/admissions?view=pipelines&entry=11%2B", "/teacher/admissions?view=pipelines&entry=16%2B"));
  assert.ok(!sameTarget("/teacher/ks4", "/teacher/ks5"));
});

test("planLeave: one step back when the page before is the origin, else replace -- never a new entry", () => {
  const returnTo = "/teacher/admissions?view=pipelines&entry=11%2B&school=110110";
  const base = { returnTo, fallback: false, origin: ORIGIN, historyLength: 3 };
  const ref = `${ORIGIN}/teacher/admissions?view=pipelines&entry=11%2B`;
  assert.deepEqual(planLeave({ ...base, referrer: ref }), { how: "back" }, "Back/Cancel from the origin");
  assert.deepEqual(planLeave({ ...base, referrer: ref, savedId: ID }), { how: "back" }, "Save from the origin (the id goes by handover)");
  assert.deepEqual(planLeave({ ...base, referrer: "" }), { how: "replace", href: returnTo }, "no referrer: a pasted link, a bookmark");
  assert.deepEqual(planLeave({ ...base, referrer: ref, historyLength: 1 }), { how: "replace", href: returnTo }, "a new tab: nothing to go back to");
  assert.deepEqual(planLeave({ ...base, referrer: "https://evil.example/teacher/admissions?view=pipelines&entry=11%2B" }), { how: "replace", href: returnTo }, "another site's referrer");
  assert.deepEqual(planLeave({ ...base, referrer: `${ORIGIN}/sets` }), { how: "replace", href: returnTo }, "the page before is another page");
  assert.deepEqual(planLeave({ ...base, referrer: "", savedId: ID }), { how: "replace", href: `${returnTo}&useSet=${ID}` }, "Save without the origin behind: useSet in the address");
  assert.deepEqual(planLeave({ ...base, fallback: true, referrer: ref }), { how: "replace", href: returnTo }, "the fallback never goes back");
});

test("planLeave from a set's view: the same set goes back; a new set (save as, duplicate, a default's copy) opens its own view", () => {
  const view = `/sets/${ID}?urn=110110`;
  const base = { returnTo: view, fallback: false, origin: ORIGIN, historyLength: 3, referrer: `${ORIGIN}${view}` };
  assert.deepEqual(planLeave({ ...base, savedId: ID }), { how: "back" });
  assert.deepEqual(planLeave({ ...base, savedId: ID2 }), { how: "replace", href: `/sets/${ID2}?urn=110110` });
  assert.deepEqual(planLeave({ ...base, returnTo: "/sets/default?urn=110110&name=Day", savedId: ID2 }), { how: "replace", href: `/sets/${ID2}?urn=110110` });
  assert.deepEqual(planLeave(base), { how: "back" }, "Cancel");
});

test("handover: taken once by the page it's for; refreshing the origin finds nothing", () => {
  const s = memStore();
  const returnTo = "/teacher/admissions?view=pipelines&entry=11%2B&school=110110";
  writeHandover(s, returnTo, ID, 1000);
  assert.equal(takeHandover(s, "/teacher/ks4", 1000), null, "another page leaves it alone");
  assert.ok(s.m.has(HANDOVER_KEY));
  assert.ok(hasHandover(s, "/teacher/admissions?entry=11%2B&view=pipelines", 1000));
  assert.equal(takeHandover(s, "/teacher/admissions?entry=11%2B&view=pipelines", 2000), ID);
  assert.equal(takeHandover(s, "/teacher/admissions?entry=11%2B&view=pipelines", 3000), null, "refresh: gone");
  assert.ok(!hasHandover(s, "/teacher/admissions?entry=11%2B&view=pipelines", 3000));
});

test("handover: two tabs each have their own (sessionStorage is per tab), and a newer save replaces an older", () => {
  const tabA = memStore();
  const tabB = memStore();
  const page = "/teacher/ks4?school=110110";
  writeHandover(tabA, page, ID, 1000);
  assert.equal(takeHandover(tabB, page, 1000), null, "tab B on the same page never sees tab A's save");
  assert.equal(takeHandover(tabA, page, 1000), ID);
  writeHandover(tabB, page, ID, 1000);
  writeHandover(tabB, page, ID2, 2000);
  assert.equal(takeHandover(tabB, page, 2000), ID2, "the latest save wins");
});

test("handover: stale, from the future, unreadable or not an id -- ignored and cleared", () => {
  const page = "/teacher/ks4";
  const s = memStore();
  writeHandover(s, page, ID, 0);
  assert.equal(takeHandover(s, page, HANDOVER_TTL_MS + 1), null, "older than 10 minutes");
  assert.ok(!s.m.has(HANDOVER_KEY), "and cleared");
  writeHandover(s, page, ID, 10 * 60_000 + 61_000);
  assert.equal(takeHandover(s, page, 10 * 60_000), null, "a clock that's ahead");
  s.setItem(HANDOVER_KEY, "{not json");
  assert.equal(takeHandover(s, page, 0), null);
  assert.ok(!s.m.has(HANDOVER_KEY));
  s.setItem(HANDOVER_KEY, JSON.stringify({ returnTo: page, id: "1; drop table", at: 0 }));
  assert.equal(takeHandover(s, page, 0), null);
  writeHandover(s, page, "not-a-uuid", 0);
  assert.ok(!s.m.has(HANDOVER_KEY), "writes only an id");
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  assert.doesNotThrow(() => writeHandover(blocked, page, ID, 0));
  assert.equal(takeHandover(blocked, page, 0), null, "storage blocked: nothing, no error");
});
