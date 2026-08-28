#!/usr/bin/env -S npx tsx
// Precomputes per-age-band (roll-data.ts's AGE_BANDS) pupil-count DISTRIBUTIONS across
// schools into age_band_pupil_distributions (dashboard rebuild, phase-breakdown
// size-badge card). Same fetch/accumulate shape as sync-roll-aggregates.ts (that
// script sums one total per band across ALL schools; this one keeps every
// PER-SCHOOL total per band, to compute a real distribution -- mean + quintile
// boundaries -- not just a sum). Deliberately excludes schools with a zero headcount
// in a given band from that band's distribution -- see the migration's own comment
// for why (a primary-only school diluting the Sixth Form distribction isn't the
// comparison a viewer wants).
//
// Usage: npx tsx --env-file=.env scripts/sync-age-band-distributions.ts

import { createServiceRoleSupabaseClient } from "../src/lib/supabase";
import { AGE_BANDS, type AgeBandKey, CURRENT_CENSUS_PERIOD } from "../src/lib/roll-data";

const PAGE_SIZE = 1000;
const BATCH_SIZE = 10;
const MAX_PAGES = 3000;
const ENTITY_BATCH_SIZE = 100;
const TARGET_PERIOD = CURRENT_CENSUS_PERIOD;

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;
const MAINSTREAM_GROUPS = ["Academies", "Local authority maintained schools", "Independent schools", "Free Schools"];

function bandForAge(age: number): AgeBandKey | null {
  const band = AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
  return band ? band.key : null;
}

// 2026-08-28, found running this job for real: the shared reference_data_lookup RPC
// intermittently statement-timeouts under concurrent load -- NOT the documented
// >160k-OFFSET ceiling (sync-roll-aggregates.ts's own comment; each 100-school batch
// here never approaches that), reproduced twice at genuinely different, essentially
// random progress points (immediately, then at batch 320/450) -- a real but transient
// flakiness in the shared endpoint under this job's own concurrency, not a structural
// per-call limit. Retried with backoff rather than failing the whole run over one
// flaky page.
const MAX_RETRIES = 5;

async function fetchPage(
  entityIds: string[],
  offset: number,
): Promise<{ entity_id: string; breakdown: string; value_numeric: number | null }[]> {
  const apiUrl = process.env.VICDATA_API_URL!;
  const anonKey = process.env.VICDATA_ANON_KEY!;
  for (let attempt = 0; ; attempt++) {
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
    if (res.ok) return res.json();
    const body = await res.text();
    if (attempt >= MAX_RETRIES) {
      throw new Error(`reference_data_lookup failed after ${MAX_RETRIES} retries: HTTP ${res.status} ${body}`);
    }
    const delayMs = 2000 * 2 ** attempt;
    console.log(`  retry ${attempt + 1}/${MAX_RETRIES} after HTTP ${res.status} (offset ${offset}, ${entityIds.length} entities), waiting ${delayMs}ms...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

// entity_id -> band_key -> total (this school's own per-band headcount, summed
// across both sexes -- the distribution axis is total pupils in the band, same unit
// the dashboard card displays).
type PerSchoolBandTotals = Map<string, Map<AgeBandKey, number>>;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function toRows(scope: "national" | "regional", scopeKey: string | null, byBand: Map<AgeBandKey, number[]>) {
  const rows: {
    scope: "national" | "regional";
    scope_key: string | null;
    band_key: string;
    period: number;
    school_count: number;
    mean_roll: number;
    p20: number;
    p40: number;
    p60: number;
    p80: number;
    computed_at: string;
  }[] = [];
  for (const band of AGE_BANDS) {
    const values = (byBand.get(band.key) ?? []).slice().sort((a, b) => a - b);
    if (values.length === 0) continue; // no school in this scope has a real headcount in this band
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    rows.push({
      scope,
      scope_key: scopeKey,
      band_key: band.key,
      period: TARGET_PERIOD,
      school_count: values.length,
      mean_roll: mean,
      p20: quantile(values, 0.2),
      p40: quantile(values, 0.4),
      p60: quantile(values, 0.6),
      p80: quantile(values, 0.8),
      computed_at: new Date().toISOString(),
    });
  }
  return rows;
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

  const perSchool: PerSchoolBandTotals = new Map();

  function accumulate(urn: string, breakdown: string, value: number) {
    const match = AGE_BREAKDOWN_RE.exec(breakdown);
    if (!match) return;
    if (!laByUrn.has(urn)) return; // not a mainstream school we're tracking
    const [, , , ageStr] = match;
    const age = Number(ageStr);
    const band = bandForAge(age);
    if (!band) return;
    if (!perSchool.has(urn)) perSchool.set(urn, new Map());
    const schoolBands = perSchool.get(urn)!;
    schoolBands.set(band, (schoolBands.get(band) ?? 0) + value);
  }

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
  console.log(`done fetching: ${totalRows} rows, ${perSchool.size} schools with real band data`);

  // Fold per-school totals into national + regional (by LA) value lists, only ever
  // including a school in a band's list when it has a genuine non-zero total there.
  const nationalByBand = new Map<AgeBandKey, number[]>();
  const regionalByBand = new Map<string, Map<AgeBandKey, number[]>>();

  for (const [urn, bands] of perSchool) {
    const la = laByUrn.get(urn);
    for (const [band, total] of bands) {
      if (total <= 0) continue;
      if (!nationalByBand.has(band)) nationalByBand.set(band, []);
      nationalByBand.get(band)!.push(total);
      if (la) {
        if (!regionalByBand.has(la)) regionalByBand.set(la, new Map());
        const laBands = regionalByBand.get(la)!;
        if (!laBands.has(band)) laBands.set(band, []);
        laBands.get(band)!.push(total);
      }
    }
  }

  const rows = [
    ...toRows("national", "", nationalByBand),
    ...Array.from(regionalByBand.entries()).flatMap(([la, byBand]) => toRows("regional", la, byBand)),
  ];

  console.log(`writing ${rows.length} distribution rows...`);
  const { error } = await supabase
    .from("age_band_pupil_distributions")
    .upsert(rows, { onConflict: "scope,scope_key,band_key,period" });
  if (error) throw error;

  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
