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
// prose -- not the same as the tag pills themselves. Senior is checked ahead of Post
// 16 for the same reason as ever (design doc's Leighton Park worked example: "a senior
// school," not "a post-16 school") -- though as of the 2026-08-28 Post 16 narrowing
// (typology.ts) the two can no longer both be present on the same school at all, so
// this ordering is now just defensive, not load-bearing.
export function phaseWord(phaseTags: SchoolTypology["phase"]): string | null {
  if (phaseTags.includes("Senior")) return "senior";
  if (phaseTags.includes("Junior")) return "junior";
  if (phaseTags.includes("Post 16")) return "post-16";
  if (phaseTags.includes("Prep")) return "prep";
  return null;
}

export function genderWord(gender: SchoolTypology["gender"]): string | null {
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
  // "FE" is an acronym, not an ordinary word like "independent"/"state" -- lowercasing
  // it the same way they get lowercased for this prose would read as a typo ("fe
  // school"), not a real word. Special-cased rather than generalising this to some
  // "which sector values are acronyms" list of one -- if a future sector value needs
  // the same treatment, it can join this check then.
  const sector = typology.sector === "FE" ? "FE" : typology.sector?.toLowerCase() ?? null;
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
