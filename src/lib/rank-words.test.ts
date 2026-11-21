// Run: node --import tsx --test src/lib/rank-words.test.ts
// R-RANK-TIES, the words (review pack 22 Nov, issue 8): one formatter writes every place, so a walk and its
// dashboard say the same thing for the same tie. At Leighton Park, Biology, Chemistry and Physics all had 49 GCSE
// entries: the dashboard's tile said "=2nd of 4 in Sciences", the walk "2nd of 4".
import { test } from "node:test";
import assert from "node:assert/strict";
import { ordinalWord, placeText, placeWord } from "./rank";
import { placeOf } from "./front-door/words";
import { placeWord as tilePlaceWord } from "./view-series/tiles";
import { rankText } from "../components/smt/ui";
import { rankOf } from "./front-door/teacher-model";
import { subjectsRankedAnswer } from "./smt/subjects-ranked";

test("R-RANK-TIES: one formatter -- ordinals, '=' for a shared place, 'of N'", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111, 1234].map(ordinalWord), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th", "1,234th"]);
  assert.equal(placeWord(2, true), "=2nd");
  assert.equal(placeWord(2, false), "2nd");
  assert.equal(placeText({ rank: 2, of: 4, tied: true }, "subjects"), "=2nd of 4 subjects");
  assert.equal(placeText({ rank: 851, of: 3200 }), "851st of 3,200");
});

test("R-RANK-TIES: the walk and the dashboard write the same tie the same way", () => {
  // Leighton Park's Sciences at GCSE, 2025/26 entries: Combined Science 90, Biology = Chemistry = Physics 49.
  const sciences = [{ key: "CS", value: 90 }, { key: "Bio", value: 49 }, { key: "Chem", value: 49 }, { key: "Phys", value: 49 }];
  const r = rankOf(sciences, "Bio")!;
  assert.deepEqual(r, { rank: 2, of: 4, tied: true });
  const walk = placeOf(r.rank, r.of, undefined, r.tied);
  const dashTile = `${tilePlaceWord(2, true)} of 4`;
  const smtDash = rankText({ rank: 2, of: 4, tied: true });
  assert.equal(walk, "=2nd of 4");
  assert.equal(walk, dashTile);
  assert.equal(walk, smtDash);
  assert.equal(placeWord(rankOf(sciences, "CS")!.rank, rankOf(sciences, "CS")!.tied), "1st", "an unshared place has no '='");
  // SMT Academic's walk answer names the subject's place in the set as its dashboard does.
  const ans = subjectsRankedAnswer({ rows: [{ subject: "Biology", qualification: "GCSE", short: "GCSE", value: 7, unit: "grade", entries: 49, rank: 1, of: 5, tied: true, standing: 1, mark: "strong" }], unranked: [], unit: "grade", period: 2026, mode: "results" } as Parameters<typeof subjectsRankedAnswer>[0]);
  assert.match(ans, /Biology \(GCSE, =1st of 5\)/);
});
