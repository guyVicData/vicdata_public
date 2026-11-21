// The comparator chooser's sets (/api/teacher/chooser-set; SMT's sets too): the part the chooser views share.
// Every kind is public data resolved from what the request names: the school, the phase, the URNs or
// the ranking's filters (as sent: arrays keep their order) and the school's own name and LA as the route
// read them. Nothing here reads with the caller's rights or depends on who is asking, so the route's
// gate (member, View as / peek, head office) comes first and the key never names the caller.
import { serializeAcademicProfile } from "../academic-data-view";
import { fetchTeacherComparatorProfiles, profileUrnsFor } from "../teacher-comparator-profiles";

export type ChooserPhase = "ks2" | "ks4" | "ks5";

/** At GCSE and Post-16 the answer carries the set's lean school details too (0.6.7 B1). */
export async function withChooserProfiles<T extends { rows: { urn: string }[]; subjectRows?: { urn: string }[] }>(urn: string, phase: ChooserPhase, set: T) {
  return phase === "ks2"
    ? set
    : { ...set, profiles: (await fetchTeacherComparatorProfiles(profileUrnsFor([...set.rows, ...(set.subjectRows ?? [])].map((r) => r.urn), urn), phase)).map(serializeAcademicProfile) };
}
