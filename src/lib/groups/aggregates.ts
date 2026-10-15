// VicData 0.8 groups r2: the group figures, read ONLY through production's three anon lookups
// (~/dev/vicdata docs/vicdata_group_aggregates_report_v1.md): group_aggregate_lookup,
// group_comparison_lookup and group_schools_year_lookup. Every figure, comparison and n is computed in
// the database; the app selects and words them. This is the one module that reads them, so the
// test-and-preview switch (fixture-switch.ts) sits here and nowhere else. Server-only.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cachedReference } from "../server-cache";
import { groupFixturesDir } from "./fixture-switch";

export type Reading = "at_time" | "listed_now";
export type Phase = "all" | "primary" | "secondary" | "post16";
export const READINGS: Reading[] = ["at_time", "listed_now"];

export type MeasureFig = { weighted: number | null; average_school: number | null; n_with_figure: number; n_weighted?: number; weight?: number | null };
export type Change = { from_period?: number; combined_pct: number | null; combined_base?: number | null; same_schools_pct: number | null; same_schools?: number; growing: number; shrinking: number };
export type Excluded = { urn: string; name: string; reason: string };
export type Place = { rank: number; of: number; tied: boolean };
export type SubjectArea = { family_id: string; points_per_entry: number | null; entries: number; n_schools: number; shown: boolean };
export type ShareRow = { pct: number | null; group_pupils: number };

export type Figures = {
  n_schools: number;
  n_with_roll?: number;
  roll: number;
  roll_by_age?: number[];
  roll_by_phase?: Record<"primary" | "secondary" | "post16", number>;
  boarders?: number;
  schools_by_phase?: Record<"primary" | "secondary" | "post16", number>;
  size_bands?: Record<string, number>;
  regions?: Record<string, number>;
  las?: Record<string, number>;
  confidence?: Record<string, number>;
  change?: Record<"1" | "3" | "5", Change>;
  results: Record<string, MeasureFig>;
  value_added: Record<string, MeasureFig>;
  excluded?: Record<string, Excluded[]>;
  share?: {
    sector: "all" | "independent";
    pct: number | null;
    group_pupils: number;
    area_pupils: number;
    regions: (ShareRow & { region_code: string; region_pupils: number | null })[];
    las: (ShareRow & { la_code: string; la_name: string; la_pupils: number | null })[];
  };
  peer?: { set_id: string; type: string; band: string; n_groups: number; places: Record<string, Place> } | null;
  subject_areas?: Partial<Record<"ks4" | "ks5", SubjectArea[]>>;
  cells?: number;
  change_basis?: string;
};

export type FigRow = { period: number; phase: Phase; figures: Figures };
export type BuildMeta = {
  periods: number[];
  available: Record<string, number[]>;
  reasons: Record<string, string>;
  measures: Record<string, string>;
  size_bands: string[];
  peer_types: Record<string, string>;
  phase_ages: Record<string, [number, number]>;
  phase_min_pupils: number;
  subject_min?: { schools: number; entries: number };
  subject_families?: { family_id: string; label: string; sort: number }[] | null;
  inputs_fetched_at?: string | null;
  commit?: string | null;
};

export type GroupAggregate = {
  group: { group_id: string; name: string; type: string; source: string };
  reading: Reading;
  membership: { as_of: string | null; sources: string[]; confirmed: number; likely: number; outside_england: number };
  peer: { set_id: string; type: string; band: string; n_groups: number } | null;
  rows: FigRow[];
  build: { build_id: number; computed_at: string; meta: BuildMeta } | null;
};

export type ComparisonKind = "peer_band" | "non_group" | "areas" | "england" | "mix_matched";
export const COMPARISON_KINDS: ComparisonKind[] = ["peer_band", "non_group", "areas", "england", "mix_matched"];
export type ComparisonRow = { kind: ComparisonKind | "peer_named"; variant: string; set_id: string | null; label: string; reading: Reading; period: number; phase: Phase; figures: Figures };

