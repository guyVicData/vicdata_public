// VicData 0.8 Sets r1 (F24): a method's parts for some schools only ({?boarding}…, {!boarding}…).
// Run: npx -y tsx --test src/catalogue/method-conditions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyConditions, applyConditionsAll, either, flagOf, onlyIf, unless } from "./method-conditions";
import { methodOf, methodText } from "./methods";

test("flagOf: 0, '0', '' and 'no' are off; null and undefined are not said", () => {
  assert.equal(flagOf({ boarding: 1 }, "boarding"), true);
  assert.equal(flagOf({ boarding: "yes" }, "boarding"), true);
  for (const v of [0, "0", "", "no"]) assert.equal(flagOf({ boarding: v }, "boarding"), false);
  assert.equal(flagOf({ boarding: null }, "boarding"), null);
  assert.equal(flagOf({}, "boarding"), null);
});

test("onlyIf / unless / either keep the right wording for each answer", () => {
  const s = `Narrowed by the sector${either("boarding", " and boarding filters", " filter")}${onlyIf("boarding", " (boarders too)")}.`;
  assert.equal(applyConditions(s, { boarding: 1 }), "Narrowed by the sector and boarding filters (boarders too).");
  assert.equal(applyConditions(s, { boarding: 0 }), "Narrowed by the sector filter.");
  // Not said (the catalogue docs, a host that doesn't know): the full wording, never the other one.
  assert.equal(applyConditions(s, {}), "Narrowed by the sector and boarding filters (boarders too).");
  assert.equal(applyConditions(unless("boarding", "Day only."), {}), "");
});

test("an item left empty is dropped; other flags are independent", () => {
  assert.deepEqual(applyConditionsAll(["a", onlyIf("boarding", "b"), onlyIf("x", "c")], { boarding: 0, x: 1 }), ["a", "c"]);
});

test("the intake view's (i): the boarding caveat and the ISC note for a boarding school only", () => {
  const board = methodOf("DV-ADM-P-FUNNEL", { boarding: 1 })!;
  const day = methodOf("DV-ADM-P-FUNNEL", { boarding: 0 })!;
  assert.ok(board.notes!.some((n) => /International boarders/.test(n)));
  assert.ok(board.notes!.some((n) => /Boarding schools draw from far beyond/.test(n)));
  assert.equal(day.notes!.length, board.notes!.length - 2);
  assert.doesNotMatch([...day.notes!, methodText(day)].join(" "), /\b(boarding|boarders?|ISC)\b/i);
  assert.match(methodText(day), /Children from outside the radius/);
  assert.deepEqual(methodOf("DV-ADM-P-FUNNEL", {}), board);
});
