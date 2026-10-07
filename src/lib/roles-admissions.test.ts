// 0.7 admissions r1 (A3): the Admissions lead's label (src/lib/roles.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMISSIONS_LEAD_LABEL, admissionsLabel, roleLabel, TEACHER_VIEW_ROLES } from "./roles";

test("an Admissions lead is labelled 'Admissions lead'; other admissions staff 'Admissions'", () => {
  assert.equal(admissionsLabel({ roles: ["admissions"], admissions_lead: true }), ADMISSIONS_LEAD_LABEL);
  assert.equal(admissionsLabel({ roles: ["admissions", "teacher"], admissions_lead: false }), "Admissions");
  assert.equal(admissionsLabel({ roles: ["admissions"] }), "Admissions");
  assert.equal(admissionsLabel({ roles: ["teacher"], admissions_lead: true }), null, "no role, no lead");
});

test("the lead is a flag, not a role value: the vocabulary and labels are unchanged", () => {
  assert.deepEqual([...TEACHER_VIEW_ROLES], ["teacher", "hod", "smt", "finance", "admissions"]);
  assert.equal(roleLabel("admissions"), "Admissions");
});
