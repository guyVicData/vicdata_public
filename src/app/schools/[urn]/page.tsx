import { notFound } from "next/navigation";
import { createServerAnonSupabaseClient } from "@/lib/supabase";
import { lookupReferenceData } from "@/lib/vicdata-reference";
import {
  buildRollSnapshot,
  singleAgeGenderCountsForPeriod,
  shapeClassifierInput,
  CURRENT_CENSUS_PERIOD,
} from "@/lib/roll-data";
import { buildIlrParticipationSnapshot } from "@/lib/ilr-participation-data";
import { classifyShape, type ShapeLabel } from "@/lib/shape-classifier";
import { findSurroundingSchools, aggregateSurroundingStat } from "@/lib/surrounding-schools";
import PaidTrendsSection from "@/components/PaidTrendsSection";
import ShapeChart from "@/components/ShapeChart";
import AggregateShapeChart from "@/components/AggregateShapeChart";
import TypologyTags from "@/components/TypologyTags";
import SurroundingSchoolsMemberList from "@/components/SurroundingSchoolsMemberList";
import SchoolMap from "@/components/SchoolMap";
import { computeTypology, phaseTagAgeRange, FE_PARTICIPATION_ESTABLISHMENT_TYPES, type PhaseTag } from "@/lib/typology";
import { buildSurroundingSummary } from "@/lib/surrounding-summary";
import { under19Totals, adultTotals, UNDER_19_TOTAL_BREAKDOWN, ADULT_TOTAL_BREAKDOWN } from "@/lib/fe-participation-roll";

export const dynamic = "force-dynamic"; // per-school live data, never statically cached

const SHAPE_LABELS: Record<ShapeLabel, string> = {
  tube: "Tube",
  pyramid_funnel: "Pyramid / Funnel",
  mushroom: "Mushroom",
  wineglass: "Wineglass",
  irregular: "Irregular",
};

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
};

async function getSchool(urn: string): Promise<School | null> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "urn, current_name, town, postcode, la_name, establishment_type_group, establishment_type, phase, boarding_establishment, boarders_name, statutory_low_age, statutory_high_age, gender, la_code, easting, northing",
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
};

