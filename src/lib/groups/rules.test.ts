// VicData 0.8 groups r2 (E): the R-GROUP-* rules, on Harris Federation and Dukes Education.
//
// They read the group lookups through aggregates.ts, so the same file runs on either source:
//   overnight, on the ingest's dry run (the fixtures):
//     VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures npx -y tsx --test src/lib/groups/rules.test.ts
//   after the promote, on production (the switch off):
//     npx -y tsx --env-file=.env --test src/lib/groups/rules.test.ts
// The expected figures are the ingest's G5 spot checks and G0's corrected Dukes figures
// (~/dev/vicdata docs/vicdata_group_aggregates_report_v1.md). If a figure differs, the test fails and
// the round stops: the test is never changed to match.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPARISON_KINDS, groupAggregate, groupComparisons, groupDataSource, groupSchoolsYear, type Figures, type GroupAggregate } from "./aggregates";
import { buildOverview, buildSchools, kindsFor, FOCI, MEASURE_PHASE, parseCompare, DEFAULT_COMPARE } from "./dash";

const HARRIS = "3320";
const DUKES = "club_iss:dukes-education";
const CARDIFF = "402394";
console.log(`[R-GROUP] reading the ${groupDataSource()}`);

const agg = async (g: string, r: "at_time" | "listed_now") => {
  const a = await groupAggregate(g, r);
  assert.ok(a, `${g} ${r}: the lookup answers`);
  return a!;
};
const at = (a: GroupAggregate, p: number, ph = "all"): Figures => a.rows.find((r) => r.period === p && r.phase === ph)!.figures;

test("R-GROUP-COUNTS: every figure the views show carries the lookup's n", async () => {
  for (const g of [HARRIS, DUKES]) {
    const a = await agg(g, "at_time");
    const comps = await groupComparisons(g, kindsFor(DEFAULT_COMPARE));
    for (const focus of FOCI) {
      if (focus !== "all" && !a.rows.some((r) => r.phase === focus)) continue;
      const o = buildOverview({ agg: a, comps, compare: DEFAULT_COMPARE, focus });
      const census = o.years.census;
      assert.equal(o.now.schools, at(a, census, focus).n_schools, `${g} ${focus}: schools n`);
      assert.equal(o.now.roll, at(a, census, focus).roll, `${g} ${focus}: roll`);
      for (const row of o.against.rows) {
        for (const [m, cell] of Object.entries(row.cells)) {
          const y = o.years.results[m];
          if (y === null) continue;
          const ph = focus === "all" ? MEASURE_PHASE[m] : focus;
          const src = row.key === "group" ? a.rows : comps.filter((c) => (c.kind === "peer_named" ? `peer_named:${c.variant}` : `${c.kind}:${c.variant}`) === row.key && c.reading === "at_time");
          const f = src.find((r) => r.period === y && r.phase === ph)?.figures;
          const want = f ? (f.results[m] ?? f.value_added[m] ?? null) : null;
          assert.equal(cell.n, want ? want.n_with_figure : null, `${g} ${focus} ${row.key} ${m}: n`);
          assert.equal(cell.value, want ? want.weighted : null, `${g} ${focus} ${row.key} ${m}: value`);
        }
      }
    }
  }
});

test("R-GROUP-MISSING: every current member school is in the Schools table, with a figure or a reason", async () => {
  for (const g of [HARRIS, DUKES]) {
    const a = await agg(g, "at_time");
    const schools = await groupSchoolsYear(g);
    const s = buildSchools({ agg: a, schools, focus: "all" });
    const current = schools.filter((x) => x.role === "member" && x.years.some((y) => y.listed_now)).map((x) => x.urn);
    assert.deepEqual(s.rows.map((r) => r.urn).sort(), [...current].sort(), `${g}: every current member listed`);
    for (const r of s.rows) assert.ok(r.headline || (r.reason && r.reason.length > 3), `${g} ${r.urn}: a figure or a reason`);
  }
});

