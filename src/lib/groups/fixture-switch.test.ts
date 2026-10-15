// VicData 0.8 groups r2: the group fixtures can never be reached in production.
// Run: npx -y tsx --test src/lib/groups/fixture-switch.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { groupFixturesDir } from "./fixture-switch";

const ON = { VICDATA_GROUP_FIXTURES: "true", VICDATA_GROUP_FIXTURES_DIR: "docs/v0.8/groups_fixtures" };

test("on only for tests and harnesses: the flag exactly 'true' and a directory named", () => {
  assert.equal(groupFixturesDir({ ...ON }), "docs/v0.8/groups_fixtures");
  assert.equal(groupFixturesDir({ ...ON, NODE_ENV: "test" }), "docs/v0.8/groups_fixtures");
  assert.equal(groupFixturesDir({ ...ON, NODE_ENV: "development" }), "docs/v0.8/groups_fixtures");
});

test("never in a production build, never on Render, whatever else is set", () => {
  assert.equal(groupFixturesDir({ ...ON, NODE_ENV: "production" }), null);
  assert.equal(groupFixturesDir({ ...ON, RENDER: "true" }), null);
  assert.equal(groupFixturesDir({ ...ON, RENDER: "1", NODE_ENV: "development" }), null);
});

test("fails closed: anything short of the exact flag and a directory reads production", () => {
  for (const flag of [undefined, "", "1", "TRUE", "yes", "true "]) assert.equal(groupFixturesDir({ ...ON, VICDATA_GROUP_FIXTURES: flag }), null, String(flag));
  assert.equal(groupFixturesDir({ VICDATA_GROUP_FIXTURES: "true" }), null);
  assert.equal(groupFixturesDir({ VICDATA_GROUP_FIXTURES: "true", VICDATA_GROUP_FIXTURES_DIR: "  " }), null);
  assert.equal(groupFixturesDir({}), null);
});

test("only the group data module reads the switch; no route, page or component does", () => {
  const root = path.resolve(__dirname, "../..");
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f)) {
        const t = readFileSync(p, "utf8");
        if (/groupFixturesDir|VICDATA_GROUP_FIXTURES/.test(t)) hits.push(path.relative(root, p));
      }
    }
  };
  walk(root);
  assert.deepEqual(hits.sort(), ["lib/groups/aggregates.ts", "lib/groups/fixture-switch.ts"]);
});

test("no NEXT_PUBLIC_ name: the flag never reaches a client bundle", () => {
  const t = readFileSync(path.join(__dirname, "fixture-switch.ts"), "utf8");
  assert.ok(!/NEXT_PUBLIC_/.test(t));
});
