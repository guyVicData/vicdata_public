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
import { COMPARISON_KINDS, groupAggregate, groupComparisons, groupDataSource, groupSchoolsYear, namedCandidates, type ComparisonRow, type Figures, type GroupAggregate } from "./aggregates";
import { buildOverview, buildSchools, kindsFor, FOCI, MEASURE_PHASE, parseCompare, DEFAULT_COMPARE, type CompareKey } from "./dash";

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

// ------------------------------------------------------------------------------- groups r3 (A, P)
import { buildAcademic, buildPupils } from "./dash-r3";

const r3 = async (g: string, focus: "all" | "secondary" | "post16" | "primary") => {
  const agg = await groupAggregate(g, "at_time");
  const comps = await groupComparisons(g, kindsFor(DEFAULT_COMPARE));
  const schools = await groupSchoolsYear(g);
  return { a: buildAcademic({ agg: agg!, comps, schools, compare: DEFAULT_COMPARE, focus }), p: buildPupils({ agg: agg!, comps, schools, compare: DEFAULT_COMPARE, focus }), schools, agg: agg! };
};

test("R-GROUP-VA-SEPARATE: value added never appears in a results chart", async () => {
  for (const g of [HARRIS, DUKES])
    for (const focus of ["all", "secondary", "post16"] as const) {
      const { a } = await r3(g, focus);
      const charted = [...a.overview.trends.results.map((r) => r.measure), ...(a.post16 ?? []).map((r) => r.measure)];
      assert.ok(!charted.some((m) => m === "ks4_p8" || m === "ks5_va_alevel"), `${g} ${focus}: ${charted.join(" ")}`);
      assert.ok(a.headlines.every((h) => h.measures.every((m) => m.measure !== "ks4_p8" && m.measure !== "ks5_va_alevel")), `${g} ${focus}: no VA among the headlines`);
    }
});

test("R-GROUP-IGCSE: at group level, IGCSE schools are listed 'not ranked at GCSE', never ranked or counted", async () => {
  const { a, schools } = await r3(DUKES, "secondary");
  const igcse = new Set(schools.filter((s) => s.years.some((y) => y.figures?.igcse)).map((s) => s.urn));
  assert.ok(igcse.size >= 4, `Dukes has IGCSE schools (${igcse.size})`);
  for (const r of a.ranked.rows.filter((x) => igcse.has(x.urn))) {
    assert.equal(r.value, null, `${r.name}: no value`);
    assert.equal(r.inGroup, null, `${r.name}: no rank in the group`);
    assert.match(r.reason ?? "", /IGCSE: not ranked at GCSE/);
  }
  const ranked = a.ranked.rows.filter((x) => x.inGroup);
  assert.ok(ranked.every((x) => x.inGroup!.of === ranked.length), "ranks counted over schools with a figure only");
  const h = a.headlines.find((x) => x.phase === "secondary")!;
  assert.equal(h.withFigure, h.measures[0].group?.n_with_figure ?? 0, "the n is the lookup's");
  assert.ok(h.excluded.filter((e) => e.reason === "igcse").length >= 4, "IGCSE schools in the excluded list, with the reason");
});

test("subject areas: the audit-fixes minimum, n per area, the lookup's figures", async () => {
  const { a, agg } = await r3(HARRIS, "secondary");
  assert.equal(a.areas.stage, "ks4");
  const raw = agg.rows.find((r) => r.period === a.areas.year && r.phase === "secondary")!.figures.subject_areas!.ks4!;
  for (const r of a.areas.rows) {
    const x = raw.find((y) => y.family_id === r.familyId)!;
    assert.equal(r.group?.points_per_entry, x.points_per_entry);
    assert.ok(x.shown ? x.n_schools >= 2 : x.points_per_entry === null, `${r.label}: shown only with 2+ schools`);
  }
});

test("Pupils: Year 12 against Year 11 adds up from the schools' own rows; the shape is the lookup's", async () => {
  const { p, agg } = await r3(HARRIS, "all");
  assert.equal(p.leaving.reduce((t, r) => t + (r.y12 ?? 0), 0), p.stayingOn.y12);
  assert.equal(p.leaving.reduce((t, r) => t + (r.y11 ?? 0), 0), p.stayingOn.y11);
  assert.deepEqual(p.shape.ages, agg.rows.find((r) => r.period === p.shape.year && r.phase === "all")!.figures.roll_by_age);
});

// ------------------------------------------------------------------- comparison rows by key, not order
// group_comparison_lookup returns its rows in no fixed order (the ingest's verify: the same 448 rows as
// the fixtures, matched by key). Every view must read a comparison row by its full key (kind, variant,
// phase, reading, period), never by its position, so the views are the same whatever order the rows come in.

const compKey = (c: ComparisonRow) => `${c.kind}|${c.variant}|${c.phase}|${c.reading}|${c.period}`;
/** A fixed shuffle (seeded), so a failure reproduces. */
function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

test("R-GROUP-KEYS: each comparison row's key (kind, variant, phase, reading, period) is unique", async () => {
  for (const g of [HARRIS, DUKES]) {
    const named = (await namedCandidates(g, (await agg(g, "at_time")).group.type, 0)).slice(0, 3).map((n) => `peer_named:${n.id}`);
    const comps = await groupComparisons(g, [...COMPARISON_KINDS, ...named]);
    assert.ok(comps.length > 0, `${g}: comparison rows`);
    const seen = new Map<string, number>();
    for (const c of comps) seen.set(compKey(c), (seen.get(compKey(c)) ?? 0) + 1);
    const dups = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
    assert.deepEqual(dups, [], `${g}: duplicate comparison keys`);
  }
});

test("R-GROUP-KEYS: the views are the same whatever order the comparison and aggregate rows come in", async () => {
  for (const g of [HARRIS, DUKES]) {
    const a = await agg(g, "at_time");
    const named = (await namedCandidates(g, a.group.type, 0)).slice(0, 3).map((n) => n.id);
    const compares: CompareKey[] = ["peer_band", "non_group", "areas", "england", "mix_matched", ...(named.length ? [`peer_named:${named.join(",")}` as CompareKey] : [])];
    const kinds = [...new Set(compares.flatMap(kindsFor))];
    const comps = await groupComparisons(g, kinds);
    const schools = await groupSchoolsYear(g);
    const orders: [string, GroupAggregate, ComparisonRow[]][] = [
      ["reversed", { ...a, rows: [...a.rows].reverse() }, [...comps].reverse()],
      ["shuffled 1", { ...a, rows: shuffled(a.rows, 1) }, shuffled(comps, 7)],
      ["shuffled 2", { ...a, rows: shuffled(a.rows, 42) }, shuffled(comps, 2026)],
    ];
    for (const compare of compares)
      for (const focus of FOCI) {
        if (focus !== "all" && !a.rows.some((r) => r.phase === focus)) continue;
        const want = JSON.stringify({
          o: buildOverview({ agg: a, comps, compare, focus }),
          ac: buildAcademic({ agg: a, comps, schools, compare, focus }),
          pu: buildPupils({ agg: a, comps, schools, compare, focus }),
        });
        for (const [how, a2, c2] of orders) {
          const got = JSON.stringify({
            o: buildOverview({ agg: a2, comps: c2, compare, focus }),
            ac: buildAcademic({ agg: a2, comps: c2, schools, compare, focus }),
            pu: buildPupils({ agg: a2, comps: c2, schools, compare, focus }),
          });
          assert.ok(got === want, `${g} ${compare} ${focus}: the views change when the rows come ${how}`);
        }
      }
  }
});
