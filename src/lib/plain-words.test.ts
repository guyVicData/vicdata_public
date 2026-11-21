// Run: node --import tsx --test src/lib/plain-words.test.ts
// R-NO-TICKET-CODES (review pack 22 Nov, issue 2): what users read never carries a ticket code or round name.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { plainWords } from "./plain-words";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

test("R-NO-TICKET-CODES: codes and round names come out, the words stay", () => {
  assert.equal(
    plainWords("Admissions feedback round 1 (F-12 to F-21): the intake waterfall, local births, girls and boys, the share of Years 7-11"),
    "The intake waterfall, local births, girls and boys, the share of Years 7-11",
  );
  assert.equal(plainWords("Admissions feedback round 2, item 3: the window names the view"), "The window names the view");
  assert.equal(plainWords("The featured school's row is tinted (F-17)."), "The featured school's row is tinted.");
  assert.equal(plainWords("GCSE subjects only at IGCSE schools R-IGCSE-GCSE-ONLY"), "GCSE subjects only at IGCSE schools");
  assert.equal(plainWords("Market share fixed (round 2)"), "Market share fixed");
  // Plain text is untouched: Years 7-11, 2025/26, A-level, *emphasis*.
  for (const t of ["Added *Entries by subject* to Context · Current", "Years 7-11 now show", "A-level results for 2025/26", "This dashboard is now version 3."]) assert.equal(plainWords(t), t);
});

test("R-NO-TICKET-CODES: the 'Updated' strip and What's new draw through plainWords", () => {
  assert.match(src("components/editor/UpdatedNotice.tsx"), /plainWords\(memberSummary\(summary, config\)\)/);
  const fv = src("components/front-door/first-visit.tsx");
  assert.match(fv, /plainWords\(first\.title\)/);
  assert.match(fv, /plainWords\(e\.title\)/);
  assert.match(fv, /plainWords\(e\.body\)/);
});
