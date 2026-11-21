// Run: node --import tsx --test src/lib/warm-demo-script.test.ts
// Review pack 22 Nov, issue 9 (speed): scripts/warm-demo.mjs also warms Admissions 16+, Admissions Market share and
// the SMT set dialog's set list (each 4.8-6.5 s on first open), still one page at a time (a parallel warm-up broke
// the next request, bc6d8b0). The script itself needs the live site and a browser; this checks what it opens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const s = readFileSync(path.join(__dirname, "../../scripts/warm-demo.mjs"), "utf8");

test("warm-demo: Admissions 16+, Market share and the SMT set dialog are warmed, one at a time", () => {
  assert.match(s, /peek\("\/teacher\/admissions\?view=pipelines&entry=16%2B", "admissions"\)/);
  assert.match(s, /peek\("\/teacher\/admissions\?view=market-share", "admissions"\)/);
  assert.match(s, /\/api\/data-view\/default-lists/);
  assert.match(s, /Schools in the LA, regional and national rankings…/);
  assert.match(s, /await visitSetDialog\(\);/);
  assert.match(s, /for \(const \[label, path\] of PAGES\) await visit\(label, path\);/);
  assert.doesNotMatch(s, /Promise\.all|Promise\.allSettled/, "never in parallel");
});
