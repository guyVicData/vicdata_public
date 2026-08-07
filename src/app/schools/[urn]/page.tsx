import { notFound } from "next/navigation";
import { createServerAnonSupabaseClient } from "@/lib/supabase";
import { lookupReferenceData } from "@/lib/vicdata-reference";
import { buildRollSnapshot } from "@/lib/roll-data";
import { classifyShape, type ShapeLabel } from "@/lib/shape-classifier";
import { computeSurroundingSchoolsStat } from "@/lib/surrounding-schools";
import PaidTrendsSection from "@/components/PaidTrendsSection";

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
  establishment_type_group: string | null;
  establishment_type: string | null;
  phase: string | null;
  boarding_establishment: string | null;
  statutory_low_age: number | null;
  statutory_high_age: number | null;
};

async function getSchool(urn: string): Promise<School | null> {
  const supabase = createServerAnonSupabaseClient();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "urn, current_name, town, postcode, establishment_type_group, establishment_type, phase, boarding_establishment, statutory_low_age, statutory_high_age",
    )
    .eq("urn", urn)
    .maybeSingle();
  if (error || !data) return null;
  return data as School;
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
  const shape = roll ? classifyShape(roll.byAgeBand) : null;
  const surrounding = roll
    ? await computeSurroundingSchoolsStat(urn, roll.period)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold">{school.current_name}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {[school.town, school.postcode].filter(Boolean).join(", ")}
          {school.establishment_type_group ? ` — ${school.establishment_type_group}` : ""}
        </p>
      </header>

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
          <Section title="Current roll">
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
            {shape ? (
              <>
                <p className="text-lg font-medium">{SHAPE_LABELS[shape.label]}</p>
                <p className="text-sm text-neutral-500">
                  Single-year snapshot, based on this year&rsquo;s age-band profile.
                  Provisional classification — this typology is still being calibrated
                  against real school data.
                </p>
              </>
            ) : (
              <p className="text-sm text-neutral-500">
                Not enough age-band data to classify a shape this year.
              </p>
            )}
          </Section>

          <Section title="Gender split">
            <p>
              {roll.gender.female.toLocaleString()} girls, {roll.gender.male.toLocaleString()}{" "}
              boys
            </p>
          </Section>

          {roll.boarding && (
            <Section title="Boarding">
              <p>
                {roll.boarding.boarders.toLocaleString()} boarders,{" "}
                {roll.boarding.day.toLocaleString()} day pupils
              </p>
            </Section>
          )}

          <Section title="Surrounding schools">
            {surrounding && surrounding.found > 0 ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Among the {surrounding.found} nearest schools of the same phase and
                sector{surrounding.found < surrounding.requested ? " found" : ""}, the
                average roll is{" "}
                <strong>{Math.round(surrounding.averageRoll ?? 0).toLocaleString()}</strong>
                {surrounding.aggregateShape && (
                  <>
                    {" "}
                    and the combined shape is{" "}
                    <strong>{SHAPE_LABELS[surrounding.aggregateShape]}</strong>
                  </>
                )}
                .
              </p>
            ) : (
              <p className="text-sm text-neutral-500">
                Not enough nearby comparable schools with roll data to show this yet.
              </p>
            )}
          </Section>

          <PaidTrendsSection urn={urn} />
        </>
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
