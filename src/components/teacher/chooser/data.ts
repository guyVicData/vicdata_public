"use client";

// Comparator chooser: every fetch the screens make. Each is a thin call to a route or
// table that already exists and already owns its answer -- the member Data View's
// default-lists / expand-nearest / boarding-quintile-list / adjacent-las / la-set, the
// public-read schools table -- plus the chooser's one new route,
// /api/teacher/ranking-population. Nothing is recomputed here.
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { BoardingQuintileBand, DefaultList, DefaultListEntry } from "@/lib/default-comparator-lists";
import { sectorTag, type SectorTag } from "@/lib/typology";
import type { PopulationRow, RankingScope } from "@/lib/comparator-chooser";

type Supa = ReturnType<typeof createBrowserSupabaseClient>;

async function authed<T>(supabase: Supa, url: string): Promise<T | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? ((await res.json()) as T) : null;
}

export type DefaultListsPayload = {
  list1: DefaultList | null;
  list2: DefaultList | null;
  boardingBand: BoardingQuintileBand | null;
  boardingRecipe: DefaultList | null;
  local16Plus: DefaultList | null;
};

export const fetchDefaultLists = (supabase: Supa, urn: string) =>
  authed<DefaultListsPayload>(supabase, `/api/data-view/default-lists?urn=${encodeURIComponent(urn)}`);

// The +5/-5 stepper re-runs the same matching pipeline wider (expand-nearest), or -- when
// "10 nearest" is the boarding-quintile recipe -- that recipe wider.
export async function fetchNearest(supabase: Supa, urn: string, count: number, recipe: "list1" | "boarding"): Promise<DefaultListEntry[] | null> {
  if (recipe === "boarding") {
    const body = await authed<{ list3: DefaultList | null }>(supabase, `/api/data-view/boarding-quintile-list?urn=${encodeURIComponent(urn)}&count=${count}`);
    return body?.list3?.schools ?? null;
  }
  const body = await authed<{ list: DefaultList }>(supabase, `/api/data-view/expand-nearest?urn=${encodeURIComponent(urn)}&count=${count}`);
  return body?.list.schools ?? null;
}

export async function fetchAdjacentLas(supabase: Supa, urn: string): Promise<string[]> {
  const body = await authed<{ adjacent: { name: string }[] }>(supabase, `/api/data-view/adjacent-las?urn=${encodeURIComponent(urn)}`);
  return (body?.adjacent ?? []).map((a) => a.name);
}

export async function fetchLaSet(supabase: Supa, urn: string, laNames: string[]): Promise<DefaultListEntry[] | null> {
  const body = await authed<{ set: DefaultList | null }>(supabase, `/api/data-view/la-set?urn=${encodeURIComponent(urn)}&las=${encodeURIComponent(laNames.join(","))}`);
  return body?.set?.schools ?? null;
}

export async function fetchPopulation(
  supabase: Supa,
  urn: string,
  phase: "ks4" | "ks5",
  scope: RankingScope,
): Promise<{ rows: PopulationRow[]; ownRegion: { code: string; name: string } | null } | null> {
  const s = scope.kind === "nation" ? "nation" : `region:${scope.code}`;
  return authed(supabase, `/api/teacher/ranking-population?urn=${encodeURIComponent(urn)}&phase=${phase}&scope=${encodeURIComponent(s)}`);
}

// A school's sector, boarding and LA for its row: one read of the public schools table,
// sector by typology.ts's sectorTag() and "has boarders" by the same boarders_name rule
// default-comparator-lists.ts uses (not null, not "No boarders").
export type SchoolDetail = { name: string; sector: SectorTag | null; boarders: boolean; laName: string | null; easting: number | null; northing: number | null };

export async function fetchSchoolDetails(supabase: Supa, urns: string[]): Promise<Map<string, SchoolDetail>> {
  const out = new Map<string, SchoolDetail>();
  const unique = Array.from(new Set(urns));
  for (let i = 0; i < unique.length; i += 150) {
    const { data } = await supabase
      .from("schools")
      .select("urn, current_name, la_name, establishment_type_group, establishment_type, boarders_name, easting, northing")
      .in("urn", unique.slice(i, i + 150));
    for (const r of (data ?? []) as {
      urn: string;
      current_name: string;
      la_name: string | null;
      establishment_type_group: string | null;
      establishment_type: string | null;
      boarders_name: string | null;
      easting: number | null;
      northing: number | null;
    }[]) {
      out.set(r.urn, {
        name: r.current_name,
        sector: sectorTag(r.establishment_type_group, r.establishment_type),
        boarders: r.boarders_name !== null && r.boarders_name !== "No boarders",
        laName: r.la_name,
        easting: r.easting,
        northing: r.northing,
      });
    }
  }
  return out;
}
