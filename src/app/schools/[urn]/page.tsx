import { notFound } from "next/navigation";
import { createServerAnonSupabaseClient } from "@/lib/supabase";
import { lookupReferenceData } from "@/lib/vicdata-reference";
import {
  buildRollSnapshot,
  singleAgeGenderCountsForPeriod,
  shapeClassifierInput,
  CURRENT_CENSUS_PERIOD,
} from "@/lib/roll-data";
import { classifyShape, type ShapeLabel } from "@/lib/shape-classifier";
import { findSurroundingSchools, aggregateSurroundingStat } from "@/lib/surrounding-schools";
import { getGssCodeForLaCode, fetchLaBoundary } from "@/lib/la-boundary";
import PaidTrendsSection from "@/components/PaidTrendsSection";
import ShapeChart from "@/components/ShapeChart";
import AggregateShapeChart from "@/components/AggregateShapeChart";
import TypologyTags from "@/components/TypologyTags";
import SurroundingSchoolsMemberList from "@/components/SurroundingSchoolsMemberList";
import SchoolMap from "@/components/SchoolMap";
import { computeTypology } from "@/lib/typology";
import { buildSurroundingSummary } from "@/lib/surrounding-summary";

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
  const shape = ageGenderCounts ? classifyShape(shapeClassifierInput(ageGenderCounts)) : null;
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
  const surroundingSummary = buildSurroundingSummary(
    school.current_name,
    typology,
    roll?.totalRoll ?? null,
    surrounding.found,
    surrounding.averageRoll,
  );
  const gssCode = await getGssCodeForLaCode(school.la_code);
  const laBoundary = gssCode ? await fetchLaBoundary(gssCode) : null;

  return (
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

      {school.easting !== null && school.northing !== null && (
        <Section title="Map">
          <SchoolMap
            urn={urn}
            school={{ name: school.current_name, town: school.town, easting: school.easting, northing: school.northing }}
            laBoundary={laBoundary}
            freeSurroundingPoints={matchedSurrounding
              .filter((m) => m.easting !== null && m.northing !== null)
              .map((m) => ({ easting: m.easting as number, northing: m.northing as number }))}
          />
        </Section>
      )}

      {!roll && (
        <section className="mb-10 rounded-md border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
          No DfE census roll data is available for this school — this is expected for
          standalone 6th-form/FE-corporation institutions (a confirmed, permanent gap
          until the academic-results topic is built), or for a very recently opened
          school.
        </section>
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
