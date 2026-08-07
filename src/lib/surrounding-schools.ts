// "Surrounding schools" stat for the State of the School page (rolls spec §4/§10):
// nearest-20 candidates (nearest_schools RPC), DfE census aggregate over that list.

import { createServerAnonSupabaseClient } from "./supabase";
import { lookupReferenceData } from "./vicdata-reference";
import { AGE_BANDS, type AgeBandKey } from "./roll-data";
import { classifyShape, type ShapeLabel } from "./shape-classifier";

const TARGET_COUNT = 20;
const CANDIDATE_BUFFER = 30; // per rolls spec §4: skip-and-backfill past no-data candidates

const AGE_BREAKDOWN_RE = /^(full_time|part_time)_(female|male)_aged_(\d+)$/;

function bandForAge(age: number): AgeBandKey | null {
  const band = AGE_BANDS.find((b) => age >= b.minAge && age <= b.maxAge);
  return band ? band.key : null;
}

export type SurroundingSchoolsStat = {
  requested: number;
  found: number; // per rolls spec §4: may be fewer than 20 if the candidate buffer is exhausted
  averageRoll: number | null;
  aggregateShape: ShapeLabel | null;
};

export async function computeSurroundingSchoolsStat(
  urn: string,
  targetPeriod: number,
): Promise<SurroundingSchoolsStat> {
  const supabase = createServerAnonSupabaseClient();
  const { data: candidates, error } = await supabase.rpc("nearest_schools", {
    p_urn: urn,
    p_limit: CANDIDATE_BUFFER,
  });

  if (error || !candidates || candidates.length === 0) {
    return { requested: TARGET_COUNT, found: 0, averageRoll: null, aggregateShape: null };
  }

  const candidateUrns: string[] = candidates.map((c: { urn: string }) => c.urn);

  const facts = await lookupReferenceData({
    sourceId: "dfe_school_census",
    entityIds: candidateUrns,
    periodMin: targetPeriod,
    periodMax: targetPeriod,
  });

  const rollByUrn = new Map<string, number>();
  const bandTotalsByUrn = new Map<string, Map<AgeBandKey, number>>();

  for (const fact of facts) {
    const match = AGE_BREAKDOWN_RE.exec(fact.breakdown);
    if (!match || fact.value_numeric === null) continue;
    const age = Number(match[3]);
    const band = bandForAge(age);
    if (!band) continue;

    rollByUrn.set(fact.entity_id, (rollByUrn.get(fact.entity_id) ?? 0) + fact.value_numeric);

    if (!bandTotalsByUrn.has(fact.entity_id)) {
      bandTotalsByUrn.set(fact.entity_id, new Map(AGE_BANDS.map((b) => [b.key, 0])));
    }
    const bands = bandTotalsByUrn.get(fact.entity_id)!;
    bands.set(band, (bands.get(band) ?? 0) + fact.value_numeric);
  }

  // Skip-and-backfill (rolls spec §4, resolved here): candidates are already ordered
  // nearest-first by the RPC; walk them in order and keep the first 20 that actually
  // have DfE census roll data, skipping standalone 6th-form/FE colleges (and any other
  // gap) rather than erroring or silently misrepresenting. If the buffer runs out
  // before 20 are found, `found` is honestly reported as fewer than 20 -- documented
  // choice, see docs/OPEN_QUESTIONS.md.
  const withData = candidateUrns.filter((u) => rollByUrn.has(u)).slice(0, TARGET_COUNT);

  if (withData.length === 0) {
    return { requested: TARGET_COUNT, found: 0, averageRoll: null, aggregateShape: null };
  }

  const totalRoll = withData.reduce((sum, u) => sum + (rollByUrn.get(u) ?? 0), 0);
  const averageRoll = totalRoll / withData.length;

  const aggregateBandTotals = AGE_BANDS.map((b) => ({
    key: b.key,
    total: withData.reduce((sum, u) => sum + (bandTotalsByUrn.get(u)?.get(b.key) ?? 0), 0),
  }));
  const aggregateShape = classifyShape(aggregateBandTotals)?.label ?? null;

  return {
    requested: TARGET_COUNT,
    found: withData.length,
    averageRoll,
    aggregateShape,
  };
}
