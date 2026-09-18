// Server-only client for vicdata's (Phase 1 ingest repo) live reference-data API.
// Mirrors vicdash's backend/app/reference_data.py -- same RPC, same pagination
// discipline (PostgREST caps every response at 1000 rows regardless of query size).
// Never import ingest code directly into this repo (brief) -- this only ever talks to
// the live, anon-key-callable RPC.

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export type ReferenceFact = {
  entity_id: string;
  period: number;
  period_basis: string;
  breakdown: string;
  value_numeric: number | null;
  value_text: string | null;
  value_category: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function fetchPage(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const apiUrl = requireEnv("VICDATA_API_URL");
  const anonKey = requireEnv("VICDATA_ANON_KEY");
  const res = await fetch(`${apiUrl}/rest/v1/rpc/${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // This is per-school-page live data, not a static asset -- never cache across
    // requests for different schools at the framework layer.
    cache: "no-store",
    // 2026-08-28: real bug caught live -- a caller's own AbortSignal (schools-in-bounds
    // aborting on a fast pan/zoom, propagating the original NextRequest's signal) needs
    // to reach THIS fetch specifically, or the abort stops meaning anything the moment
    // it crosses into this module -- the actual Supabase network call keeps running
    // regardless, wasting real backend time on work nobody's waiting for any more.
    signal,
  });
  if (!res.ok) {
    throw new Error(`${path} failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function lookupReferenceData(params: {
  sourceId: string;
  entityIds?: string[];
  periodMin?: number;
  periodMax?: number;
  breakdowns?: string[];
  signal?: AbortSignal;
}): Promise<ReferenceFact[]> {
  const rows: ReferenceFact[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "reference_data_lookup",
      {
        p_source_id: params.sourceId,
        p_entity_ids: params.entityIds ?? null,
        p_period_min: params.periodMin ?? null,
        p_period_max: params.periodMax ?? null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_breakdowns: params.breakdowns ?? null,
      },
      params.signal,
    )) as ReferenceFact[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Age-aggregated roll totals for a batch of schools -- reference_data_age_gender_totals
// (2026-08-27, docs/OPEN_QUESTIONS.md), the server-side-aggregated replacement for
// schools-in-bounds's old "fetch every raw breakdown row, sum client-side" approach, which
// was silently truncating results once a viewport's row volume passed lookupReferenceData's
// 50-page pagination cap. One row per (school, age actually present) with both sexes as
// columns, zero-total ages dropped -- ~5.5x fewer rows than a first columnar-free version
// measured on a real 418-school viewport (16,680 -> 3,018), since PostgREST hard-caps every
// RPC response at 1000 rows regardless of the function's own p_limit, so fewer rows means
// fewer paginated round-trips, not just a smaller payload. Includes the same
// clean-1:1-Predecessor lineage fallback as reference_data_lookup, so a school with no
// direct rows for the period still resolves via its predecessor here too.
export type AgeGenderTotal = {
  entity_id: string;
  age: number;
  male_total: number;
  female_total: number;
};

export async function lookupAgeGenderTotals(params: {
  sourceId: string;
  entityIds: string[];
  period: number;
  signal?: AbortSignal;
}): Promise<AgeGenderTotal[]> {
  const rows: AgeGenderTotal[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "reference_data_age_gender_totals",
      {
        p_source_id: params.sourceId,
        p_entity_ids: params.entityIds,
        p_period: params.period,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      },
      params.signal,
    )) as AgeGenderTotal[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Academic Results RPC bridge (docs/vicdata_phase3_academic_results_rpc_bridge_brief_v1.md
// Part B) -- same fetchPage/loop-until-short-page shape as lookupReferenceData/
// lookupAgeGenderTotals above, nothing new invented. Three RPCs, three wrapper
// functions -- one per genuinely different return shape (academic_headline_lookup,
// academic_subject_family_lookup, academic_geography_lookup), matching the "separate
// function per return shape" discipline those RPCs themselves follow.

export type KsStage = "ks4" | "ks5";

export type AcademicHeadlineRow = {
  entity_id: string;
  ks_stage: KsStage;
  period: number;
  measures: Record<string, number | string>;
};

export async function lookupAcademicHeadline(params: {
  entityIds?: string[];
  ksStage?: KsStage;
  periodMin?: number;
  periodMax?: number;
  signal?: AbortSignal;
}): Promise<AcademicHeadlineRow[]> {
  const rows: AcademicHeadlineRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "academic_headline_lookup",
      {
        p_entity_ids: params.entityIds ?? null,
        p_ks_stage: params.ksStage ?? null,
        p_period_min: params.periodMin ?? null,
        p_period_max: params.periodMax ?? null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      },
      params.signal,
    )) as AcademicHeadlineRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export type AcademicSubjectFamilyRow = {
  entity_id: string;
  ks_stage: KsStage;
  family_id: string;
  family_label: string;
  period: number;
  entries_total: number;
  entries_share_percent: number | null;
  avg_point_score: number | null;
  points_coverage_percent: number | null;
  // Appended by the bucket-aware rollup round. 'all' is the pre-existing whole-school
  // row; the rest are the KS5 comparability buckets.
  bucket?: string;
};

export async function lookupAcademicSubjectFamily(params: {
  entityIds?: string[];
  ksStage?: KsStage;
  familyIds?: string[];
  periodMin?: number;
  periodMax?: number;
  // undefined means the RPC default, 'all'. null asks for every bucket in one call.
  bucket?: string | null;
  signal?: AbortSignal;
}): Promise<AcademicSubjectFamilyRow[]> {
  const rows: AcademicSubjectFamilyRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "academic_subject_family_lookup",
      {
        p_entity_ids: params.entityIds ?? null,
        p_ks_stage: params.ksStage ?? null,
        p_family_ids: params.familyIds ?? null,
        p_period_min: params.periodMin ?? null,
        p_period_max: params.periodMax ?? null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        p_bucket: params.bucket === undefined ? 'all' : params.bucket,
      },
      params.signal,
    )) as AcademicSubjectFamilyRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Subject deep-dive round: subject-GRAIN sibling of lookupAcademicSubjectFamily above,
// backed by vicdata's own new academic_subject_headline_lookup RPC
// (vicdata/supabase/migrations/20260915110000_academic_subject_headline_lookup.sql --
// read directly, same structural template as academic_subject_family_lookup, not
// academic_subject_family_map_lookup, since this is entity-scoped). Real, multi-period
// data (2020/21 on, once the companion backend round's historic promotion landed --
// confirmed live before this round started) -- the only real source for a subject's
// own trend that far back; the raw dfe_ks4_subject_entries/dfe_ks5_subject_results
// facts fetchSubjectLevelData reads are modern-only (2023/24 on, see that function's
// own header comment for why the historic siblings aren't used there).
export type AcademicSubjectHeadlineRow = {
  entity_id: string;
  ks_stage: KsStage;
  subject: string;
  family_id: string;
  family_label: string;
  period: number;
  entries_total: number;
  entries_share_of_school_percent: number | null;
  entries_share_of_family_percent: number | null;
  avg_point_score: number | null;
  points_coverage_percent: number | null;
};

// Fault isolation for academic_subject_headline_lookup. NOT a size limit.
//
// Real bug, reproduced live 2026-09-17 against the hosted database. A small number of
// INDIVIDUAL schools make this RPC cross the database's statement timeout at ks4,
// failing with Postgres 57014 ("canceling statement due to statement timeout") and
// surfacing as an HTTP 500. URN 150956 (Gateacre School) is the confirmed example:
//
//   150956 alone, ks4, any family filter -> ~3,050ms, HTTP 500
//   150956 alone, ks5, any family filter -> ~2,410ms, HTTP 200 (89 rows)
//   100053 alone, ks4, any family filter ->     73ms, HTTP 200 (143 rows)
//
// It is per-school and per-stage, not a volume problem: with no such school in the
// set, ks4 answers 120 schools in 176ms. That distinction matters because the
// obvious reading -- "GCSE sets are bigger/heavier, so they time out" -- is wrong,
// and chunking for SIZE would fix nothing.
//
// One poisoned school used to blank the entire drawer, because a single rejected
// call failed the whole request. Chunking here bounds that blast radius: a bad
// school takes out its own chunk and the remaining schools still return. Per-chunk
// failures are logged with their entity ids and the result is partial rather than
// empty, which is the right trade for a comparison view -- 39 schools of 40 is
// useful, nothing at all is not.
//
// Chunks run SEQUENTIALLY. Running them in parallel was tried and is worse than the
// original bug: concurrent statements contend for the same database and all slow
// past the timeout (measured: 2 of 8 chunks failed at ks4, 6 of 8 at ks5, where the
// single unchunked ks5 call had succeeded).
//
// Rare enough (0 of 60 schools in a fresh sample) that this is containment, not a
// cure. The real fix belongs upstream in the vicdata project, on the RPC or its
// indexes; see this round's build report.
const HEADLINE_ENTITY_CHUNK = 20;

async function lookupAcademicSubjectHeadlineChunk(
  entityIds: string[] | null,
  params: { ksStage?: KsStage; familyId?: string; periodMin?: number; periodMax?: number; bucket?: string; signal?: AbortSignal },
): Promise<AcademicSubjectHeadlineRow[]> {
  const rows: AcademicSubjectHeadlineRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "academic_subject_headline_lookup",
      {
        p_entity_ids: entityIds,
        p_ks_stage: params.ksStage ?? null,
        p_family_id: params.familyId ?? null,
        p_period_min: params.periodMin ?? null,
        p_period_max: params.periodMax ?? null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
        // Omitted means the RPC's own default, 'all' -- byte-identical to the rows
        // this call returned before the bucket dimension existed.
        p_bucket: params.bucket ?? 'all',
      },
      params.signal,
    )) as AcademicSubjectHeadlineRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function lookupAcademicSubjectHeadline(params: {
  entityIds?: string[];
  ksStage?: KsStage;
  familyId?: string;
  periodMin?: number;
  periodMax?: number;
  bucket?: string;
  signal?: AbortSignal;
}): Promise<AcademicSubjectHeadlineRow[]> {
  const entityIds = params.entityIds ?? null;
  // Unscoped (every entity), or a single chunk's worth: one call, and a failure
  // still throws, exactly as before this fix -- there is nothing to isolate it from.
  if (!entityIds || entityIds.length <= HEADLINE_ENTITY_CHUNK) {
    return lookupAcademicSubjectHeadlineChunk(entityIds, params);
  }
  // Sequential, and tolerant per chunk -- see HEADLINE_ENTITY_CHUNK above.
  const rows: AcademicSubjectHeadlineRow[] = [];
  const failed: string[] = [];
  for (let i = 0; i < entityIds.length; i += HEADLINE_ENTITY_CHUNK) {
    const chunk = entityIds.slice(i, i + HEADLINE_ENTITY_CHUNK);
    try {
      rows.push(...(await lookupAcademicSubjectHeadlineChunk(chunk, params)));
    } catch (err) {
      failed.push(...chunk);
      console.error("[lookupAcademicSubjectHeadline] chunk failed, continuing with the rest", {
        ksStage: params.ksStage,
        familyId: params.familyId,
        entityIds: chunk,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // Every chunk failed: that is not partial data, it is no data, and the caller
  // should see an error rather than an empty result it would render as "nothing yet".
  if (rows.length === 0 && failed.length === entityIds.length) {
    throw new Error(`academic_subject_headline_lookup failed for all ${failed.length} entities`);
  }
  return rows;
}

// Subject area round, 2026-09-14: exposes subject_family_map itself (raw_subject ->
// family_id, per ks_stage) -- a static reference table, not entity-scoped, so no
// entityIds param at all (genuinely different shape from the two lookups above,
// which are both per-school). Needed so the frontend can finally filter "subjects
// within this category" instead of listing every real subject for the stage
// regardless of category (this file's own header comment on the previous round
// already flagged this exact gap).
export type AcademicSubjectFamilyMapRow = {
  raw_subject: string;
  family_id: string;
  ks_stage: KsStage;
};

export async function lookupAcademicSubjectFamilyMap(params: {
  ksStage?: KsStage;
  familyIds?: string[];
  signal?: AbortSignal;
}): Promise<AcademicSubjectFamilyMapRow[]> {
  const rows: AcademicSubjectFamilyMapRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "academic_subject_family_map_lookup",
      {
        p_ks_stage: params.ksStage ?? null,
        p_family_ids: params.familyIds ?? null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      },
      params.signal,
    )) as AcademicSubjectFamilyMapRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

export type AcademicGeographyRow = {
  grouping_type: "la" | "region" | "national";
  grouping_key: string;
  ks_stage: KsStage;
  family_id: string;
  measure: string;
  period: number;
  avg_value: number | null;
  entries_total: number | null;
  school_count: number;
};

// p_ks_stage is required on this RPC (not optional like the other two) -- see that
// migration's own comment: unfiltered, this table returns ~31,000 rows spanning every
// measure/grouping/family at once, and no real call site wants that.
// KS5 qualification-type-awareness round (docs/vicdata_phase3_academic_results_ks5_
// cohort_brief_v1.md Part 2) -- ground-truth IB/Pre-U flag per URN, from a new small
// RPC exposing dfe_ks5_subject_results' own qualification_detailed dimension (not
// previously exposed via any RPC -- reference_data_lookup's own p_breakdowns filter is
// exact-match against the FULL breakdown string, and subject/size/grade vary per row,
// so it can't answer "does this school have any real IB row at all" on its own). A URN
// absent from the result has neither flag -- same "absence means false" convention as
// every other lookup here.
export type Ks5QualificationFlagsRow = {
  entity_id: string;
  has_ib: boolean;
  has_pre_u: boolean;
};

export async function lookupAcademicKs5QualificationFlags(params: {
  entityIds: string[];
  signal?: AbortSignal;
}): Promise<Ks5QualificationFlagsRow[]> {
  if (params.entityIds.length === 0) return [];
  return (await fetchPage(
    "academic_ks5_qualification_flags_lookup",
    { p_entity_ids: params.entityIds },
    params.signal,
  )) as Ks5QualificationFlagsRow[];
}

export async function lookupAcademicGeography(params: {
  ksStage: KsStage;
  measure?: string;
  groupingType?: "la" | "region" | "national";
  groupingKeys?: string[];
  familyId?: string;
  periodMin?: number;
  periodMax?: number;
  signal?: AbortSignal;
}): Promise<AcademicGeographyRow[]> {
  const rows: AcademicGeographyRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage(
      "academic_geography_lookup",
      {
        p_ks_stage: params.ksStage,
        p_measure: params.measure ?? null,
        p_grouping_type: params.groupingType ?? null,
        p_grouping_keys: params.groupingKeys ?? null,
        p_family_id: params.familyId ?? null,
        p_period_min: params.periodMin ?? null,
        p_period_max: params.periodMax ?? null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      },
      params.signal,
    )) as AcademicGeographyRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// Academic Results round 2 (docs/vicdata_phase3_academic_results_region_nation_
// comparator_brief_v1.md): academic_region_nation_rank() returns a single real jsonb
// object (top15/neighbours/total/targetRank), not a `returns table` set -- unlike
// every other wrapper in this file, this doesn't page via fetchPage's own
// loop-until-short-page discipline (there's nothing to page; PostgREST returns a
// scalar function's jsonb return value directly, not wrapped in an array), so this is
// a small, direct POST rather than a call through fetchPage.
export type AcademicRegionNationRankEntry = { urn: string; name: string; value: number; rank: number };
export type AcademicRegionNationRankResult = { total: number; targetRank: number | null; top15: AcademicRegionNationRankEntry[]; neighbours: AcademicRegionNationRankEntry[] };

export async function lookupAcademicRegionNationRank(params: {
  ksStage: KsStage;
  measure: string;
  regionCode?: string | null;
  nation?: string | null;
  targetUrn: string;
  signal?: AbortSignal;
}): Promise<AcademicRegionNationRankResult> {
  const apiUrl = requireEnv("VICDATA_API_URL");
  const anonKey = requireEnv("VICDATA_ANON_KEY");
  const res = await fetch(`${apiUrl}/rest/v1/rpc/academic_region_nation_rank`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_ks_stage: params.ksStage,
      p_measure: params.measure,
      p_region_code: params.regionCode ?? null,
      p_nation: params.nation ?? null,
      p_target_urn: params.targetUrn,
    }),
    cache: "no-store",
    signal: params.signal,
  });
  if (!res.ok) {
    throw new Error(`academic_region_nation_rank failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as Partial<AcademicRegionNationRankResult> | null;
  return {
    total: data?.total ?? 0,
    targetRank: data?.targetRank ?? null,
    top15: data?.top15 ?? [],
    neighbours: data?.neighbours ?? [],
  };
}
