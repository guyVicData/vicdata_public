// Run: npx -y tsx --test src/lib/subject-entry-size.test.ts
// R-SMT-ENTRIES-SIZE: England's fifths of the schools entering a subject, and the XS-XL badge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entrySizeBadge, entrySizeKey, fifthsOf, MIN_SCHOOLS_TO_SIZE, quantile, tooFewSchoolsToSize } from "./subject-entry-size";

// Real dry-run figures (8 Nov): KS5 2024 GCE A level Psychology, 2,317 schools entering.
const PSYCHOLOGY = { schools: 2317, p20: 10, p40: 17, p60: 26, p80: 40 };

test("exactly on a cut point is the band above (sizeBadgeForValue's < rule)", () => {
  assert.equal(entrySizeBadge(10, PSYCHOLOGY), "S");
  assert.equal(entrySizeBadge(17, PSYCHOLOGY), "M");
  assert.equal(entrySizeBadge(26, PSYCHOLOGY), "L");
  assert.equal(entrySizeBadge(40, PSYCHOLOGY), "XL");
});

test("below p20 is XS, between cut points the band, above p80 XL", () => {
  assert.equal(entrySizeBadge(1, PSYCHOLOGY), "XS");
  assert.equal(entrySizeBadge(9, PSYCHOLOGY), "XS");
  assert.equal(entrySizeBadge(23, PSYCHOLOGY), "M"); // Plumstead Manor's 23 A-level Psychology entries, 2024/25
  assert.equal(entrySizeBadge(39, PSYCHOLOGY), "L");
  assert.equal(entrySizeBadge(400, PSYCHOLOGY), "XL");
});

test("null when too few schools enter it, or the school doesn't, or there are no fifths", () => {
  const few = { ...PSYCHOLOGY, schools: MIN_SCHOOLS_TO_SIZE - 1 };
  assert.equal(entrySizeBadge(20, few), null);
  assert.equal(tooFewSchoolsToSize(few), true);
  assert.equal(entrySizeBadge(20, { ...PSYCHOLOGY, schools: MIN_SCHOOLS_TO_SIZE }), "M");
  assert.equal(tooFewSchoolsToSize({ ...PSYCHOLOGY, schools: MIN_SCHOOLS_TO_SIZE }), false);
  assert.equal(tooFewSchoolsToSize(null), false);
  assert.equal(entrySizeBadge(0, PSYCHOLOGY), null);
  assert.equal(entrySizeBadge(null, PSYCHOLOGY), null);
  assert.equal(entrySizeBadge(undefined, PSYCHOLOGY), null);
  assert.equal(entrySizeBadge(20, null), null);
  assert.equal(entrySizeBadge(20, undefined), null);
});

test("fifths: schools with no entries are left out; linear-interpolation quantiles", () => {
  assert.equal(fifthsOf([0, 0, 0]), null);
  assert.equal(fifthsOf([]), null);
  // 1..11 (and three zeros, ignored): positions (n-1)q = 2, 4, 6, 8.
  assert.deepEqual(fifthsOf([0, 0, 0, 11, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), { schools: 11, p20: 3, p40: 5, p60: 7, p80: 9 });
  // Interpolated and rounded to 2 dp: [1, 2, 3, 4] -> 1.6, 2.2, 2.8, 3.4.
  assert.deepEqual(fifthsOf([4, 3, 2, 1]), { schools: 4, p20: 1.6, p40: 2.2, p60: 2.8, p80: 3.4 });
  assert.equal(quantile([5], 0.8), 5);
  // Each fifth holds a fifth of the schools: 100 schools 1..100 give 20 per badge.
  const f = fifthsOf(Array.from({ length: 100 }, (_, i) => i + 1))!;
  const per = new Map<string, number>();
  for (let n = 1; n <= 100; n++) per.set(entrySizeBadge(n, f)!, (per.get(entrySizeBadge(n, f)!) ?? 0) + 1);
  assert.deepEqual([...per.values()], [20, 20, 20, 20, 20]);
});

test("the key is qualification, subject and year", () => {
  assert.equal(entrySizeKey({ qualification: "GCE A level", subject: "Psychology", period: 2024 }), "GCE A level::Psychology::2024");
});
