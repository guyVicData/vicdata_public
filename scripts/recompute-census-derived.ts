#!/usr/bin/env -S npx tsx
// Member Data View performance architecture v1, §3/§4. Recomputes the two derived
// tables that depend on CENSUS data -- boarding_quintiles, and the new 'ons_region'
// (+ multi-year 'national') rows in roll_aggregates -- so the Boarding, Region, and
// Nation comparator buttons never make a live cross-Supabase-project census fetch on
// a member's click. Run this on every census-affecting ingest promote (the DfE school
// census re-syncs); see docs/vicdata_data_view_open_questions.md for the promote-hook
// wiring and reasoning.
//
// Usage: npx tsx --env-file=.env scripts/recompute-census-derived.ts
//
// boarding_quintiles: replicates default-comparator-lists.ts's boardingQuintileList()
// quintile computation EXACTLY (same three sector/phase/basis combinations, same
// nominal-phase pre-filter, same effectivePhaseTags/boardersTotal/roll>0 filter, same
// ascending sortKey/quintileSize/quintile bucketing) -- reused via direct import
// (effectivePhaseTags, phaseTags, genderTag, boardingRatio, fetchCensusFactsBatched),
// not re-derived, so this table can never quietly drift from what that live function
// would compute for the same school. The one thing NOT replicated here is that
// function's own "insert an arbitrary target into an existing sorted pool" step --
// unnecessary here, since every row THIS script writes already IS a real member of
// its own category's candidate pool, not an outside school being slotted in.
//
// roll_aggregates: extends sync-roll-aggregates.ts's own proven fetch/accumulate
// pattern (same MAINSTREAM_GROUPS, same AGE_BREAKDOWN_RE, same shape classifier) with
// a region_code dimension (src/lib/region-crosswalk.ts, computed directly from
// schools.la_name -- NOT read from school_region_nation, so this script has no
// run-order dependency on scripts/recompute-school-geo-derived.ts having run first)
// and a multi-year loop (2019 - CURRENT_CENSUS_PERIOD, matching data-view-profiles.ts's
// own TREND_ANCHOR_PERIOD) so the Region/Nation A3 summary sentence has real
// "since 2019/20"-style trend data to read, the same basis Round 6's boarding fix
// established for that sentence.

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { fetchCensusFactsBatched } from "../src/lib/data-view-profiles";
import { singleAgeGenderCountsForPeriod, CURRENT_CENSUS_PERIOD, AGE_BANDS, type AgeBandKey, SHAPE_CLASSIFICATION_MIN_AGE, SHAPE_CLASSIFICATION_MAX_AGE } from "../src/lib/roll-data";
import { phaseTags, effectivePhaseTags, boardingRatio } from "../src/lib/typology";
import { resolveRegionNation } from "../src/lib/region-crosswalk";
import { classifyShape } from "../src/lib/shape-classifier";

// ROLL_AGGREGATES_START_PERIOD (opt-in, defaults to the real 2019 trend anchor):
// resume the multi-year roll_aggregates loop from a specific year rather than
// redoing every year from scratch -- useful after a partial run (each period's own
// fetch/accumulate/upsert is independent and already-written years are unaffected by
// re-running, but skipping them outright saves real time given how long the shared
// reference_data_lookup endpoint's own retries can take per year).
const TREND_START_PERIOD = process.env.ROLL_AGGREGATES_START_PERIOD ? parseInt(process.env.ROLL_AGGREGATES_START_PERIOD, 10) : 2019;

// ---------------------------------------------------------------------------
// Part 1: boarding_quintiles
// ---------------------------------------------------------------------------

type SchoolRow = {
  urn: string;
  current_name: string;
  la_name: string | null;
  easting: number | null;
  northing: number | null;
  establishment_type_group: string | null;
  establishment_type: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
  boarders_name: string | null;
  gender: string | null;
  status: string;
};

