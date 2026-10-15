// VicData 0.8 audit fixes (4): the index base is the first year every line shares, and the label
// names that year -- never a fixed 2019/20 or 2012.
// Run: npx -y tsx --test src/lib/index-base.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { indexBaseWords, indexedLabel, indexTo } from "./index-base";

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
