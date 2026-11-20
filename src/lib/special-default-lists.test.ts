// Run: npx tsx --test src/lib/special-default-lists.test.ts
// 20 Nov (Guy): special schools, AP and PRUs stay out of a mainstream school's default comparison lists -- GIAS
// files many outside "Special schools", so the type is read too (Reading's five, as GIAS has them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpecialOrAlternative } from "./typology";

test("isSpecialOrAlternative: by GIAS group or type; mainstream and independent schools are not", () => {
  for (const [g, t] of [["Special schools", "Other independent special school"], ["Academies", "Academy special sponsor led"], ["Academies", "Academy special converter"], ["Free Schools", "Free schools special"], ["Academies", "Academy alternative provision converter"], ["Local authority maintained schools", "Pupil referral unit"]] as const)
    assert.ok(isSpecialOrAlternative(g, t), t);
  for (const [g, t] of [["Academies", "Academy converter"], ["Free Schools", "Free schools"], ["Independent schools", "Other independent school"], ["Local authority maintained schools", "Voluntary aided school"], ["Free Schools", "University technical college"]] as const)
    assert.ok(!isSpecialOrAlternative(g, t), t);
});
