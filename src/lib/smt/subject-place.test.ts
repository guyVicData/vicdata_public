// SMT's Subjects rows carry a shared place through, so SMT prints "=851st" where Teacher does:
// Leighton Park's GCSE Biology, 2025, is 851st of 3,433 nationally, tied with 11 schools at 6.88.
// Run: npx -y tsx --test src/lib/smt/subject-place.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { subjectPlace } from "./subject-place";
import { rankText } from "../../components/smt/ui";

test("a ranking's shared place is carried through as tied", () => {
  assert.deepEqual(subjectPlace({ targetRank: 851, ranked: 3433, targetTied: true }), { rank: 851, of: 3433, tied: true });
  assert.deepEqual(subjectPlace({ targetRank: 3, ranked: 12, targetTied: false }), { rank: 3, of: 12, tied: false });
  assert.deepEqual(subjectPlace({ targetRank: 3, ranked: 12 }), { rank: 3, of: 12, tied: false });
  assert.equal(subjectPlace({ targetRank: null, ranked: 3433, targetTied: false }), null);
});

test("SMT prints a shared place with '=', as Teacher does, and nothing else changes", () => {
  assert.equal(rankText(subjectPlace({ targetRank: 851, ranked: 3433, targetTied: true })), "=851st of 3,433");
  assert.equal(rankText(subjectPlace({ targetRank: 852, ranked: 3433, targetTied: false })), "852nd of 3,433");
  assert.equal(rankText({ rank: 11, of: 40 }), "11th of 40");
  assert.equal(rankText(null), "—");
});