async function getContextAggregates(laName: string | null): Promise<{
  national: RollAggregate | null;
  regional: RollAggregate | null;
}> {
  const supabase = createServerAnonSupabaseClient();
  const scopeKeys = laName ? ["", laName] : [""];
  const { data } = await supabase
    .from("roll_aggregates")
    .select("scope_key, total_roll, school_count, shape_label, period")
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
            rollByPhase: viewedRollByPhase,
            ageBands: viewedAgeBands,
            genderSplit: viewedGenderSplit,
          }}
        />
      )}

      <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold">{school.current_name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {[school.town, school.postcode].filter(Boolean).join(", ")}
          {school.establishment_type_group ? ` — ${school.establishment_type_group}` : ""}
        </p>
        <div className="mt-3">
          <TypologyTags typology={typology} />
        </div>
      </header>

      {!roll && (
        <section className="mb-10 rounded-md border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
          No DfE census roll data is available for this school — this is expected for
          standalone 6th-form/FE-corporation institutions (a confirmed, permanent gap
          until the academic-results topic is built), or for a very recently opened
          school.
        </section>
      )}

      {showIlrCard && ilrSnapshot && (
        <Section title="FE participation data (ILR)">
          <p className="text-3xl font-semibold">{ilrSnapshot.total.toLocaleString()}</p>
          <p className="text-sm text-neutral-500">
            learners, {ilrSnapshot.period}/{String(ilrSnapshot.period + 1).slice(2)}
          </p>
          {ilrSnapshot.male !== null && ilrSnapshot.female !== null && (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {ilrSnapshot.female.toLocaleString()} girls, {ilrSnapshot.male.toLocaleString()}{" "}
              boys
            </p>
          )}
          <p className="mt-3 text-xs text-neutral-400">
            DfE&rsquo;s own experimental &ldquo;in development&rdquo; statistics
            (Individualised Learner Record) — not the DfE school census figure{roll ? " above" : ""}.
            A count of learners participating in further education courses across the
            academic year, not a single-day headcount, shown here because {roll
              ? "this school's own census data hasn't been updated since " + roll.period + "/" + String(roll.period + 1).slice(2)
              : "this school has no DfE census roll data"}. Shown separately, never
            combined with the census figure — they measure different things.
          </p>
        </Section>
      )}

      {roll && (
        <>
          {/* 2026-08-22 fix: was "Current roll" -- genuinely misleading for the many
              academy-16-19-converter/free-school-16-19 institutions whose most recent
              real census data is 1-5 years stale (a real, newly-confirmed census-coverage
              gap for this establishment type, not a display bug in isolation -- see
              docs/OPEN_QUESTIONS.md in the vicdata ingest repo, 2026-08-22). The actual
              academic year is already shown correctly in the caption directly below: the
              bug was the bold header claiming currency the data doesn't have, not the
              underlying number or the period label itself, so this is a text-only fix,
              nothing data-side changed. */}
          <Section title="Roll">
            <p className="text-3xl font-semibold">{roll.totalRoll.toLocaleString()}</p>
            <p className="text-sm text-neutral-500">
              pupils, {roll.period}/{String(roll.period + 1).slice(2)}
            </p>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {roll.byAgeBand
                  .filter((b) => b.total > 0)
                  .map((b) => (
                    <tr key={b.key} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-1.5 text-neutral-600 dark:text-neutral-400">{b.label}</td>
                      <td className="py-1.5 text-right font-medium">
                        {b.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Section>

          <Section title="Shape">
            {ageGenderCounts && <ShapeChart ageGenderCounts={ageGenderCounts} />}
            {shape ? (
              <>
                <p className="mt-3 text-lg font-medium">{SHAPE_LABELS[shape.label]}</p>
                <p className="text-sm text-neutral-500">
                  Single-year snapshot, based on this year&rsquo;s age 5–17 profile.
                  Provisional classification — this typology is still being calibrated
                  against real school data.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">
                Not enough age 5–17 data to classify a shape this year.
              </p>
            )}
          </Section>

          <Section title="Gender split">
            <p>
              {roll.gender.female.toLocaleString()} girls, {roll.gender.male.toLocaleString()}{" "}
              boys
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Full-roll headcount, all ages — not the same age range as the shape chart
              above.
            </p>
          </Section>

          {roll.boarding && (
            <Section title="Boarding">
              <p>
                {roll.boarding.boarders.toLocaleString()} boarders,{" "}
                {roll.boarding.day.toLocaleString()} day pupils
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                DfE census boarding headcount, same period as the roll above.
              </p>
            </Section>
          )}

          <PaidTrendsSection urn={urn} />
        </>
      )}

      <Section title="Surrounding schools">
        {surrounding.found > 0 && surroundingSummary ? (
          <>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {surroundingSummary}
              {surrounding.aggregateShape && (
                <>
                  {" "}
                  The combined shape is <strong>{SHAPE_LABELS[surrounding.aggregateShape]}</strong>.
                </>
              )}
            </p>
            {surrounding.aggregateAgeCounts && (
              <div className="mt-3">
                <AggregateShapeChart ageCounts={surrounding.aggregateAgeCounts} />
              </div>
            )}
            <p className="mt-3 text-xs text-neutral-400">
              The {surrounding.found} schools behind this comparison are visible to
              verified members.
            </p>
            <SurroundingSchoolsMemberList urn={urn} />
          </>
        ) : (
          <p className="text-sm text-neutral-500">
            Not enough nearby comparable schools with roll data to show this yet.
          </p>
        )}
      </Section>

      {(context.national || context.regional) && (
        <Section title="Regional & national context">
          <p className="text-xs text-neutral-400 mb-2">
            About the world, not about this school — free regardless of tier (rolls
            spec §2).
          </p>
          <table className="w-full text-sm">
            <tbody>
              {context.regional && (
                <tr className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1.5 text-neutral-600 dark:text-neutral-400">
                    {school.la_name} ({context.regional.school_count} schools)
                  </td>
                  <td className="py-1.5 text-right">
                    {context.regional.total_roll.toLocaleString()} pupils
                    {context.regional.shape_label && (
                      <span className="ml-2 text-neutral-500">
                        — {SHAPE_LABELS[context.regional.shape_label]}
                      </span>
                    )}
                  </td>
                </tr>
              )}
              {context.national && (
                <tr className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1.5 text-neutral-600 dark:text-neutral-400">
                    England ({context.national.school_count.toLocaleString()} schools)
                  </td>
                  <td className="py-1.5 text-right">
                    {context.national.total_roll.toLocaleString()} pupils
                    {context.national.shape_label && (
                      <span className="ml-2 text-neutral-500">
                        — {SHAPE_LABELS[context.national.shape_label]}
                      </span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Academic">
        <ComingSoon />
      </Section>
      <Section title="Social context">
        <ComingSoon />
      </Section>
      <Section title="Destinations">
        <ComingSoon />
      </Section>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ComingSoon() {
  return <p className="text-sm text-neutral-400">Coming soon.</p>;
}
