// Nearest-10 FE-college peer gender split (Prompt A, item 2) -- a genuinely separate
// module from surrounding-schools.ts, not a variant of it. That module's candidate
// generation runs entirely through the nearest_schools RPC, which is deliberately
// mainstream-only (20260809103000_nearest_schools_mainstream_filter.sql restricts to
// Academies/LA-maintained/Independent/Free Schools, and additionally filters candidates
// to the SAME sector as the target via an Independent-schools equality check) -- an FE
// college passed in as the target still only matches non-independent mainstream
// candidates, never other FE colleges. Reusing that RPC for FE-to-FE matching isn't a
// small tweak, it's the wrong tool.
//
// Real population here is small -- confirmed live, 372 FE_PARTICIPATION_ESTABLISHMENT_
// TYPES institutions with real easting/northing nationally, 289 of those with real
// (latest-period, non-suppressed, both sexes >0) under-19 ILR gender data -- so this
// follows la-sector-composition.ts's own precedent (a few hundred rows is cheap, this
// is NOT the "thousands of schools through a paginated RPC" problem precomputed
// aggregates exist to avoid) rather than a two-stage RPC+buffer design: fetch every
// real candidate's distance AND gender facts in two flat queries, sort, walk in
// distance order, keep the first 10 with real data.
//
// Real radii, checked across a spread before this was built (dense urban to genuinely
// rural): Ealing/Hammersmith and West London College (dense, Hammersmith and Fulham) --
// nearest 10 all within 9.1km. Most rural LAs checked (Lincolnshire, North Yorkshire,
// Westmorland and Furness) land 37-78km. Cornwall College is a genuine outlier at
// 154km -- Cornwall's own geography (a peninsula, thin FE-college density) means
// "nearest 10" there spans most of the South West, not a meaningfully local comparison.
// Flagged, not hidden: maxDistanceKm is returned alongside the peer figures so the
// caller can say so in the caption rather than silently presenting a 150km-wide
// "nearest" group as local.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData } from "./vicdata-reference";
import { FE_PARTICIPATION_ESTABLISHMENT_TYPES, CONSORTIUM_SIXTH_FORM_CENTRE_TYPE, sectorTag, phaseTags } from "./typology";
import { AGE_SEGMENT_BREAKDOWNS, buildIlrParticipationSnapshot } from "./ilr-participation-data";

const TARGET_COUNT = 10;
const UNDER_19_MALE_BREAKDOWN = "education_and_training_under_19_male";
const UNDER_19_FEMALE_BREAKDOWN = "education_and_training_under_19_female";

export type FeCollegeGenderPeers = {
  found: number;
  maxDistanceKm: number | null;
  peer: { girls: number; boys: number } | null;
};

// Latest-period, non-suppressed value per URN per sex -- same "skip a genuinely
// absent/suppressed period" discipline as fe-participation-roll.ts's own
// latestNonZeroTotal, but keyed by sex rather than collapsed to one total (this needs
// both sexes independently, not a single figure).
function latestBySex(facts: { entity_id: string; period: number; breakdown: string; value_numeric: number | null }[]) {
  const byUrn = new Map<string, { male?: { period: number; v: number }; female?: { period: number; v: number } }>();
  for (const f of facts) {
    if (f.value_numeric === null || f.value_numeric <= 0) continue;
    const sex = f.breakdown === UNDER_19_MALE_BREAKDOWN ? "male" : f.breakdown === UNDER_19_FEMALE_BREAKDOWN ? "female" : null;
    if (!sex) continue;
    if (!byUrn.has(f.entity_id)) byUrn.set(f.entity_id, {});
    const rec = byUrn.get(f.entity_id)!;
    const cur = rec[sex];
    if (!cur || f.period > cur.period) rec[sex] = { period: f.period, v: f.value_numeric };
  }
  return byUrn;
}

