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