test("R-GROUP-READING: both readings give the lookup's figures, and the default is at the time", async () => {
  for (const g of [HARRIS, DUKES]) {
    for (const rd of ["at_time", "listed_now"] as const) {
      const a = await agg(g, rd);
      assert.equal(a.reading, rd);
      const o = buildOverview({ agg: a, comps: await groupComparisons(g, kindsFor(DEFAULT_COMPARE)), compare: DEFAULT_COMPARE, focus: "all" });
      assert.equal(o.reading, rd);
      assert.equal(o.now.roll, at(a, o.years.census).roll);
    }
  }
  assert.equal(parseCompare(null), "peer_band");
});

test("R-GROUP-PEERS: no self-declared group in any peer set; the peer band is the ingest's", async () => {
  for (const g of [HARRIS, DUKES]) {
    const a = await agg(g, "at_time");
    assert.notEqual(a.group.source, "self_declared");
    const comps = await groupComparisons(g, COMPARISON_KINDS);
    const band = comps.filter((c) => c.kind === "peer_band");
    assert.ok(band.length > 0, `${g}: a peer band`);
    assert.ok(band.every((c) => c.set_id === a.peer?.set_id), `${g}: the band is the group's own (${a.peer?.set_id})`);
  }
  assert.equal((await agg(HARRIS, "at_time")).peer?.set_id, "peer:mat:41+");
  assert.equal((await agg(HARRIS, "at_time")).peer?.n_groups, 16);
  assert.equal((await agg(DUKES, "at_time")).peer?.set_id, "peer:independent_company:21-40");
});

test("R-GROUP-HARRIS-ROLL: Harris' combined roll equals the sum of its schools' census rolls (the ingest's G5)", async () => {
  const schools = await groupSchoolsYear(HARRIS);
  for (const [rd, want] of [["at_time", 42940], ["listed_now", 48960]] as const) {
    const a = await agg(HARRIS, rd);
    const p = 2025;
    const sum = schools.reduce((t, s) => {
      const y = s.years.find((x) => x.period === p);
      return t + (y && y[rd] && y.figures ? y.figures.roll : 0);
    }, 0);
    assert.equal(at(a, p).roll, want, `${rd}: the ingest's G5 figure`);
    assert.equal(sum, want, `${rd}: the sum of its schools' rolls`);
  }
});

test("R-GROUP-DUKES: Dukes' roll and change are G0's corrected figures, Cardiff Sixth Form College outside England", async () => {
  for (const rd of ["at_time", "listed_now"] as const) {
    const a = await agg(DUKES, rd);
    const f = at(a, 2025);
    assert.equal(f.roll, 6392);
    assert.equal(at(a, 2024).roll, 7014);
    assert.equal(at(a, 2019).roll, 7144, "2019/20 with Orchard House (Ealing), the predecessor");
    assert.equal(f.change!["1"].combined_pct, -8.87);
    assert.equal(f.change!["3"].combined_pct, -5.88);
    assert.equal(f.change!["5"].combined_pct, -6.54);
    assert.equal(f.change!["3"].same_schools_pct, -8.57);
    assert.equal(f.change!["5"].same_schools_pct, -10.67);
    assert.ok((f.excluded!.roll ?? []).some((e) => e.urn === CARDIFF && e.reason === "outside_england"));
    const o = buildOverview({ agg: a, comps: await groupComparisons(DUKES, kindsFor(DEFAULT_COMPARE)), compare: DEFAULT_COMPARE, focus: "all" });
    assert.ok(o.now.outside.some((e) => e.urn === CARDIFF), "listed beside the map, not drawn");
  }
  const s = buildSchools({ agg: await agg(DUKES, "at_time"), schools: await groupSchoolsYear(DUKES), focus: "all" });
  const cardiff = s.rows.find((r) => r.urn === CARDIFF);
  assert.ok(cardiff && cardiff.outsideEngland && /outside England/.test(cardiff.reason ?? ""), "the Schools table says why");
});
