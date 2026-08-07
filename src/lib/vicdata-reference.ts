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
}): Promise<ReferenceFact[]> {
  const rows: ReferenceFact[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = (await fetchPage("reference_data_lookup", {
      p_source_id: params.sourceId,
      p_entity_ids: params.entityIds ?? null,
      p_period_min: params.periodMin ?? null,
      p_period_max: params.periodMax ?? null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
      p_breakdowns: params.breakdowns ?? null,
    })) as ReferenceFact[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}