export type SchoolYearFigures = {
  roll: number;
  roll_by_phase: Record<"primary" | "secondary" | "post16", number>;
  roll_by_age: number[];
  boarders: number;
  phases: ("primary" | "secondary" | "post16")[];
  size_band: string | null;
  results: Record<string, number>;
  value_added: Record<string, number>;
  national_rank: Record<string, Place>;
  trend: Record<"1" | "3" | "5", number | null>;
  igcse: boolean;
  ks4_pupils: number | null;
};
export type SchoolYearRow = {
  urn: string;
  name: string | null;
  role: "member" | "predecessor";
  member_urn: string;
  basis: "dated" | "assumed" | "dated_leave";
  confidence: "confirmed" | "likely";
  source: string;
  outside_england: boolean;
  la_name: string | null;
  establishment_type_group: string | null;
  opened_date: string | null;
  closed_date: string | null;
  easting: number | null;
  northing: number | null;
  years: { period: number; at_time: boolean; listed_now: boolean; figures: SchoolYearFigures | null }[];
};

// The ingest recomputes at most daily; an hour keeps a page's several reads consistent and cheap.
const TTL_MS = 60 * 60_000;

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const url = process.env.VICDATA_API_URL;
  const key = process.env.VICDATA_ANON_KEY;
  if (!url || !key) throw new Error("VICDATA_API_URL / VICDATA_ANON_KEY are not set");
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${name} failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ------------------------------------------------------------------------- the fixtures (tests only)

// The fixtures name each group's calls by a short tag (manifest.json).
const FIXTURE_TAG: Record<string, string> = { "3320": "harris", "club_iss:dukes-education": "dukes" };

function fixture<T>(dir: string, file: string): T | null {
  try {
    return JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

/** The groups the fixtures hold (empty when the switch is off). */
export function fixtureGroups(): string[] {
  return groupFixturesDir(process.env) ? Object.keys(FIXTURE_TAG) : [];
}

/** Where the figures come from right now: "production", or "fixtures" (tests, harnesses, screenshots). */
export function groupDataSource(): "production" | "fixtures" {
  return groupFixturesDir(process.env) ? "fixtures" : "production";
}

// ------------------------------------------------------------------------------------ the lookups

/** G2 for one group in one reading (null: no figures for this group, or the lookups aren't there yet). */
export function groupAggregate(groupId: string, reading: Reading = "at_time"): Promise<GroupAggregate | null> {
  const dir = groupFixturesDir(process.env);
  if (dir) {
    const tag = FIXTURE_TAG[groupId];
    return Promise.resolve(tag ? fixture<GroupAggregate>(dir, `${tag}_group_aggregate_lookup_${reading}.json`) : null);
  }
  return cachedReference(`groups:aggregate:${groupId}:${reading}`, () => rpc<GroupAggregate | null>("group_aggregate_lookup", { p_group_id: groupId, p_reading: reading }), TTL_MS);
}

/** G3 rows for the asked kinds (both readings; every year and phase). Named groups: "peer_named:<id>". */
export function groupComparisons(groupId: string, kinds: string[]): Promise<ComparisonRow[]> {
  const dir = groupFixturesDir(process.env);
  if (dir) {
    const tag = FIXTURE_TAG[groupId];
    if (!tag) return Promise.resolve([]);
    const std = fixture<ComparisonRow[]>(dir, `${tag}_group_comparison_lookup.json`) ?? [];
    const named = fixture<ComparisonRow[]>(dir, `${tag}_group_comparison_lookup_named.json`) ?? [];
    const want = new Set(kinds);
    return Promise.resolve([...std.filter((r) => want.has(r.kind)), ...named.filter((r) => want.has(`peer_named:${r.variant}`))]);
  }
  const key = [...kinds].sort().join(",");
  return cachedReference(`groups:comparison:${groupId}:${key}`, () => rpc<ComparisonRow[]>("group_comparison_lookup", { p_group_id: groupId, p_kinds: kinds }), TTL_MS);
}

/** Every member school (and each predecessor it carries), its years nested. */
export function groupSchoolsYear(groupId: string): Promise<SchoolYearRow[]> {
  const dir = groupFixturesDir(process.env);
  if (dir) {
    const tag = FIXTURE_TAG[groupId];
    return Promise.resolve(tag ? (fixture<SchoolYearRow[]>(dir, `${tag}_group_schools_year_lookup.json`) ?? []) : []);
  }
  return cachedReference(`groups:schools-year:${groupId}`, () => rpc<SchoolYearRow[]>("group_schools_year_lookup", { p_group_id: groupId }), TTL_MS);
}

/** Do the lookups answer in production? (The round's start check; false when they don't exist yet.) */
export async function lookupsAnswer(groupId: string): Promise<boolean> {
  try {
    return (await groupAggregate(groupId, "at_time")) !== null;
  } catch {
    return false;
  }
}
