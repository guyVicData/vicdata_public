import { notFound } from "next/navigation";
import { Newsreader, IBM_Plex_Sans } from "next/font/google";
import { createServerAnonSupabaseClient } from "@/lib/supabase";
import { lookupReferenceData } from "@/lib/vicdata-reference";
import {
  buildRollSnapshot,
  singleAgeGenderCountsForPeriod,
  shapeClassifierInput,
  AGE_BANDS,
  CURRENT_CENSUS_PERIOD,
  SHAPE_CLASSIFICATION_MIN_AGE,
  SHAPE_CLASSIFICATION_MAX_AGE,
} from "@/lib/roll-data";
import { buildIlrParticipationSnapshot, type IlrParticipationSnapshot } from "@/lib/ilr-participation-data";
import { classifyShape, type ShapeLabel } from "@/lib/shape-classifier";
import { computeShapeQualifiers } from "@/lib/shape-qualifiers";
import { findSurroundingSchools, aggregateSurroundingStat, aggregatePeerGenderSplit } from "@/lib/surrounding-schools";
import { computeLaSectorComposition } from "@/lib/la-sector-composition";
import { lookupAgeBandDistributions } from "@/lib/age-band-distributions";
import { lookupFeParticipationDistributions } from "@/lib/fe-participation-distributions";
import { findFeCollegeGenderPeers } from "@/lib/surrounding-fe-colleges";
import { lookupPopulationTrend } from "@/lib/population-trend-lookup";
import PaidTrendsSection from "@/components/PaidTrendsSection";
import TypologyTags from "@/components/TypologyTags";
import SchoolMap from "@/components/SchoolMap";
import { computeTypology, phaseTagAgeRange, effectivePhaseTags, FE_PARTICIPATION_ESTABLISHMENT_TYPES, type PhaseTag } from "@/lib/typology";
import { buildSurroundingSummary } from "@/lib/surrounding-summary";
import {
  paragraph1PhaseGender, paragraph2SectorSize, paragraph3Shape, paragraph4LocalContext,
  topic4bGenderVariation, renderTopic4b,
  observedSpanForPhase, primaryPhaseTag, hasEarlyYearsProvision,
  renderNumericShapeDefinition,
  computePhaseSplitComparison, renderPhaseSplitSentence,
  computeErraticQualifier, renderErraticQualifier,
  computeSingleAgeAnomalyQualifier, renderSingleAgeAnomalyQualifier,
  computeGenderShapeDivergenceQualifier, renderGenderShapeDivergenceQualifier,
  computeGenderMixQualifier, renderGenderMixQualifier,
  computeStillDriftingQualifier, renderStillDriftingQualifier,
  joinShapeQualifierAddenda,
  type ShapeQualifierKind,
} from "@/lib/narrative";
import { computeTopic3SizeSentence } from "@/lib/narrative-lookup";
import { CurrentStateNarrative } from "@/components/dashboard/CurrentStateNarrative";
import { DashboardGrid } from "@/components/dashboard/Card";
import { RollCard } from "@/components/dashboard/RollCard";
import { PhaseBreakdownCard } from "@/components/dashboard/PhaseBreakdownCard";
import { ShapeCard } from "@/components/dashboard/ShapeCard";
import { GenderSplitCard } from "@/components/dashboard/GenderSplitCard";
import {
  BoardingCard,
  LaBoardersCard,
  RegionalNationalCard,
  IlrParticipationCard,
  NoCensusDataCard,
  ComingSoonCard,
} from "@/components/dashboard/SmallCards";
import {
  FeCollegeLocalContextCard,
  FeParticipationSizeCard,
  FeParticipationSplitCard,
} from "@/components/dashboard/FeCollegeCards";

export const dynamic = "force-dynamic"; // per-school live data, never statically cached

// Scoped to this page only, not the global layout (Geist stays the site-wide default
// everywhere else -- nav, search, other pages) -- design-reference typography for the
// card-grid rebuild specifically (2026-08-28). next/font/google self-hosts and
// subsets these at build time, same mechanism the root layout already uses for Geist.
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", weight: ["400", "500", "600"] });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex-sans", weight: ["400", "500", "600"] });

type School = {
  urn: string;
  current_name: string;
  town: string | null;
  postcode: string | null;
  la_name: string | null;
  establishment_type_group: string | null;
  establishment_type: string | null;
  phase: string | null;
  boarding_establishment: string | null;
  boarders_name: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
  gender: string | null;
  la_code: string | null;
  easting: number | null;
  northing: number | null;
  number_of_pupils: number | null;
};

