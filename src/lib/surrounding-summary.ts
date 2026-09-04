// Free-tier "surrounding schools" summary sentence (chart palette doc's worked
// example, "Public View rebuild"): "Leighton Park School is a large independent
// boarding & day senior school -- 25% above the average roll of 342 for the 10
// nearest independent senior schools." Aggregate/summary only, no named schools --
// the named list is member-area only (a separate module).

import type { SchoolTypology, PhaseTag } from "./typology";

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
  // 2026-09-11, round 19, item 5 bug A: enrollment-aware tags (page.tsx's
  // effectivePhaseTags()), NOT the raw typology.phase this used to read directly --
  // a through-school (Junior/Prep + Senior both present) needs the same "through"
  // collapse narrative.ts's paragraph1PhaseGender already applies, or phaseWord()'s
  // Senior-first check mislabels it "senior" alone. Falls back to typology.phase
  // only when the caller has no real enrollment data to compute effective tags from.
  effectiveTags: PhaseTag[],
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
  const phase = effectiveTags.length > 1 ? "through" : phaseWord(effectiveTags);
  const gender = genderWord(typology.gender);

  // 2026-09-28: "Special Schools" is a plural NOUN (typology.ts's own SectorTag), not
  // an adjective the way "independent"/"state"/"FE" are -- folding it into the generic
  // [size, sector, boarding, gender, phase] adjective chain below, and into poolLabel's
  // "${sector} ${gender} ${phase} schools", both read wrong for a plural noun (a real
  // bug found live: "...is a small special schools day senior school", "...for the 8
  // nearest special schools senior schools"). Special-cased with its own sentence
  // structure instead, matching Guy's real worked example (Cambridge School):
  // "Cambridge School is a senior special school. It is a small day school -- 80%
  // below the average roll of 721 for the 8 nearest senior phase special schools."
  // Same found===0/averageRoll===null guard as the generic path above (already
  // returned before this point); null phase is handled the same "just omit it" way
  // the generic path's own [..].filter(Boolean) already does, not a separate message.
  if (typology.sector === "Special Schools") {
    const poolPhase = phase ? `${phase} phase ` : "";
    if (totalRoll === null) {
      return `Among the ${found} nearest ${poolPhase}special schools, the average roll is ${Math.round(averageRoll).toLocaleString()}.`;
    }
    const pctDiff = ((totalRoll - averageRoll) / averageRoll) * 100;
    const direction = pctDiff >= 0 ? "above" : "below";
    const pctAbs = Math.round(Math.abs(pctDiff));
    const opening = `${schoolName} is a${phase ? ` ${phase}` : ""} special school.`;
    const descriptors = [size, boarding, gender].filter(Boolean).join(" ");
    const descriptorClause = descriptors ? `a ${descriptors} school` : "a school";
    return (
      `${opening} It is ${descriptorClause} — ${pctAbs}% ${direction} the average roll of ` +
      `${Math.round(averageRoll).toLocaleString()} for the ${found} nearest ${poolPhase}special schools.`
    );
  }

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
