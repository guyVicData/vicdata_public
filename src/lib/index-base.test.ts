// VicData 0.8 audit fixes (4): the index base is the first year every line shares, and the label
// names that year -- never a fixed 2019/20 or 2012.
// Run: npx -y tsx --test src/lib/index-base.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLL_INDEX_MIN, indexBaseWords, indexedLabel, indexOwn, indexTo } from "./index-base";

const pts = (from: number, vals: (number | null)[]) => vals.map((value, i) => ({ year: from + i, value }));

test("lines that share only a later year are indexed to it, and the label says so", () => {
  // The school from 2019, the LA only from 2021: the base is 2021, not 2019.
  const r = indexTo([pts(2019, [500, 520, 540, 560]), pts(2021, [2000, 2100])]);
  assert.equal(r.base, 2021);
  assert.equal(r.out[0][2].value, 100);
  assert.equal(r.out[1][0].value, 100);
  assert.equal(Math.round(r.out[0][3].value!), 104);
  assert.equal(r.out[0][0].value, (500 / 540) * 100);
  assert.equal(indexedLabel(r.base), "2021/22 = 100");
  assert.equal(indexedLabel(r.base, "calendar"), "2021 = 100");
});

test("a gap in one line moves the base past it", () => {
  const r = indexTo([pts(2012, [10, 11, 12]), pts(2012, [null, 20, 22])]);
  assert.equal(r.base, 2013);
  assert.equal(indexedLabel(r.base, "calendar"), "2013 = 100");
});

test("no shared year: each line from its own first year, and the label says that", () => {
  const r = indexTo([pts(2019, [1, 2]), pts(2021, [3, 4])]);
  assert.equal(r.base, null);
  assert.equal(r.out[0][0].value, 100);
  assert.equal(r.out[1][0].value, 100);
  assert.equal(indexBaseWords(null), "each line's first year");
  assert.equal(indexedLabel(null), "each line's first year = 100");
});

test("indexOwn (F-20, F-36): to the shared base where the line has it, else its own first year; small under ROLL_INDEX_MIN", () => {
  const a = indexOwn(pts(2019, [200, 210, 220]), 2019);
  assert.deepEqual([a.from, a.base, a.values[2].value, a.small], [2019, 200, 110, false]);
  // Opened in 2021: indexed to its own first year.
  const b = indexOwn(pts(2019, [null, null, 60, 90]), 2019);
  assert.deepEqual([b.from, b.base, b.values[0].value, b.values[3].value, b.small], [2021, 60, null, 150, false]);
  // Under the threshold at its base: small (named, not drawn).
  assert.equal(indexOwn(pts(2019, [ROLL_INDEX_MIN - 1, 80]), 2019).small, true);
  assert.equal(indexOwn(pts(2019, [ROLL_INDEX_MIN, 80]), 2019).small, false);
  // No figure at all.
  const c = indexOwn(pts(2019, [null, null]), 2019);
  assert.deepEqual([c.from, c.base, c.small], [null, null, true]);
});