async function getSchool(urn: string): Promise<School | null> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "urn, current_name, town, postcode, la_name, establishment_type_group, establishment_type, phase, boarding_establishment, boarders_name, statutory_low_age, statutory_high_age, gender, la_code, easting, northing, number_of_pupils",
    )
    .eq("urn", urn)
    .maybeSingle();
  if (error || !data) return null;
  return data as School;
}

type RollAggregate = {
  scope_key: string;
  total_roll: number;
  school_count: number;
  shape_label: ShapeLabel | null;
  period: number;
  boarders_total: number | null;
};

async function getContextAggregates(laName: string | null): Promise<{
  national: RollAggregate | null;
  regional: RollAggregate | null;
}> {
  const supabase = createServerAnonSupabaseClient();
  const scopeKeys = laName ? ["", laName] : [""];
  const { data } = await supabase
    .from("roll_aggregates")
    .select("scope_key, total_roll, school_count, shape_label, period, boarders_total")
    .in("scope_key", scopeKeys);
  const rows = (data as RollAggregate[]) ?? [];
  return {
    national: rows.find((r) => r.scope_key === "") ?? null,
    regional: laName ? rows.find((r) => r.scope_key === laName) ?? null : null,
  };
}

export default async function SchoolPage({
  params,
}: {
  params: Promise<{ urn: string }>;
}) {
  const { urn } = await params;
  const school = await getSchool(urn);
  if (!school) notFound();

  const facts = await lookupReferenceData({ sourceId: "dfe_school_census", entityIds: [urn] });
  const roll = buildRollSnapshot(facts, urn);
  const ageGenderCounts = roll ? singleAgeGenderCountsForPeriod(facts, roll.period) : null;

  // FE-participation backfill card (2026-08-22, docs/OPEN_QUESTIONS.md in the vicdata
  // ingest repo -- built after confirming most Academy 16-19 converter/Free schools 16
  // to 19 institutions' real census coverage stops at 2021). A RULE evaluated per
  // institution at render time, not a static list of the institutions known to need it
  // today: shown only when this institution's own census data is genuinely stale or
  // missing AND real ILR data actually exists for it. This means it adapts on its own if
  // census coverage for any of these institutions is restored in a future DfE release --
  // no list to maintain -- and correctly shows nothing for an institution with neither
  // source (e.g. one opened too recently for either), same honest degrade as the census
  // card's own !roll branch, not a new failure mode.
  const ilrFacts = await lookupReferenceData({
    sourceId: "dfe_fe_participation_academy",
    entityIds: [urn],
  });
  const ilrSnapshot = buildIlrParticipationSnapshot(ilrFacts);
  const showIlrCard = ilrSnapshot !== null && (!roll || roll.period < CURRENT_CENSUS_PERIOD);
  const shape = ageGenderCounts ? classifyShape(shapeClassifierInput(ageGenderCounts)) : null;
  // 2026-09-09, qualifier build round 15: first live wiring of shape-qualifiers.ts --
  // needs both classifyShape's own result AND the raw per-age/sex counts (the gender-
  // split check runs classifyShape a second time internally, on each sex alone).
  const shapeQualifiers = shape && ageGenderCounts ? computeShapeQualifiers(shape, ageGenderCounts) : null;
  const shapeDefinition = shape ? renderNumericShapeDefinition(shape.label, shape.metrics, shape.dominantTransition) : null;
  // Deterministic order per Guy's own brief: the shape itself first (erratic, single-
  // age anomaly), then gender-related (divergence, mix), then still-drifting.
  // Borderline/multipleSteps are deliberately absent -- no end-user wording yet.
  // tag(): pairs a render function's own output with which qualifier produced it --
  // joinShapeQualifierAddenda needs to know that to decide "though" vs semicolon
  // between adjacent clauses (narrative.ts's own THOUGH_RELATED table).
  const tag = (kind: ShapeQualifierKind, text: string | null) => (text !== null ? { kind, text } : null);
  const shapeQualifierAddenda: string | null =
    shape && shapeQualifiers
      ? joinShapeQualifierAddenda([
          tag("erratic", renderErraticQualifier(computeErraticQualifier(shapeQualifiers.erratic))),
          tag(
            "singleAgeAnomaly",
            renderSingleAgeAnomalyQualifier(
              computeSingleAgeAnomalyQualifier(shapeQualifiers.singleAgeAnomaly, shape.moves, shape.metrics.anchored),
            ),
          ),
          tag(
            "genderShapeDivergence",
            shapeQualifiers.genderShapeDivergenceMaterial && shapeQualifiers.genderShapeDivergence
              ? renderGenderShapeDivergenceQualifier(
                  computeGenderShapeDivergenceQualifier({
                    maleDirection: shapeQualifiers.genderShapeDivergence.maleDirection,
                    femaleDirection: shapeQualifiers.genderShapeDivergence.femaleDirection,
                  }),
                )
              : null,
          ),
          tag("genderMix", renderGenderMixQualifier(computeGenderMixQualifier(shapeQualifiers.genderMix ?? null))),
          tag("stillDrifting", renderStillDriftingQualifier(computeStillDriftingQualifier(shapeQualifiers.stillDrifting))),
        ])
      : null;

  // 2026-08-28: the viewed school's own map dot needs the same ILR fallback the map's
  // NEIGHBOUR dots get (schools-in-bounds/route.ts) -- otherwise visiting a genuine
  // FE-corporation institution's own page would show its centre dot with no roll at
  // all while its neighbours (fetched via the batch route) correctly show one. Only
  // reached when census has NOTHING (roll === null), matching the batch route's own
  // rule exactly, not "stale" -- stale-but-present is the different, already-handled
  // case the ILR card above exists for.
  let viewedRollSource: "census" | "ilr" | null = roll ? "census" : null;
  let viewedIlrTotal: number | null = null;
  // 2026-09-12, FE-sector build: genuine FE-sector schools (Further education/Sixth
  // form centres/Special post 16 institution -- FE_PARTICIPATION_ESTABLISHMENT_TYPES,
  // the real ILR crosswalk scope) structurally never have census roll data, so almost
  // everything on the page was blank for them. These two snapshots feed the new
  // participation cards below (step 2 of the FE-college build) -- fetched once here
  // (full facts, not breakdown-filtered) and reused for both the cards and the map-dot
  // total (viewedIlrTotal), rather than a second round-trip for the same two sources.
  // Prompt A: shared by items 1-4 below (laComposition's own FE-sector widening,
  // the gender-peer search, the size-distribution lookup, and every new FE-sector
  // card's own render gate) -- computed once, not re-derived at each call site.
  const isGenuineFeSector = FE_PARTICIPATION_ESTABLISHMENT_TYPES.includes(school.establishment_type ?? "");
  let feUnder19Snapshot: IlrParticipationSnapshot | null = null;
  let feAdultSnapshot: IlrParticipationSnapshot | null = null;
  if (!roll) {
    if (isGenuineFeSector) {
      const feFacts = await lookupReferenceData({ sourceId: "dfe_fe_participation", entityIds: [urn] });
      feUnder19Snapshot = buildIlrParticipationSnapshot(feFacts, "under_19");
      if (feUnder19Snapshot) viewedIlrTotal = feUnder19Snapshot.total;

      // Adult (19+) participation is always fetched too when this is a genuine
      // FE-sector school, not just as a total-only fallback for the map dot --
      // step 2 wants it surfaced as its own card whenever it exists, alongside (never
      // combined with) the under-19 figure.
      const adultFacts = await lookupReferenceData({ sourceId: "dfe_fe_participation_adult", entityIds: [urn] });
      feAdultSnapshot = buildIlrParticipationSnapshot(adultFacts, "19_plus");
      if (viewedIlrTotal === null && feAdultSnapshot) viewedIlrTotal = feAdultSnapshot.total;
    } else if (ilrSnapshot) {
      // Academy 16-19/Free school 16-19 with genuinely no census at all (not just
      // stale) -- reuse the SAME dfe_fe_participation_academy figure the ILR card
      // above already fetched, rather than a second query for the same data.
      viewedIlrTotal = ilrSnapshot.total;
    }
    if (viewedIlrTotal !== null) viewedRollSource = "ilr";
  }
  const viewedTotalRoll = roll?.totalRoll ?? viewedIlrTotal;
  // Bug fix (Task 3 review): this used to be gated on the target school having its
  // own roll data, backwards -- a standalone 6th-form/FE college (Worcester Sixth
  // Form College, confirmed real) has none of its own, but its surrounding schools
  // still need showing, just via a fallback period since there's no roll.period to
  // read one off. Fetched once here (not via computeSurroundingSchoolsStat) so the
  // same match list feeds both the aggregate stat and the map's marker positions.
  const matchedSurrounding = await findSurroundingSchools(urn, roll?.period ?? CURRENT_CENSUS_PERIOD);
  const surrounding = aggregateSurroundingStat(matchedSurrounding);
  // 2026-09-11, round 19, item 6: same numericShapeDefinition treatment the focus
  // school's own shapeDefinition gets above, applied to the pooled aggregate now that
  // aggregateSurroundingStat exposes aggregateMetrics/aggregateDominantTransition
  // alongside aggregateShape. Deliberately no qualifier addenda for the aggregate --
  // qualifiers describe one real school's trajectory, not a pooled average.
  const aggregateDefinition =
    surrounding.aggregateShape && surrounding.aggregateMetrics
      ? renderNumericShapeDefinition(surrounding.aggregateShape, surrounding.aggregateMetrics, surrounding.aggregateDominantTransition)
      : null;
  const context = await getContextAggregates(school.la_name);
  // Layout/graphs spec v1 §7, round 3: LA-boarders stat denominator -- already-precomputed
  // roll_aggregates.boarders_total (context.regional, same row RegionalNationalCard already
  // reads other fields from), no new aggregate table needed (round-3 discovery confirmed
  // this exists). Null when the LA has no regional aggregate row at all, distinct from a
  // real zero -- the render gate below treats both as "can't show a meaningful %."
  const laBoardersTotal = context.regional?.boarders_total ?? null;
  const typology = computeTypology(school, roll?.boarding ?? null);
  // 2026-08-27: the map's own centre dot is now sized/coloured exactly like its
  // neighbours (Guy's live review -- "a big school should look big even at the
  // centre"), which needs the same phase-sliced roll data schools-in-bounds/route.ts
  // computes for through-schools. Same zero-cost reasoning as that route: ageGenderCounts
  // is already fetched above for the Shape chart, this is a different reduction over
  // the SAME data, not a new query. Only computed for a genuine through-school (more
  // than one phase tag) -- a single-tag school's own roll IS that one phase already.
  let viewedRollByPhase: Partial<Record<PhaseTag, number>> | null = null;
  if (
    typology.phase.length > 1 &&
    ageGenderCounts &&
    school.statutory_low_age !== null &&
    school.statutory_high_age !== null
  ) {
    const byPhase: Partial<Record<PhaseTag, number>> = {};
    for (const tag of typology.phase) {
      const [lo, hi] = phaseTagAgeRange(tag, school.statutory_low_age, school.statutory_high_age);
      let sum = 0;
      for (const [age, c] of ageGenderCounts) {
        if (age >= lo && age <= hi) sum += c.male + c.female;
      }
      if (sum > 0) byPhase[tag] = sum;
    }
    if (Object.keys(byPhase).length > 0) viewedRollByPhase = byPhase;
  }
  // 2026-09-11, round 19, item 7: second sentence for the shape definition block,
  // through-schools only -- roll.byAgeBand's own fixed boundaries (secondary+
  // sixth_form vs early_years+primary), not viewedRollByPhase above (that's keyed by
  // this specific school's own phase tags, which vary school to school; the Years
  // 7-13 / Early Years-Year 6 split is the same for every through-school by
  // construction of AGE_BANDS, so the fixed band sum is the right source here).
  const phaseSplitSentence =
    typology.phase.length > 1 && roll
      ? renderPhaseSplitSentence(
          computePhaseSplitComparison(
            (roll.byAgeBand.find((b) => b.key === "secondary")?.total ?? 0) +
              (roll.byAgeBand.find((b) => b.key === "sixth_form")?.total ?? 0),
            (roll.byAgeBand.find((b) => b.key === "early_years")?.total ?? 0) +
              (roll.byAgeBand.find((b) => b.key === "primary")?.total ?? 0),
          ),
        )
      : null;
  // 2026-08-27, map popup/card redesign (point d): the focus school's own card
  // always shows the member-tier age-band/gender-split breakdown (not gated on
  // membership here) -- this exact data is already public elsewhere on this SAME
  // page (the Roll and Gender split sections below), so gating it again on the map
  // card would just be a visible inconsistency, not a real privacy boundary. Reuses
  // the SAME 11/16 band split as schools-in-bounds/route.ts's own ageBandsFor (kept
  // in sync deliberately, not duplicated by copy-paste -- both read the confirmed
  // phase-split boundaries). genderSplit reuses roll.gender directly rather than
  // re-summing ageGenderCounts -- roll.gender already carries the single-sex-school
  // suppression handling buildRollSnapshot applies (rolls spec §8); re-deriving it
  // here could silently diverge from that.
  let viewedAgeBands: { band1: number; band2: number; band3: number } | null = null;
  if (ageGenderCounts) {
    let band1 = 0, band2 = 0, band3 = 0;
    for (const [age, c] of ageGenderCounts) {
      const total = c.male + c.female;
      if (age <= 11) band1 += total;
      else if (age <= 16) band2 += total;
      else band3 += total;
    }
    if (band1 + band2 + band3 > 0) viewedAgeBands = { band1, band2, band3 };
  }
  const viewedGenderSplit = roll ? { girls: roll.gender.female, boys: roll.gender.male } : null;
  // 2026-09-11, round 19, item 5 bug A: hoisted above buildSurroundingSummary (was
  // previously only computed later, inside the `roll && ageGenderCounts` narrative
  // block below) so the free-tier surrounding-schools sentence gets the same
  // enrollment-aware, through-school-collapsing tags the main narrative already uses --
  // computed once here, reused there too (no second call). Falls back to the raw
  // nominal typology.phase only when there's no real census data to derive effective
  // tags from at all.
  const effectiveTags = ageGenderCounts
    ? effectivePhaseTags(school.statutory_low_age, school.statutory_high_age, ageGenderCounts)
    : typology.phase;
  const surroundingSummary = buildSurroundingSummary(
    school.current_name,
    typology,
    roll?.totalRoll ?? null,
    surrounding.found,
    surrounding.averageRoll,
    effectiveTags,
  );

  // Dashboard rebuild (2026-08-28) additions -- gated behind `roll` existing, same as
  // every other census-derived card below, since none of these mean anything without
  // a real roll to attach them to. laComposition is the one exception (2026-09-15,
  // Prompt A item 1): a genuine FE-sector school never has `roll` but still needs
  // laComposition.bySector.FE for its own local-context card -- thisSchoolNumberOfPupils
  // stays school.number_of_pupils (always null for FE, confirmed last round; the FE
  // card computes its own share from feUnder19Snapshot instead, not this function's
  // own thisSchoolPupilShareOfSector).
  const laComposition = roll || isGenuineFeSector
    ? await computeLaSectorComposition(school.la_name ?? "", typology.sector, school.number_of_pupils)
    : null;
  const bandDistributions = roll ? await lookupAgeBandDistributions(school.la_name, roll.period) : null;
  const populationTrend = roll ? await lookupPopulationTrend(school.la_name, school.la_code, roll.period) : null;
  // Prompt A item 3: national-only, no LA/regional cut -- most LAs have 0-1 real FE
  // colleges, too thin for a meaningful per-LA distribution.
  const feDistributions = isGenuineFeSector
    ? await lookupFeParticipationDistributions(CURRENT_CENSUS_PERIOD)
    : { under19: null, adult: null };
  // Prompt A item 2: only worth the (small, ~370-candidate) search when this school
  // is a genuine FE college with a real under-19 gender split of its own to pair a
  // peer average against -- feUnder19Snapshot itself gates this, not isGenuineFeSector
  // alone (City Lit, a real FE-sector college, has no under-19 data at all).
  const feGenderPeers = feUnder19Snapshot
    ? await findFeCollegeGenderPeers(urn)
    : { found: 0, maxDistanceKm: null, peer: null };
  const peerGenderSplit = aggregatePeerGenderSplit(matchedSurrounding);
  // "Peer average across the N nearest {descriptors} schools" -- reuses the exact
  // same descriptor words buildSurroundingSummary already computes for the free-tier
  // sentence (sector/gender/phase), not a second, possibly-diverging phrase.
  const peerGenderLabel =
    surrounding.found > 0
      ? `Peer average across the ${surrounding.found} nearest matched schools`
      : "";

  // Narrative generator v2 (state-of-school narrative spec v2 draft, restructured
  // 2026-08-31 from Guy's hand-edits of the v1 output) -- four merged paragraphs
  // instead of v1's eight topic-sentences. Every input here except Paragraph 2's
  // LA-average is already computed above for the existing cards. Gated on `roll`
  // existing, same as the dashboard-rebuild cards below.
  let narrativeParagraphs: (string | null)[] = [];
  if (roll && ageGenderCounts) {
    const primaryTag = primaryPhaseTag(effectiveTags);
    const hasEarlyYears = hasEarlyYearsProvision(school.statutory_low_age);
    const observedSpan =
      primaryTag && school.statutory_low_age !== null && school.statutory_high_age !== null
        ? observedSpanForPhase(ageGenderCounts, school.statutory_low_age, school.statutory_high_age)
        : null;

    let clampedFemale = 0;
    let clampedMale = 0;
    for (const [age, c] of ageGenderCounts) {
      if (age < SHAPE_CLASSIFICATION_MIN_AGE || age > SHAPE_CLASSIFICATION_MAX_AGE) continue;
      clampedFemale += c.female;
      clampedMale += c.male;
    }
    const realMoveCount = shape ? shape.moves.filter((m) => m !== "flat").length : 0;

    const sizeSentence = await computeTopic3SizeSentence(
      urn,
      school.statutory_low_age,
      school.statutory_high_age,
      ageGenderCounts,
      school.establishment_type_group,
      school.la_name,
      roll.period,
    );

    const p4bResult = topic4bGenderVariation(shape?.dominantTransition ?? null, ageGenderCounts, clampedFemale, clampedMale);

    narrativeParagraphs = [
      paragraph1PhaseGender(school.current_name, effectiveTags, hasEarlyYears, observedSpan, roll.gender.female, roll.gender.male),
      paragraph2SectorSize(school.current_name, laComposition, sizeSentence),
      paragraph3Shape(school.current_name, shape?.label ?? null, realMoveCount, shape?.metrics ?? null, shape?.dominantTransition ?? null),
      renderTopic4b(p4bResult),
      ...paragraph4LocalContext(
        school.current_name,
        typology.sector,
        typology.boarding,
        roll.boarding,
        populationTrend?.laTrend ?? null,
        school.la_name,
        populationTrend?.region ?? null,
        populationTrend?.regionTrend ?? null,
        shape?.label ?? null,
      ),
    ];
  }

  return (
    <>
      {/* Map redesign (2026-08-23): full-bleed, top of the page, outside the
          max-w-3xl content column below -- the page's visual centerpiece, not a
          small boxed section. See SchoolMap.tsx's own module comment for the full
          precedent/scope trail. LA boundary overlay removed 2026-08-24 (Guy's call,
          seen live -- "not adding value now that the map's job is just 'which
          schools are we looking at'"); la-boundary.ts's own fetch is no longer
          called from here at all -- see that module's own top-of-file note.
          2026-08-24, sector-colour/bounds-fetch round: the map draws its own live
          viewport-based school pool now (schools-in-bounds), not matchedSurrounding
          -- no freeSurroundingPoints prop any more. matchedSurrounding is still used
          below, unchanged, for the "Surrounding schools" aggregate stat and the
          member-only named list -- those are a different, curated data path from
          what the map now shows. school.sector (2026-08-25) is the viewed school's
          own sector, reusing the typology already computed above -- feeds the map's
          sector-aware default distance-ring radius, not a new lookup. */}
      {school.easting !== null && school.northing !== null && (
        <SchoolMap
          urn={urn}
          school={{
            name: school.current_name,
            town: school.town,
            easting: school.easting,
            northing: school.northing,
            sector: typology.sector,
            phase: typology.phase,
            gender: typology.gender,
            totalRoll: viewedTotalRoll,
            rollSource: viewedRollSource,
            establishmentType: school.establishment_type,
            statutoryHighAge: school.statutory_high_age,
            rollByPhase: viewedRollByPhase,
            ageBands: viewedAgeBands,
            genderSplit: viewedGenderSplit,
          }}
        />
      )}

      {/* Card-grid rebuild (2026-08-28) -- design reference: "VicData State of School
          Dashboard" canvas. Font variables scoped to this wrapper only, not the root
          layout (Geist stays the site default everywhere else). max-w-6xl, not the
          old max-w-3xl -- a 12-column card grid genuinely needs the room a single
          reading column didn't. */}
      <main className={`${newsreader.variable} ${plexSans.variable} mx-auto max-w-6xl px-6 py-16`} style={{ fontFamily: "var(--font-plex-sans)" }}>
        <header className="mb-8">
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] font-semibold text-stone-900 dark:text-stone-100">
            {school.current_name}
          </h1>
          <p className="mt-1 text-[14px] text-stone-500 dark:text-stone-400">
            {[school.town, school.postcode].filter(Boolean).join(", ")}
            {school.establishment_type_group ? ` — ${school.establishment_type_group}` : ""}
          </p>
          <div className="mt-3">
            <TypologyTags typology={typology} />
          </div>
        </header>

        <DashboardGrid>
          {/* Layout/graphs spec v1 §4, round 3: top row is narrative (6-col) beside a
              Roll/Gender split stack (6-col) -- built as two sibling 6-col DashboardGrid
              children (not a nested sub-grid) so the grid's own implicit row-1 auto-
              placement fills them side by side exactly, the same "no explicit
              row/position" discipline DashboardGrid's own dense auto-flow already relies
              on elsewhere. The stack itself is a plain flex column, not a Card -- RollCard
              and GenderSplitCard keep rendering as real Card components (own border/
              padding/size classes), just re-parented into a flex wrapper instead of being
              direct grid children, so their own `col-span-*` classes go inert (harmless
              under a flex parent) and they simply stack full-width inside the 6-col slot.
              PhaseBreakdownCard/ShapeCard/BoardingCard stay in the SECOND `roll &&` block
              below, unmoved from their prior relative order -- ShapeCard's position was
              left exactly where it sat before (its own `full` 12-col size means it always
              starts a fresh row regardless of neighbours, so it doesn't conflict with the
              new top row; see the round-3 report for the explicit confirmation). */}
          {roll && (
            <>
              <CurrentStateNarrative paragraphs={narrativeParagraphs} />
              <div className="col-span-12 flex flex-col gap-5 lg:col-span-6">
                <RollCard
                  totalRoll={roll.totalRoll}
                  period={roll.period}
                  laComposition={laComposition}
                  laSchoolCount={context.regional?.school_count ?? null}
                  laTotalRoll={context.regional?.total_roll ?? null}
                  schoolName={school.current_name}
                />
                <GenderSplitCard
                  girls={roll.gender.female}
                  boys={roll.gender.male}
                  peer={peerGenderSplit}
                  peerLabel={peerGenderLabel}
                />
              </div>
            </>
          )}

          {!roll && <NoCensusDataCard />}

          {showIlrCard && ilrSnapshot && (
            <IlrParticipationCard
              total={ilrSnapshot.total}
              period={ilrSnapshot.period}
              girls={ilrSnapshot.female}
              boys={ilrSnapshot.male}
              reason={
                roll
                  ? `this school's own census data hasn't been updated since ${roll.period}/${String(roll.period + 1).slice(2)}`
                  : "this school has no DfE census roll data"
              }
            />
          )}

          {/* 2026-09-12, FE-sector build step 2: genuine FE-sector schools (Further
              education/Sixth form centres/Special post 16 institution) structurally
              never have census data -- NoCensusDataCard above explains the gap, these
              are the real content that sits alongside it. Two separate cards, never
              one blended number -- under-19 and 19+/adult are different populations
              (same discipline the ingest side's dfe_fe_participation/_adult split
              exists to enforce). A sixth-form centre reporting under a parent
              institution's own URN (Harrow Collegiate, confirmed real, urn 135469) or
              an institution outside ILR's coverage window correctly renders neither
              card -- an honest gap, not a bug. */}
          {feUnder19Snapshot && (
            <IlrParticipationCard
              eyebrow="Under-19 FE participation (ILR)"
              total={feUnder19Snapshot.total}
              period={feUnder19Snapshot.period}
              girls={feUnder19Snapshot.female}
              boys={feUnder19Snapshot.male}
              reason="this school reports through the Individualised Learner Record (ILR), not DfE school census"
            />
          )}

          {feAdultSnapshot && (
            <IlrParticipationCard
              eyebrow="Adult (19+) FE participation (ILR)"
              total={feAdultSnapshot.total}
              period={feAdultSnapshot.period}
              girls={feAdultSnapshot.female}
              boys={feAdultSnapshot.male}
              sexLabels={{ female: "female", male: "male" }}
              reason="this is a separate, adult (19+) population, reported separately from any under-19 figure above -- never combined into one number"
            />
          )}

          {/* Prompt A, 2026-09-15: the start of developing the FE-sector page toward
              parity with the mainstream page -- items 1/2/3/4, staying honestly
              different where the data genuinely is (no phase breakdown, no LA/regional
              size distribution, no paired State+Independent sixth-form half yet). */}
          {isGenuineFeSector && (
            <FeCollegeLocalContextCard
              collegeName={school.current_name}
              laComposition={laComposition}
              ownUnder19Total={feUnder19Snapshot?.total ?? null}
            />
          )}

          {feUnder19Snapshot && feUnder19Snapshot.female !== null && feUnder19Snapshot.male !== null && (
            <GenderSplitCard
              girls={feUnder19Snapshot.female}
              boys={feUnder19Snapshot.male}
              peer={feGenderPeers.peer}
              peerLabel={
                feGenderPeers.found > 0
                  ? `Peer average across the ${feGenderPeers.found} nearest FE colleges with real under-19 ILR data` +
                    (feGenderPeers.maxDistanceKm !== null ? `, up to ${Math.round(feGenderPeers.maxDistanceKm)}km away` : "")
                  : ""
              }
            />
          )}

          {isGenuineFeSector && (
            <FeParticipationSizeCard
              under19Total={feUnder19Snapshot?.total ?? null}
              adultTotal={feAdultSnapshot?.total ?? null}
              under19Distribution={feDistributions.under19}
              adultDistribution={feDistributions.adult}
            />
          )}

          {isGenuineFeSector && (
            <FeParticipationSplitCard under19Total={feUnder19Snapshot?.total ?? null} adultTotal={feAdultSnapshot?.total ?? null} />
          )}

          {roll && (
            <>
              {bandDistributions && (
                <PhaseBreakdownCard
                  laName={school.la_name}
                  bands={AGE_BANDS.map((b) => ({
                    key: b.key,
                    label: b.label,
                    total: roll.byAgeBand.find((r) => r.key === b.key)?.total ?? 0,
                    distribution: bandDistributions.get(b.key) ?? null,
                  }))}
                />
              )}

              <ShapeCard
                ageGenderCounts={ageGenderCounts}
                shape={shape?.label ?? null}
                shapeMetrics={shape?.metrics ?? undefined}
                shapeDominantTransition={shape?.dominantTransition ?? null}
                shapeDefinition={shapeDefinition}
                phaseSplitSentence={phaseSplitSentence}
                shapeQualifierAddenda={shapeQualifierAddenda}
                populationTrend={populationTrend}
                urn={urn}
                schoolName={school.current_name}
                schoolRoll={roll.totalRoll}
                peerRolls={matchedSurrounding.map((m) => m.totalRoll)}
                summary={surroundingSummary}
                aggregateShape={surrounding.aggregateShape}
                aggregateDefinition={aggregateDefinition}
                found={surrounding.found}
              />

              {/* Layout/graphs spec v1 §6, round 3: pie chart now renders unconditionally
                  (a day-only school has no falsy `roll.boarding` in practice -- confirmed
                  against real data, the census reports boarders_total=0 explicitly for day
                  schools, not an absent fact -- but falling back to day=totalRoll/boarders=0
                  here too covers the theoretical case where the fact really is absent, same
                  "show the honest zero" principle as the rest of this page). */}
              <BoardingCard boarders={roll.boarding?.boarders ?? 0} day={roll.boarding?.day ?? roll.totalRoll} />

              {/* Layout/graphs spec v1 §7, round 3: LA-boarders stat -- only when this
                  school itself has real boarders (hidden entirely for day-only schools,
                  per Guy's explicit instruction -- genuinely irrelevant to them, unlike
                  the pie chart above which always renders). laBoardersTotal null/0-guarded
                  defensively (no divide-by-zero), not expected to fire for a school that
                  itself has boarders. */}
              {(roll.boarding?.boarders ?? 0) > 0 && laBoardersTotal !== null && laBoardersTotal > 0 && school.la_name && (
                <LaBoardersCard
                  boarders={roll.boarding!.boarders}
                  laBoardersTotal={laBoardersTotal}
                  laName={school.la_name}
                />
              )}

              <PaidTrendsSection urn={urn} />
            </>
          )}

          {/* Layout/graphs spec v1 §13, round 5: Regional & national context moves up
              into the slot SurroundingSchoolsCard used to hold, now that its own
              content has moved into ShapeCard's right-hand side above -- a pure
              relocation, no change to RegionalNationalCard itself. */}
          {(context.national || context.regional) && (
            <RegionalNationalCard
              laName={school.la_name}
              regional={
                context.regional
                  ? {
                      schoolCount: context.regional.school_count,
                      totalRoll: context.regional.total_roll,
                      shape: context.regional.shape_label,
                    }
                  : null
              }
              national={
                context.national
                  ? {
                      schoolCount: context.national.school_count,
                      totalRoll: context.national.total_roll,
                      shape: context.national.shape_label,
                    }
                  : null
              }
            />
          )}

          <ComingSoonCard title="Academic snapshot" />
          <ComingSoonCard title="Social context" />
          <ComingSoonCard title="Destinations" />
        </DashboardGrid>
      </main>
    </>
  );
}
