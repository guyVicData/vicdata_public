// Free-tier "surrounding schools" summary sentence (chart palette doc's worked
// example, "Public View rebuild"): "Leighton Park School is a large independent
// boarding & day senior school -- 25% above the average roll of 342 for the 10
// nearest independent senior schools." Aggregate/summary only, no named schools --
// the named list is member-area only (a separate module).

import type { SchoolTypology } from "./typology";

const SIZE_BANDS = { small: 300, large: 800 } as const; // same thresholds as comparator_candidates RPC

function sizeWord(totalRoll: number | null): string | null {
  if (totalRoll === null) return null;
  if (totalRoll < SIZE_BANDS.small) return "small";
  if (totalRoll > SIZE_BANDS.large) return "large";
  return "medium-sized";
}

// A single descriptive phase word from the stacked tag set, for natural-language
// prose -- not the same as the tag pills themselves. "Senior" wins over "Sixth" when
// both are present (a school with Senior+Sixth reads naturally as "a senior school,"
// not "a sixth form school," in everyday English -- matches the design doc's own
// worked example for Leighton Park, which stacks Senior+Sixth but is described as
// simply "senior").
function phaseWord(phaseTags: SchoolTypology["phase"]): string | null {
  if (phaseTags.includes("Senior")) return "senior";
  if (phaseTags.includes("Junior")) return "junior";
  if (phaseTags.includes("Sixth")) return "sixth form";
  if (phaseTags.includes("Prep")) return "prep";
  return null;
}

function genderWord(gender: SchoolTypology["gender"]): string | null {
  if (gender === "Girls") return "girls'";
  if (gender === "Boys") return "boys'";
  return null; // Co-ed is the unmarked case, dropped from prose -- matches the worked example
}

export function buildSurroundingSummary(
  schoolName: string,
  typology: SchoolTypology,
  totalRoll: number | null,
  found: number,
  averageRoll: number | null,
): string | null {
  if (found === 0 || averageRoll === null || averageRoll === 0) return null;

  const size = sizeWord(totalRoll);
  const sector = typology.sector?.toLowerCase() ?? null;
  const boarding = typology.boarding?.toLowerCase() ?? null;
  const phase = phaseWord(typology.phase);
  const gender = genderWord(typology.gender);

  const descriptors = [size, sector, boarding, gender, phase].filter(Boolean).join(" ");
  const opening = descriptors
    ? `${schoolName} is a ${descriptors} school`
    : `${schoolName}`;

  const poolDescriptors = [sector, gender, phase].filter(Boolean).join(" ");
  const poolLabel = poolDescriptors ? `${poolDescriptors} schools` : "schools";

  if (totalRoll === null) {
    return `Among the ${found} nearest ${poolLabel}, the average roll is ${Math.round(averageRoll).toLocaleString()}.`;
  }

  const pctDiff = ((totalRoll - averageRoll) / averageRoll) * 100;
  const direction = pctDiff >= 0 ? "above" : "below";
  const pctAbs = Math.round(Math.abs(pctDiff));

  return (
    `${opening} — ${pctAbs}% ${direction} the average roll of ` +
    `${Math.round(averageRoll).toLocaleString()} for the ${found} nearest ${poolLabel}.`
  );
}