const BOARDING_CATEGORIES: {
  boardingSchoolType: "independent_boarding_senior" | "independent_boarding_prep" | "state_boarding";
  sectorGroups: string[];
  requirePhase: "Senior" | "Prep";
  quintileBasis: "headcount" | "ratio";
}[] = [
  { boardingSchoolType: "independent_boarding_senior", sectorGroups: ["Independent schools"], requirePhase: "Senior", quintileBasis: "headcount" },
  { boardingSchoolType: "independent_boarding_prep", sectorGroups: ["Independent schools"], requirePhase: "Prep", quintileBasis: "ratio" },
  { boardingSchoolType: "state_boarding", sectorGroups: ["Academies", "Local authority maintained schools", "Free Schools"], requirePhase: "Senior", quintileBasis: "headcount" },
];

async function fetchAllSchools(): Promise<SchoolRow[]> {
  const supabase = createServiceRoleSupabaseClient();
  const rows: SchoolRow[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("schools")
      .select(
        "urn, current_name, la_name, easting, northing, establishment_type_group, establishment_type, statutory_low_age, statutory_high_age, boarders_name, gender, status",
      )
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as SchoolRow[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

async function recomputeBoardingQuintiles(schools: SchoolRow[]) {
  const supabase = createServiceRoleSupabaseClient();

  for (const cat of BOARDING_CATEGORIES) {
    console.log(`boarding_quintiles: ${cat.boardingSchoolType}...`);
    const candidatePool = schools.filter(
      (s) =>
        s.status !== "closed" &&
        cat.sectorGroups.includes(s.establishment_type_group ?? "") &&
        s.boarders_name !== null &&
        s.boarders_name !== "No boarders",
    );
    const nominalFiltered = candidatePool.filter((s) =>
      phaseTags(s.statutory_low_age, s.statutory_high_age, s.establishment_type).includes(cat.requirePhase),
    );
    console.log(`  ${candidatePool.length} candidates, ${nominalFiltered.length} after nominal phase filter`);
    if (nominalFiltered.length === 0) continue;

    const facts = await fetchCensusFactsBatched(nominalFiltered.map((s) => s.urn));

    type QuintileCandidate = { urn: string; boardersTotal: number; ratio: number };
    const withBoarding: QuintileCandidate[] = [];
    for (const s of nominalFiltered) {
      const schoolFacts = facts.filter((f) => f.entity_id === s.urn);
      const counts = singleAgeGenderCountsForPeriod(schoolFacts, CURRENT_CENSUS_PERIOD);
      if (counts.size === 0) continue;
      const effectiveTags = effectivePhaseTags(s.statutory_low_age, s.statutory_high_age, s.establishment_type, counts);
      if (!effectiveTags.includes(cat.requirePhase)) continue;
      const boardersTotal = schoolFacts.find((f) => f.period === CURRENT_CENSUS_PERIOD && f.breakdown === "boarders_total")?.value_numeric ?? null;
      if (boardersTotal === null || boardersTotal <= 0) continue;
      let total = 0;
      for (const v of counts.values()) total += v.male + v.female;
      if (total === 0) continue;
      withBoarding.push({ urn: s.urn, boardersTotal, ratio: boardingRatio({ boarders: boardersTotal, total }) });
    }
    console.log(`  ${withBoarding.length} with real boarding data this period`);
    if (withBoarding.length === 0) continue;

    const sortKey = cat.quintileBasis === "headcount" ? (c: QuintileCandidate) => c.boardersTotal : (c: QuintileCandidate) => c.ratio;
    const sorted = [...withBoarding].sort((a, b) => sortKey(a) - sortKey(b));
    const quintileSize = Math.ceil(sorted.length / 5);

    const rows = sorted.map((c, index) => ({
      urn: c.urn,
      boarding_school_type: cat.boardingSchoolType,
      quintile_basis: cat.quintileBasis,
      quintile: Math.min(4, Math.floor(index / quintileSize)),
      national_boarding_pool_size: sorted.length,
      boarders_total: c.boardersTotal,
      boarding_ratio: c.ratio,
      census_period: CURRENT_CENSUS_PERIOD,
      computed_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("boarding_quintiles").upsert(rows, { onConflict: "urn" });
    if (error) throw error;
    console.log(`  wrote ${rows.length} rows`);
  }
}

// ---------------------------------------------------------------------------
// Part 2: roll_aggregates ('national' extended across years, new 'ons_region')
// ---------------------------------------------------------------------------

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;
const MAINSTREAM_GROUPS = ["Academies", "Local authority maintained schools", "Independent schools", "Free Schools"];
const MAX_RETRIES = 5;
const PAGE_SIZE = 1000;
const MAX_PAGES = 3000;
const ENTITY_BATCH_SIZE = 100;
const BATCH_SIZE = 10;

function bandForAge(age: number): AgeBandKey | null {
  const band = AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
  return band ? band.key : null;
}

type Accumulator = {
  byBand: Map<AgeBandKey, number>;
  byShapeAge: Map<number, number>;
  male: number;
  female: number;
  boardersTotal: number;
  schoolUrns: Set<string>;
};

function newAccumulator(): Accumulator {
  return { byBand: new Map(AGE_BANDS.map((b) => [b.key, 0])), byShapeAge: new Map(), male: 0, female: 0, boardersTotal: 0, schoolUrns: new Set() };
}

async function fetchPage(entityIds: string[], period: number, offset: number): Promise<{ entity_id: string; breakdown: string; value_numeric: number | null }[]> {
  const apiUrl = process.env.VICDATA_API_URL!;
  const anonKey = process.env.VICDATA_ANON_KEY!;
  for (let attempt = 0; ; attempt++) {
    // Real crash found running this for real (2026-10-09): a bare `await fetch(...)`
    // doesn't just resolve with a non-ok Response on failure -- it can also REJECT
    // outright (a mid-request socket reset, `TypeError: fetch failed` / SocketError),
    // which this loop's own retry logic never caught, crashing the whole script
    // uncaught at period 2025 (the very last period) after 2019-2024 had already
    // completed successfully. Wrapped the fetch itself in try/catch so a network-level
    // failure gets the exact same retry treatment as an HTTP-level one, instead of two
    // different resilience levels for what's really the same class of transient
    // problem (the shared reference_data_lookup endpoint's own well-documented
    // flakiness under load elsewhere in this codebase's sync-*.ts scripts).
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/rest/v1/rpc/reference_data_lookup`, {
        method: "POST",
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_source_id: "dfe_school_census",
          p_entity_ids: entityIds,
          p_period_min: period,
          p_period_max: period,
          p_limit: PAGE_SIZE,
          p_offset: offset,
          p_breakdowns: null,
        }),
      });
    } catch (e) {
      if (attempt >= MAX_RETRIES) throw new Error(`reference_data_lookup failed after ${MAX_RETRIES} retries: ${(e as Error).message}`);
      const delayMs = 2000 * 2 ** attempt;
      console.log(`  retry ${attempt + 1}/${MAX_RETRIES} after network error (${(e as Error).message}) (period ${period}, offset ${offset}), waiting ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }
    if (res.ok) return res.json();
    const body = await res.text();
    if (attempt >= MAX_RETRIES) throw new Error(`reference_data_lookup failed after ${MAX_RETRIES} retries: HTTP ${res.status} ${body}`);
    const delayMs = 2000 * 2 ** attempt;
    console.log(`  retry ${attempt + 1}/${MAX_RETRIES} after HTTP ${res.status} (period ${period}, offset ${offset}), waiting ${delayMs}ms...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

async function recomputeRollAggregatesForPeriod(period: number, regionByUrn: Map<string, string | null>, mainstreamUrns: string[]) {
  const supabase = createServiceRoleSupabaseClient();
  const national = newAccumulator();
  const byRegion = new Map<string, Accumulator>();

  function accumulate(urn: string, breakdown: string, value: number) {
    const match = AGE_BREAKDOWN_RE.exec(breakdown);
    const isBoarding = breakdown === "boarders_total";
    if (!match && !isBoarding) return;
    const regionCode = regionByUrn.get(urn);

    const target = (acc: Accumulator) => {
      acc.schoolUrns.add(urn);
      if (isBoarding) {
        acc.boardersTotal += value;
        return;
      }
      const [, , sex, ageStr] = match!;
      const age = Number(ageStr);
      const band = bandForAge(age);
      if (band) acc.byBand.set(band, (acc.byBand.get(band) ?? 0) + value);
      acc.byShapeAge.set(age, (acc.byShapeAge.get(age) ?? 0) + value);
      if (sex === "male") acc.male += value;
      else acc.female += value;
    };

    target(national);
    if (regionCode) {
      if (!byRegion.has(regionCode)) byRegion.set(regionCode, newAccumulator());
      target(byRegion.get(regionCode)!);
    }
  }

  const entityBatches: string[][] = [];
  for (let i = 0; i < mainstreamUrns.length; i += ENTITY_BATCH_SIZE) entityBatches.push(mainstreamUrns.slice(i, i + ENTITY_BATCH_SIZE));

  async function fetchBatch(batch: string[]): Promise<number> {
    let offset = 0;
    let rowCount = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = await fetchPage(batch, period, offset);
      for (const row of rows) if (row.value_numeric !== null) accumulate(row.entity_id, row.breakdown, row.value_numeric);
      rowCount += rows.length;
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return rowCount;
  }

  let totalRows = 0;
  for (let i = 0; i < entityBatches.length; i += BATCH_SIZE) {
    const group = entityBatches.slice(i, i + BATCH_SIZE);
    const counts = await Promise.all(group.map(fetchBatch));
    totalRows += counts.reduce((a, b) => a + b, 0);
  }
  console.log(`  period ${period}: ${totalRows} rows, ${byRegion.size} regions`);

  if (national.schoolUrns.size === 0) {
    console.log(`  period ${period}: no data at all, skipping (school probably has no census data this year)`);
    return;
  }

  function toRow(scope: "national" | "ons_region", scopeKey: string, acc: Accumulator) {
    const bandTotals = AGE_BANDS.map((b) => ({ key: b.key, total: acc.byBand.get(b.key) ?? 0 }));
    const totalRoll = acc.male + acc.female;
    const nonZeroAgesInClamp = Array.from(acc.byShapeAge.entries()).filter(
      ([age, total]) => total > 0 && age >= SHAPE_CLASSIFICATION_MIN_AGE && age <= SHAPE_CLASSIFICATION_MAX_AGE,
    );
    const shapeAgeTotals: { key: string; total: number }[] = [];
    if (nonZeroAgesInClamp.length > 0) {
      const minAge = Math.min(...nonZeroAgesInClamp.map(([age]) => age));
      const maxAge = Math.max(...nonZeroAgesInClamp.map(([age]) => age));
      for (let age = minAge; age <= maxAge; age++) shapeAgeTotals.push({ key: String(age), total: acc.byShapeAge.get(age) ?? 0 });
    }
    const shape = classifyShape(shapeAgeTotals);
    return {
      scope,
      scope_key: scopeKey,
      period,
      total_roll: totalRoll,
      school_count: acc.schoolUrns.size,
      age_band_totals: Object.fromEntries(bandTotals.map((b) => [b.key, b.total])),
      shape_label: shape?.label ?? null,
      gender_male: acc.male,
      gender_female: acc.female,
      boarders_total: acc.boardersTotal,
      computed_at: new Date().toISOString(),
    };
  }

  const rows = [toRow("national", "", national), ...Array.from(byRegion.entries()).map(([code, acc]) => toRow("ons_region", code, acc))];
  const { error } = await supabase.from("roll_aggregates").upsert(rows, { onConflict: "scope,scope_key,period" });
  if (error) throw error;
}

async function recomputeRollAggregates(schools: SchoolRow[]) {
  const regionByUrn = new Map<string, string | null>();
  const mainstreamUrns: string[] = [];
  for (const s of schools) {
    if (!MAINSTREAM_GROUPS.includes(s.establishment_type_group ?? "")) continue;
    mainstreamUrns.push(s.urn);
    regionByUrn.set(s.urn, resolveRegionNation(s.la_name).regionCode);
  }
  console.log(`roll_aggregates: ${mainstreamUrns.length} mainstream schools, periods ${TREND_START_PERIOD}-${CURRENT_CENSUS_PERIOD}`);

  for (let period = TREND_START_PERIOD; period <= CURRENT_CENSUS_PERIOD; period++) {
    console.log(`roll_aggregates: fetching period ${period}...`);
    await recomputeRollAggregatesForPeriod(period, regionByUrn, mainstreamUrns);
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("loading schools...");
  const schools = await fetchAllSchools();
  console.log(`  ${schools.length} schools loaded`);

  await recomputeBoardingQuintiles(schools);
  await recomputeRollAggregates(schools);

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
