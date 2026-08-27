import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerAnonSupabaseClient } from "@/lib/supabase";
import {
  sectorTag,
  phaseTags,
  phaseTagAgeRange,
  genderTag,
  STATE_ESTABLISHMENT_GROUPS,
  type PhaseTag,
} from "@/lib/typology";
import { lookupAgeGenderTotals } from "@/lib/vicdata-reference";
import { CURRENT_CENSUS_PERIOD, type AgeGenderCounts } from "@/lib/roll-data";

// 2026-08-27, map popup/card redesign: the age-band + gender-split breakdown is
// member-tier only (Guy's own instruction), so a caller needs to prove they're a
// verified member of the school THEY'RE VIEWING (not of any school in the bounds
// pool -- there's no "am I a member of every school on screen" concept) to get it.
// Same check/pattern as /api/surrounding-schools-list -- the user's own access token
// passed through and checked against school_memberships' RLS -- but OPTIONAL here:
// this route's core job (positions/sector/roll for the map) must keep working for
// anonymous callers, so a missing/invalid token just means the extra fields are
// omitted, never a 403.
async function checkMembership(viewedUrn: string | null, authHeader: string | null): Promise<boolean> {
  if (!viewedUrn || !authHeader) return false;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", viewedUrn)
    .maybeSingle();
  return !!data;
}

// The three age bands for the member-tier popup breakdown (2026-08-27) -- reuses the
// SAME 11/16 boundaries phaseTags()/phaseTagAgeRange() already encode, deliberately,
// rather than the slightly different 4-10/11-15/16-18 bands mentioned verbally --
// avoids introducing a THIRD age-band scheme alongside this one and roll-data.ts's
// own separate AGE_BANDS (Early Years/Primary/Secondary/Sixth Form/19+, used
// elsewhere on the page). Flagged as a deliberate call, easy to change if these
// specific bands turn out to be wrong for this specific use.
function ageBandsFor(counts: AgeGenderCounts): { band1: number; band2: number; band3: number } | null {
  let band1 = 0, band2 = 0, band3 = 0;
  for (const [age, c] of counts) {
    const total = c.male + c.female;
    if (age <= 11) band1 += total;
    else if (age <= 16) band2 += total;
    else band3 += total;
  }
  return band1 + band2 + band3 > 0 ? { band1, band2, band3 } : null;
}

function genderSplitFor(counts: AgeGenderCounts): { girls: number; boys: number } | null {
  let girls = 0, boys = 0;
  for (const c of counts.values()) {
    girls += c.female;
    boys += c.male;
  }
  return girls + boys > 0 ? { girls, boys } : null;
}

