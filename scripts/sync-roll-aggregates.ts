#!/usr/bin/env -S npx tsx
// Precomputes regional (by LA)/national roll aggregates (rolls spec §3's free-tier
// "your context" section) into this project's own roll_aggregates table. Run
// periodically (a scheduled job, not per-request) -- see docs/OPEN_QUESTIONS.md for
// why a live per-request national aggregate isn't viable (~2M rows through the
// paginated reference_data_lookup API on every page view).
//
// Usage: npx tsx --env-file=.env scripts/sync-roll-aggregates.ts
//
// Same concurrent-pagination discipline as vicdash's reference_data.py (ThreadPoolExecutor
// there, Promise.all batches here): fetch page 1 to see if more exists, then fetch
// remaining pages in concurrent batches rather than one at a time.

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import {
  AGE_BANDS,
  type AgeBandKey,
  SHAPE_CLASSIFICATION_MIN_AGE,
  SHAPE_CLASSIFICATION_MAX_AGE,
  CURRENT_CENSUS_PERIOD,
} from "../src/lib/roll-data";
import { classifyShape } from "../src/lib/shape-classifier";

const PAGE_SIZE = 1000;
const BATCH_SIZE = 10;
const MAX_PAGES = 3000;
const TARGET_PERIOD = CURRENT_CENSUS_PERIOD;

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;
const MAINSTREAM_GROUPS = ["Academies", "Local authority maintained schools", "Independent schools", "Free Schools"];

function bandForAge(age: number): AgeBandKey | null {
  const band = AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
  return band ? band.key : null;
}

type Accumulator = {
  byBand: Map<AgeBandKey, number>;
  // Single ages 5-17 only -- the shape classifier's basis as of the "Public View
  // rebuild" design review (roll-data.ts's SHAPE_CLASSIFICATION_MIN_AGE/MAX_AGE).
  // Kept separate from byBand: byBand still feeds age_band_totals for display, this
  // feeds shape_label only.
  byShapeAge: Map<number, number>;
  male: number;
  female: number;
  boardersTotal: number;
  schoolUrns: Set<string>;
};

function newAccumulator(): Accumulator {
  return {
    byBand: new Map(AGE_BANDS.map((b) => [b.key, 0])),
    byShapeAge: new Map(),
    male: 0,
    female: 0,
    boardersTotal: 0,
    schoolUrns: new Set(),
  };
}

async function fetchPage(
  entityIds: string[],
  offset: number,
): Promise<{ entity_id: string; breakdown: string; value_numeric: number | null }[]> {
  const apiUrl = process.env.VICDATA_API_URL!;
  const anonKey = process.env.VICDATA_ANON_KEY!;
  const res = await fetch(`${apiUrl}/rest/v1/rpc/reference_data_lookup`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_source_id: "dfe_school_census",
      p_entity_ids: entityIds,
      p_period_min: TARGET_PERIOD,
      p_period_max: TARGET_PERIOD,
      p_limit: PAGE_SIZE,
      p_offset: offset,
      p_breakdowns: null,
    }),
  });
  if (!res.ok) throw new Error(`reference_data_lookup failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const supabase = createServiceRoleSupabaseClient();

  console.log("loading school -> LA map...");
  const laByUrn = new Map<string, string | null>();
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("schools")
        .select("urn, la_name, establishment_type_group")
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (MAINSTREAM_GROUPS.includes(row.establishment_type_group ?? "")) {
          laByUrn.set(row.urn, row.la_name);
        }
      }
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  console.log(`  ${laByUrn.size} mainstream schools loaded`);

  const national = newAccumulator();
  const regional = new Map<string, Accumulator>();

  function accumulate(urn: string, breakdown: string, value: number) {
    const match = AGE_BREAKDOWN_RE.exec(breakdown);
    const isBoarding = breakdown === "boarders_total";
    if (!match && !isBoarding) return;

    const la = laByUrn.get(urn);
    if (la === undefined) return; // not a mainstream school we're tracking

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
      if (age >= SHAPE_CLASSIFICATION_MIN_AGE && age <= SHAPE_CLASSIFICATION_MAX_AGE) {
        acc.byShapeAge.set(age, (acc.byShapeAge.get(age) ?? 0) + value);
      }
      if (sex === "male") acc.male += value;
      else acc.female += value;
    };

    target(national);
    if (la) {
      if (!regional.has(la)) regional.set(la, newAccumulator());
      target(regional.get(la)!);
    }
  }

  // Batched by entity_id (indexed lookup), not one giant unfiltered scan -- confirmed
  // for real that an unfiltered p_entity_ids=null pull hits a statement timeout once
  // OFFSET climbs past ~160k rows (real infrastructure ceiling in the shared
  // reference_data_lookup RPC, not something to work around by retrying). Each batch's
  // own pagination starts fresh from offset 0 and stays well under 10k -- a wide safety
  // margin below the observed failure point, not a value tuned to the exact threshold.
  const ENTITY_BATCH_SIZE = 100;
  const urnList = Array.from(laByUrn.keys());
  const entityBatches: string[][] = [];
  for (let i = 0; i < urnList.length; i += ENTITY_BATCH_SIZE) {
    entityBatches.push(urnList.slice(i, i + ENTITY_BATCH_SIZE));
  }
  console.log(`fetching dfe_school_census for period ${TARGET_PERIOD} in ${entityBatches.length} entity batches...`);

  async function fetchBatch(batch: string[]): Promise<number> {
    let offset = 0;
    let rowCount = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const rows = await fetchPage(batch, offset);
      for (const row of rows) {
        if (row.value_numeric !== null) accumulate(row.entity_id, row.breakdown, row.value_numeric);
      }
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
    console.log(`  batches ${i + group.length}/${entityBatches.length}, ${totalRows} rows so far...`);
  }
  console.log(`done fetching: ${totalRows} rows, ${regional.size} LAs`);

  function toRow(scope: "national" | "regional", scopeKey: string | null, acc: Accumulator) {
    const bandTotals = AGE_BANDS.map((b) => ({ key: b.key, total: acc.byBand.get(b.key) ?? 0 }));
    const totalRoll = acc.male + acc.female;
    const shapeAgeTotals: { key: string; total: number }[] = [];
    for (let age = SHAPE_CLASSIFICATION_MIN_AGE; age <= SHAPE_CLASSIFICATION_MAX_AGE; age++) {
      shapeAgeTotals.push({ key: String(age), total: acc.byShapeAge.get(age) ?? 0 });
    }
    const shape = classifyShape(shapeAgeTotals);
    return {
      scope,
      scope_key: scopeKey,
      period: TARGET_PERIOD,
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

  const rows = [
    // Empty string, not null, for national's scope_key: a plain UNIQUE constraint
    // treats every NULL as distinct from every other NULL, so upsert's ON CONFLICT
    // would never match the national row against itself on a re-run and duplicates
    // would accumulate -- caught before ever running this, not after.
    toRow("national", "", national),
    ...Array.from(regional.entries()).map(([la, acc]) => toRow("regional", la, acc)),
  ];

  console.log(`writing ${rows.length} aggregate rows...`);
  const { error } = await supabase.from("roll_aggregates").upsert(rows, { onConflict: "scope,scope_key,period" });
  if (error) throw error;

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