export async function findFeCollegeGenderPeers(urn: string): Promise<FeCollegeGenderPeers> {
  const supabase = createServerAnonSupabaseClient();

  const { data: targetRow } = await supabase
    .from("schools")
    .select("easting, northing")
    .eq("urn", urn)
    .maybeSingle();
  const target = targetRow as { easting: number | null; northing: number | null } | null;
  if (!target?.easting || !target?.northing) return { found: 0, maxDistanceKm: null, peer: null };

  const { data: candidateRows } = await supabase
    .from("schools")
    .select("urn, easting, northing")
    .in("establishment_type", FE_PARTICIPATION_ESTABLISHMENT_TYPES)
    .neq("status", "closed")
    .neq("urn", urn)
    .not("easting", "is", null)
    .not("northing", "is", null);
  // 2026-09-08: some FE-type rows carry the literal sentinel (0, 0) rather than a
  // real null for "no usable coordinate" (LaSWAP Sixth Form, confirmed live) --
  // `.not(..., "is", null)` above doesn't catch this, and it would otherwise compute
  // a bogus real-looking distance from the British National Grid's own origin point
  // instead of being excluded for lacking a usable location (findLocal16PlusProvision
  // below has the full writeup of this same bug class).
  const candidates = ((candidateRows ?? []) as { urn: string; easting: number; northing: number }[]).filter(
    (c) => !(c.easting === 0 && c.northing === 0),
  );
  if (candidates.length === 0) return { found: 0, maxDistanceKm: null, peer: null };

  const byDistance = candidates
    .map((c) => ({
      urn: c.urn,
      distanceKm: Math.sqrt((c.easting - target.easting!) ** 2 + (c.northing - target.northing!) ** 2) / 1000,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const facts = await lookupReferenceData({
    sourceId: "dfe_fe_participation",
    entityIds: byDistance.map((c) => c.urn),
    breakdowns: [UNDER_19_MALE_BREAKDOWN, UNDER_19_FEMALE_BREAKDOWN],
  });
  const genderByUrn = latestBySex(facts);

  let girlsSum = 0;
  let boysSum = 0;
  let found = 0;
  let maxDistanceKm = 0;
  for (const c of byDistance) {
    if (found >= TARGET_COUNT) break;
    const rec = genderByUrn.get(c.urn);
    if (!rec?.male || !rec?.female) continue; // suppressed or genuinely no under-19 gender data -- skip, same skip-and-backfill precedent as surrounding-schools.ts
    girlsSum += rec.female.v;
    boysSum += rec.male.v;
    found += 1;
    maxDistanceKm = c.distanceKm;
  }

  if (found === 0) return { found: 0, maxDistanceKm: null, peer: null };
  return { found, maxDistanceKm, peer: { girls: girlsSum, boys: boysSum } };
}

// Member Data View build (2026-10-03), brief §6: FE college List 1 ("FE only,
// nearest 10, crosses LA") -- the named-list counterpart to
// findFeCollegeGenderPeers' own aggregated version above. Deliberately NOT built by
// generalising that function to optionally return names -- it already does real work
// (ILR gender-peer aggregation) this list doesn't need, and this list needs to keep
// candidates even when they have no real ILR gender split (a named comparator-set
// member is still worth showing on the tick-list without one; the aggregated peer
// figure is a different, stricter use). Same candidate pool/distance mechanism,
// genuinely duplicated rather than shared, per this project's own "three similar
// lines beats a premature abstraction" discipline -- the two functions' filtering
// requirements are real, not the same, from here on.
export type NamedFeCollege = { urn: string; name: string; distanceKm: number };

// 2026-09-06, UX refinements round 1, B1's flagged-but-unclear exclusion note: the
// one unambiguous rule Guy stated was "exclude any college with no U19 students at
// all (e.g. City Lit) from lists meant to be U19/school-comparable" -- this list IS
// that list (its whole point is a same-basis size comparison, and City-Lit-shaped
// adult-only colleges have nothing real to compare on that basis). 2026-09-08
// correction: this comment originally said the rule was deliberately NOT applied to
// findLocal16PlusProvision below, on the reasoning that that list answers a
// membership question ("does this LA have 16+ provision at all") rather than a
// sizing one. That reasoning stopped holding the moment findLocal16PlusProvision
// started feeding a real member-facing roll-comparator list (default-comparator-
// lists.ts's local_16plus/fe_local_16plus recipes) -- City Lit and Mary Ward Centre
// showing up there as real bugs is exactly this gap. The same exclusion is now
// applied in both functions -- see findLocal16PlusProvision's own comment below.
// Fetches the small national population's real under-19 totals in one batched call
// (confirmed ~372 real candidates nationally, this module's own header comment) and
// drops anything without a genuine non-zero figure BEFORE distance-ranking, so a
// nearby but U19-less college doesn't silently occupy one of the target's 10 (or
// more, once B3's "+5" expansion is used) slots.
export async function findNearestFeColleges(urn: string, targetCount = 10): Promise<NamedFeCollege[]> {
  const supabase = createServerAnonSupabaseClient();

  const { data: targetRow } = await supabase
    .from("schools")
    .select("easting, northing")
    .eq("urn", urn)
    .maybeSingle();
  const target = targetRow as { easting: number | null; northing: number | null } | null;
  if (!target?.easting || !target?.northing) return [];

  const { data: candidateRows } = await supabase
    .from("schools")
    .select("urn, current_name, easting, northing")
    .in("establishment_type", FE_PARTICIPATION_ESTABLISHMENT_TYPES)
    .neq("status", "closed")
    .neq("urn", urn)
    .not("easting", "is", null)
    .not("northing", "is", null);
  // 2026-09-08: same (0, 0)-sentinel guard as findFeCollegeGenderPeers above --
  // see findLocal16PlusProvision below for the full writeup of this bug class.
  const candidates = ((candidateRows ?? []) as { urn: string; current_name: string; easting: number; northing: number }[]).filter(
    (c) => !(c.easting === 0 && c.northing === 0),
  );
  if (candidates.length === 0) return [];

  const under19Facts = await lookupReferenceData({
    sourceId: "dfe_fe_participation",
    entityIds: candidates.map((c) => c.urn),
    breakdowns: AGE_SEGMENT_BREAKDOWNS.under_19,
  });
  const hasRealU19 = new Set(
    candidates
      .filter((c) => buildIlrParticipationSnapshot(under19Facts.filter((f) => f.entity_id === c.urn), "under_19") !== null)
      .map((c) => c.urn),
  );

  return candidates
    .filter((c) => hasRealU19.has(c.urn))
    .map((c) => ({
      urn: c.urn,
      name: c.current_name,
      distanceKm: Math.sqrt((c.easting - target.easting!) ** 2 + (c.northing - target.northing!) ** 2) / 1000,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, targetCount);
}

// Member Data View build (2026-10-03), brief §6: FE List 2 ("all 16+ provision in the
// borough, not all sectors") -- a school/college counts as real 16+ provision if
// it's an FE-sector institution, OR a mainstream Senior/through school with a real
// sixth form (hasRealSixthForm's own reasoning: statutory high age 17-19 AND real
// current roll -- reused via the same age-range test rather than re-derived), OR a
// standalone Post-16 institution (typology.ts's own "Post 16" phase tag). No phase/
// gender matching -- unlike every other List 2 row, this one's whole point is
// crossing sector boundaries within the LA, per the brief's own explicit carve-out.
export type Local16PlusProvision = { urn: string; name: string; sector: string; distanceKm: number };

export async function findLocal16PlusProvision(
  targetUrn: string,
  laName: string,
): Promise<Local16PlusProvision[]> {
  const supabase = createServerAnonSupabaseClient();

  const { data: targetRow } = await supabase
    .from("schools")
    .select("easting, northing")
    .eq("urn", targetUrn)
    .maybeSingle();
  const target = targetRow as { easting: number | null; northing: number | null } | null;
  // No usable location for the target itself -- nothing downstream can be honestly
  // distanced from it, so there's no real list to return.
  if (!target || target.easting === null || target.northing === null || (target.easting === 0 && target.northing === 0)) {
    return [];
  }

  const { data: rows } = await supabase
    .from("schools")
    .select(
      "urn, current_name, easting, northing, establishment_type_group, establishment_type, statutory_low_age, statutory_high_age",
    )
    .eq("la_name", laName)
    .neq("status", "closed")
    .neq("urn", targetUrn);
  type Row = {
    urn: string;
    current_name: string;
    easting: number | null;
    northing: number | null;
    establishment_type_group: string | null;
    establishment_type: string | null;
    statutory_low_age: number | null;
    statutory_high_age: number | null;
  };
  const candidates = (rows ?? []) as Row[];
  if (candidates.length === 0) return [];

  // 2026-09-08, real bug fix (Camden Post-16 list pulling in HE institutions/an
  // adult-education centre/a consortium sixth-form/NHS Choices College, plus two
  // absurd distances): `sector === "FE"` (sectorTag(), backed by the BROAD
  // FE_ESTABLISHMENT_TYPES/FE_INSTITUTION_TYPES set) wrongly counted Higher
  // education institutions as FE -- confirmed live, Royal Veterinary College, SOAS,
  // Birkbeck, LSHTM and University of London all carry the real
  // `establishment_type: "Higher education institutions"`, one of the six values
  // that broad set exists to catch for the PUBLIC MAP's own "one bucket for every
  // non-mainstream type" job (typology.ts's own header comment on FE_INSTITUTION_
  // TYPES) -- not a fit for a same-basis school/college roll-comparator list. The
  // narrow, correct basis for "is this a real FE college" is
  // FE_PARTICIPATION_ESTABLISHMENT_TYPES, the same one this file's own sibling
  // findNearestFeColleges already uses -- further excluding
  // CONSORTIUM_SIXTH_FORM_CENTRE_TYPE ("Sixth form centres"), since confirmed live 0
  // of 14 open institutions of that type have any real roll/participation data
  // under their own URN (typology.ts's own comment) -- exactly why LaSWAP Sixth
  // Form was appearing.
  const isFeType = (t: string | null): boolean =>
    t !== null && FE_PARTICIPATION_ESTABLISHMENT_TYPES.includes(t) && t !== CONSORTIUM_SIXTH_FORM_CENTRE_TYPE;

  // 2026-09-08, real bug fix: the "exclude any college with no real U19 students at
  // all" rule (findNearestFeColleges' own comment above, City Lit its own named
  // example) is now applied here too -- see the comment on that earlier exclusion
  // note for why this list's own real-world job changed since it was first written.
  // Only checked for FE-typed candidates (mainstream Senior/Post-16 schools reaching
  // this list via a real sixth form already have real census roll data, no ILR gate
  // needed) -- batches the small real candidate set's under-19 totals in one call,
  // same precedent as findNearestFeColleges.
  const feCandidateUrns = candidates.filter((c) => isFeType(c.establishment_type)).map((c) => c.urn);
  const under19Facts = feCandidateUrns.length
    ? await lookupReferenceData({
        sourceId: "dfe_fe_participation",
        entityIds: feCandidateUrns,
        breakdowns: AGE_SEGMENT_BREAKDOWNS.under_19,
      })
    : [];
  const hasRealU19 = new Set(
    feCandidateUrns.filter(
      (u) => buildIlrParticipationSnapshot(under19Facts.filter((f) => f.entity_id === u), "under_19") !== null,
    ),
  );

  // 2026-09-08, real bug fix: LaSWAP Sixth Form has the literal sentinel (0, 0) for
  // easting/northing, not a real null -- confirmed live. The old `=== null` check
  // let it through and computed a bogus distance from the British National Grid's
  // own origin point, reproducing the reported 560.7km artifact exactly. (Excluded
  // from this list anyway by the consortium check above, but a real, general gap
  // worth closing on its own -- any other FE-type record with the same (0,0)
  // sentinel would have hit the identical bug.)
  //
  // NHS Choices College is a different, narrower problem: a real, non-null,
  // non-zero easting/northing that's simply wrong upstream in GIAS (~400km from
  // London, matching the reported 396.7km artifact), despite the row's own
  // `la_name` genuinely being "Camden" -- neither the type filter nor the U19 filter
  // nor a coordinate-null check catches a coordinate that's merely wrong, not
  // missing. Since every candidate here already shares the target's own la_name (the
  // query above filters on it), a real match can never legitimately be more than a
  // few tens of km away -- London boroughs are a few km across, and even the
  // largest, most rural English LAs top out well under this. Anything past this cap
  // is a same-LA-tagged data error, not a genuine local result, and is dropped
  // rather than shown as a "local" comparator hundreds of km away. Flags this as a
  // real, broader pattern worth knowing about (not just these two rows) in
  // docs/vicdata_data_view_open_questions.md.
  const MAX_PLAUSIBLE_SAME_LA_DISTANCE_KM = 50;

  const results: Local16PlusProvision[] = [];
  for (const c of candidates) {
    const isFe = isFeType(c.establishment_type);
    if (isFe && !hasRealU19.has(c.urn)) continue;

    const sector = sectorTag(c.establishment_type_group, c.establishment_type);
    // Real 16+ provision, three ways: a genuine FE-sector institution; a standalone
    // Post-16 phase tag; or an ordinary Senior/through school whose own stated
    // leaving age (17-19) means it genuinely runs a sixth form -- age alone, not
    // gated on real roll data existing, since this is a membership question ("does
    // this institution offer 16+ at all"), not a sizing one.
    const phase = phaseTags(c.statutory_low_age, c.statutory_high_age, c.establishment_type);
    const isPost16 = phase.includes("Post 16");
    const hasSixthForm =
      phase.includes("Senior") &&
      c.statutory_high_age !== null &&
      c.statutory_high_age >= 17 &&
      c.statutory_high_age <= 19;
    if (!isFe && !isPost16 && !hasSixthForm) continue;

    if (c.easting === null || c.northing === null || (c.easting === 0 && c.northing === 0)) continue;
    const distanceKm = Math.sqrt((c.easting - target.easting) ** 2 + (c.northing - target.northing) ** 2) / 1000;
    if (distanceKm > MAX_PLAUSIBLE_SAME_LA_DISTANCE_KM) continue;

    results.push({
      urn: c.urn,
      name: c.current_name,
      sector: isFe ? "FE" : sector ?? "State",
      distanceKm,
    });
  }
  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}
