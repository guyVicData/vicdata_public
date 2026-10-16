// VicData 0.8 IGCSE subjects (follow-up 6): the focus chips never share a label.
// Run: npx -y tsx --test src/lib/chip-labels.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { uniqueChipLabels } from "./teacher-view-theme";

const item = (subject: string, qualificationType: string) => ({ key: `${subject}::${qualificationType}`, subject, qualificationType });

test("Croydon's two Business Studies BTECs: no longer both 'Business Studies · BTec, OCR, VRQ'", () => {
  const items = [
    item("Business Studies", "BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*"),
    item("Business Studies", "BTEC National Extended Certificate L3 - Band F - P-D*"),
    item("Business Studies", "GCE A level"),
    item("Law", "GCE A level"),
  ];
  const labels = uniqueChipLabels("ks5", items);
  const all = [...labels.values()];
  assert.equal(new Set(all).size, all.length, all.join(" | "));
  assert.equal(labels.get("Law::GCE A level"), "Law");
  assert.equal(labels.get("Business Studies::GCE A level"), "Business Studies · A-level");
  for (const v of all) assert.ok(!v.endsWith("· BTec, OCR, VRQ"), v);
});

test("unchanged where the short name already tells them apart (GCSE Art and BTEC Art)", () => {
  const labels = uniqueChipLabels("ks4", [item("Art and Design", "GCSE (9-1) Full Course"), item("Art and Design", "BTEC Level 1/Level 2 Tech Award"), item("History", "GCSE (9-1) Full Course")]);
  assert.deepEqual([...labels.values()], ["Art and Design · GCSE", "Art and Design · BTEC", "History"]);
});
