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
import { buildIlrParticipationSnapshot } from "@/lib/ilr-participation-data";
import { classifyShape, type ShapeLabel } from "@/lib/shape-classifier";
import { findSurroundingSchools, aggregateSurroundingStat, aggregatePeerGenderSplit } from "@/lib/surrounding-schools";
import { computeLaSectorComposition } from "@/lib/la-sector-composition";
import { lookupAgeBandDistributions } from "@/lib/age-band-distributions";
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
} from "@/lib/narrative";
import { computeTopic3SizeSentence } from "@/lib/narrative-lookup";
import { CurrentStateNarrative } from "@/components/dashboard/CurrentStateNarrative";
import { under19Totals, adultTotals, UNDER_19_TOTAL_BREAKDOWN, ADULT_TOTAL_BREAKDOWN } from "@/lib/fe-participation-roll";
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

  // 2026-08-28: the viewed school's own map dot needs the same ILR fallback the map's
  // NEIGHBOUR dots get (schools-in-bounds/route.ts) -- otherwise visiting a genuine
  // FE-corporation institution's own page would show its centre dot with no roll at
  // all while its neighbours (fetched via the batch route) correctly show one. Only
  // reached when census has NOTHING (roll === null), matching the batch route's own
  // rule exactly, not "stale" -- stale-but-present is the different, already-handled
  // case the ILR card above exists for.
  let viewedRollSource: "census" | "ilr" | null = roll ? "census" : null;
  let viewedIlrTotal: number | null = null;
  if (!roll) {
    if (FE_PARTICIPATION_ESTABLISHMENT_TYPES.includes(school.establishment_type ?? "")) {
      const feFacts = await lookupReferenceData({
        sourceId: "dfe_fe_participation",
        entityIds: [urn],
        breakdowns: [UNDER_19_TOTAL_BREAKDOWN],
      });
      const under19 = under19Totals(feFacts).get(urn);
      if (under19) {
        viewedIlrTotal = under19.total;
      } else {
        const adultFacts = await lookupReferenceData({
          sourceId: "dfe_fe_participation_adult",
          entityIds: [urn],
          breakdowns: [ADULT_TOTAL_BREAKDOWN],
        });
        const adult = adultTotals(adultFacts).get(urn);
        if (adult) viewedIlrTotal = adult.total;
      }
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
  const surroundingSummary = buildSurroundingSummary(
    school.current_name,
    typology,
    roll?.totalRoll ?? null,
    surrounding.found,
    surrounding.averageRoll,
  );

  // Dashboard rebuild (2026-08-28) additions -- all gated behind `roll` existing,
  // same as every other census-derived card below, since none of these mean anything
  // without a real roll to attach them to.
  const laComposition = roll
    ? await computeLaSectorComposition(school.la_name ?? "", typology.sector, school.number_of_pupils)
    : null;
  const bandDistributions = roll ? await lookupAgeBandDistributions(school.la_name, roll.period) : null;
  const populationTrend = roll ? await lookupPopulationTrend(school.la_name, school.la_code, roll.period) : null;
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
    const effectiveTags = effectivePhaseTags(school.statutory_low_age, school.statutory_high_age, ageGenderCounts);
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
      paragraph3Shape(school.current_name, shape?.label ?? null, realMoveCount),
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
                <RollCard totalRoll={roll.totalRoll} period={roll.period} laComposition={laComposition} />
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
                populationTrend={populationTrend}
                urn={urn}
                schoolName={school.current_name}
                schoolRoll={roll.totalRoll}
                peerRolls={matchedSurrounding.map((m) => m.totalRoll)}
                summary={surroundingSummary}
                aggregateShape={surrounding.aggregateShape}
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
