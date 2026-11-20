// Run: npx tsx --test src/lib/smt/smt-measures.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SMT_MEASURES } from "./measures";
import { HEADLINE_MEASURE } from "@/lib/academic-data-view";

test("SMT's KS2 headline is the shared one; Post-16 is DfE's Academic (A level, IB, Pre-U) points and value added", () => {
  assert.equal(SMT_MEASURES.ks2.rwm, HEADLINE_MEASURE.ks2);
  assert.equal(SMT_MEASURES.ks5.aps, "Academic::aps_per_entry");
  assert.equal(SMT_MEASURES.ks5.va, "Academic::value_added");
});