// Bounds-based "all schools" fetch for the State of the School page's map (2026-08-24
// round, built after the investigation reported back: today's map only ever received
// the precomputed nearest-10 matchedSurrounding list; this route is the real
// architecture change that makes "show every state + independent school in view"
// possible, refetched on Leaflet moveend as the viewer pans/zooms -- see SchoolMap.tsx
// for the client side of this.
//
// Sargable against the existing schools_easting_northing_idx (a plain composite btree
// -- not a spatial index, but a straight range scan against ~52k rows is trivial
// regardless). Bounds are supplied in British National Grid (easting/northing), not
// lat/lng -- the client converts Leaflet's lat/lng viewport bounds via proj4 before
// calling this route, so the query stays a plain BETWEEN range rather than needing
// PostGIS or a reprojection per row here.
//
// Restricted to the four mainstream establishment_type_group values (same list
// nearest_schools' own mainstream filter uses) -- without this, sectorTag() would
// return null for a genuine slice of what's in view (special schools, colleges,
// universities), which would either need a third "no colour" rendering path or just
// silently misrender. NOT applying nearest_schools' extra alternative-provision/
// referral substring exclusion here -- that's real, flagged scope: a PRU or AP
// institution classified under one of the four mainstream groups (confirmed to happen
// in nearest_schools' own migration comment) will still show up here with a sector
// colour. Left as a known gap for now rather than silently copying that extra filter
// in -- worth a decision, not an assumption.
//
// 2026-08-27, EXPERIMENTAL: originally two thresholds (roll data only below 100
// schools, uniform small dots from 100-500, nothing above 500) -- Guy asked to
// extend roll-scaling all the way up to HARD_CAP so he could actually see it, not
// just hear a description, and get real timing numbers to decide whether the
// original 100-school gate should move or go away entirely. That gate existed for a
// PERFORMANCE reason (the roll-data batch lookup is a remote cross-repo RPC call --
// the genuinely expensive part, not the Postgres query), not a design one, so this
// change is explicitly provisional pending those numbers. The old 100-school
// threshold is gone from the code (nothing left to gate on it) but noted here in case
// the answer turns out to be "revert": HARD_CAP alone now decides whether roll data
// gets fetched at all; above it, still "zoom in," unchanged.
//
// Real measured numbers (temporary timing instrumentation, both test areas, several
// runs each): under 100 schools the lookup is ~1-2s (the original gate's own
// territory, not re-measured here). From ~230 schools up it jumps to 4-8s, and at
// 400-480 schools it ranged 6.5s up to 13-18s on individual runs -- i.e. NOT a smooth
// curve, and not simply proportional to school count either (444 schools ran faster
// than 315 did, on different runs). The real bottleneck looks like
// lookupReferenceData's own pagination (vicdata-reference.ts: PAGE_SIZE 1000, one
// sequential POST round-trip per page) rather than raw row volume -- a school's
// census facts are several rows each (per-age, per-gender, boarding breakdowns), so
// a few hundred schools can already need multiple full pages, each a separate remote
// round-trip. Whatever the exact cause, every measurement past ~200 schools was a
// clearly felt, multi-second wait on a real pan/zoom -- not a borderline case.
//
// 2026-08-28, split per sector, per Guy's direct instruction: real data check (a
// separate investigation, not re-run here) confirmed independent schools are 2-5x
// sparser per km2 than state schools even in populated areas -- a single shared cap
// meant a viewport dense with state schools (say 450 state + 80 independent, 530
// total) tripped the WHOLE thing over cap and showed nothing, even though the 80
// independent schools were perfectly fine on their own. Two separate caps mean that
// same viewport now shows all 80 independents (well under 250) while only state
// schools wait on a "zoom in" prompt (well over 150) -- no viewport can ever go fully
// blank for a sector that isn't actually over-represented. Combined worst case
// (150+250=400) is also strictly lower than the old shared 500, not just fairer.
const STATE_CAP = 150;
const INDEPENDENT_CAP = 250;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const minEasting = Number(sp.get("minEasting"));
  const maxEasting = Number(sp.get("maxEasting"));
  const minNorthing = Number(sp.get("minNorthing"));
  const maxNorthing = Number(sp.get("maxNorthing"));
  if ([minEasting, maxEasting, minNorthing, maxNorthing].some((n) => !Number.isFinite(n))) {
    return NextResponse.json(
      { error: "minEasting, maxEasting, minNorthing and maxNorthing are required" },
      { status: 400 },
    );
  }
  const viewedUrn = sp.get("urn");
  const includeMemberDetail = await checkMembership(viewedUrn, request.headers.get("authorization"));

  const supabase = createServerAnonSupabaseClient();

  type Row = {
    urn: string;
    current_name: string;
    establishment_type_group: string | null;
    statutory_low_age: number | null;
    statutory_high_age: number | null;
    gender: string | null;
    easting: number;
    northing: number;
  };

  // Two separate queries, one per sector, each fetching one row past ITS OWN cap --
  // enough to detect that sector's own over-cap without a separate COUNT(*). Run
  // concurrently (Promise.all), not sequentially -- same total round-trip cost as the
  // old single query, not double.
  //
  // abortSignal(request.signal), 2026-08-28: real bug caught live -- a fast pan/zoom
  // session fires several of these requests in quick succession; the client-side
  // debounce+AbortController (SchoolMap.tsx's scheduleBoundsFetch) correctly cancels
  // the STALE PROMISE on the client, but neither this query nor the roll-data lookup
  // below were ever told about that abort -- both kept running to full completion on
  // the server regardless, so a burst of pans left a real backlog of abandoned-but-
  // still-executing queries competing for the same Supabase connection/compute, and
  // the user's actual current viewport's response had to wait behind all of them.
  // Reproduced directly: markers correctly recovered after a zoom-out/zoom-in burst,
  // but only after ~12s -- reading as "disappeared and didn't come back" to a live
  // user who (reasonably) doesn't wait that long. request.signal is a real
  // AbortSignal on NextRequest, true when the client has actually disconnected --
  // wiring it through here and into lookupAgeGenderTotals below lets an abandoned
  // request actually stop instead of running to completion for nothing.
  const baseQuery = () =>
    supabase
      .from("schools")
      .select("urn, current_name, establishment_type_group, statutory_low_age, statutory_high_age, gender, easting, northing")
      .neq("status", "closed")
      .gte("easting", minEasting)
      .lte("easting", maxEasting)
      .gte("northing", minNorthing)
      .lte("northing", maxNorthing)
      .abortSignal(request.signal);

  const [stateResult, independentResult] = await Promise.all([
    baseQuery().in("establishment_type_group", STATE_ESTABLISHMENT_GROUPS).limit(STATE_CAP + 1),
    baseQuery().eq("establishment_type_group", "Independent schools").limit(INDEPENDENT_CAP + 1),
  ]);

  if (stateResult.error || independentResult.error) {
    // AbortError surfaces here as a Postgrest error, not a thrown exception (the
    // supabase-js client catches the abort internally) -- a 499-style "client gave up"
    // response, not a real server failure worth a 500 / worth logging as one.
    if (request.signal.aborted) {
      return NextResponse.json({ error: "Client aborted" }, { status: 499 });
    }
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const stateRows = (stateResult.data as Row[]) ?? [];
  const independentRows = (independentResult.data as Row[]) ?? [];
  const stateOverCap = stateRows.length > STATE_CAP;
  const independentOverCap = independentRows.length > INDEPENDENT_CAP;

  // Over-cap sectors are OMITTED entirely, not truncated to their own cap -- showing
  // an arbitrary CAP-sized subset of a much larger real population would misleadingly
  // read as "this is everything here," the same reason the old single-cap version
  // showed nothing rather than a partial 500. A sector that's within its own cap
  // still renders normally even when the OTHER sector is over -- that's the entire
  // point of splitting the cap in the first place.
  const rows = [
    ...(stateOverCap ? [] : stateRows),
    ...(independentOverCap ? [] : independentRows),
  ];

  const includeRoll = rows.length > 0;
  const rollByUrn = new Map<string, number>();
  // 2026-08-26, map phase-band roll sizing: only populated for THROUGH-schools (more
  // than one phase tag) -- a single-tag school's whole roll already IS that one
  // phase, so slicing it would be pure waste, both here and on the client (see
  // typology.ts's phaseTagAgeRange for the full reasoning and the confirmed 11/16
  // boundaries). Zero extra fetch cost either way: the per-age breakdown
  // (singleAgeGenderCountsForPeriod's own Map) is already being computed to produce
  // totalRoll below, just summed away before now -- this is a different reduction
  // over the SAME already-fetched facts, not a second query.
  const rollByPhaseByUrn = new Map<string, Partial<Record<PhaseTag, number>>>();
  // 2026-08-27, member-tier popup breakdown: same zero-extra-cost reasoning as
  // rollByPhase above -- ageBands/genderSplit are a different reduction over the SAME
  // already-fetched counts Map, not a second query. Only actually populated
  // (ageBandsByUrn/genderSplitByUrn stay empty otherwise) when includeMemberDetail is
  // true, so an anonymous caller doesn't pay even the reduction cost for data it'll
  // never receive.
  const ageBandsByUrn = new Map<string, { band1: number; band2: number; band3: number }>();
  const genderSplitByUrn = new Map<string, { girls: number; boys: number }>();
  if (includeRoll && rows.length > 0) {
    // 2026-08-27: replaces a per-school lookupReferenceData() call returning every raw
    // breakdown row (fine for a single school, but ~163 rows/school/period was silently
    // exceeding lookupReferenceData's 50-page pagination cap once a viewport held enough
    // schools -- see docs/OPEN_QUESTIONS.md). lookupAgeGenderTotals aggregates by
    // (entity_id, age) server-side with sex as columns and zero-total ages dropped, cutting
    // row volume ~5.5x versus a first version that kept sex as separate rows -- and includes
    // the same lineage fallback reference_data_lookup does. Grouped into a Map once here
    // (O(n)) rather than filtering the flat row list per school (O(n*schools)) -- a real cost
    // at HARD_CAP, not just tidiness.
    let totals;
    try {
      totals = await lookupAgeGenderTotals({
        sourceId: "dfe_school_census",
        entityIds: rows.map((r) => r.urn),
        period: CURRENT_CENSUS_PERIOD,
        signal: request.signal,
      });
    } catch (e) {
      // Same abort-is-not-a-real-failure handling as the schools query above --
      // lookupAgeGenderTotals's own fetch() rejects with a real AbortError once the
      // signal fires, no point building a response for a client that's already gone.
      if ((e as Error).name === "AbortError") {
        return NextResponse.json({ error: "Client aborted" }, { status: 499 });
      }
      throw e;
    }
    const countsByUrn = new Map<string, AgeGenderCounts>();
    for (const t of totals) {
      if (!countsByUrn.has(t.entity_id)) countsByUrn.set(t.entity_id, new Map());
      countsByUrn.get(t.entity_id)!.set(t.age, { male: t.male_total, female: t.female_total });
    }

    for (const r of rows) {
      const counts = countsByUrn.get(r.urn) ?? new Map();
      let total = 0;
      for (const v of counts.values()) total += v.male + v.female;
      if (total > 0) rollByUrn.set(r.urn, total);

      const phase = phaseTags(r.statutory_low_age, r.statutory_high_age);
      if (phase.length > 1 && r.statutory_low_age !== null && r.statutory_high_age !== null) {
        const byPhase: Partial<Record<PhaseTag, number>> = {};
        for (const tag of phase) {
          const [lo, hi] = phaseTagAgeRange(tag, r.statutory_low_age, r.statutory_high_age, phase);
          let sum = 0;
          for (const [age, c] of counts) {
            if (age >= lo && age <= hi) sum += c.male + c.female;
          }
          if (sum > 0) byPhase[tag] = sum;
        }
        if (Object.keys(byPhase).length > 0) rollByPhaseByUrn.set(r.urn, byPhase);
      }

      if (includeMemberDetail) {
        const bands = ageBandsFor(counts);
        if (bands) ageBandsByUrn.set(r.urn, bands);
        const split = genderSplitFor(counts);
        if (split) genderSplitByUrn.set(r.urn, split);
      }
    }
  }

  const schools = rows.map((r) => ({
    urn: r.urn,
    currentName: r.current_name,
    easting: r.easting,
    northing: r.northing,
    sector: sectorTag(r.establishment_type_group),
    phase: phaseTags(r.statutory_low_age, r.statutory_high_age),
    gender: genderTag(r.gender),
    totalRoll: rollByUrn.get(r.urn) ?? null,
    rollByPhase: rollByPhaseByUrn.get(r.urn) ?? null,
    ageBands: ageBandsByUrn.get(r.urn) ?? null,
    genderSplit: genderSplitByUrn.get(r.urn) ?? null,
  }));

  // overCap/cap are now per-sector objects, not a single combined flag+number -- a
  // client showing an active sector filter decides for itself which of the two
  // actually matters right now (e.g. filtered to Independent only, the state cap
  // being tripped is irrelevant noise, not something worth a banner over).
  return NextResponse.json({
    overCap: { state: stateOverCap, independent: independentOverCap },
    cap: { state: STATE_CAP, independent: INDEPENDENT_CAP },
    rollDataIncluded: includeRoll,
    memberDetailIncluded: includeMemberDetail,
    schools,
  });
}
