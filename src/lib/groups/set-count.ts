// VicData 0.8 groups r3 (S): a group set's count in the chooser, filtered to the phase in view
// ("9 with GCSE results · 26 in all"): its schools with that phase's headline (IGCSE schools out at
// GCSE; preps don't count in a GCSE ranking), and all its schools. Pure, client-safe.
import type { SavedComparatorSet } from "../teacher-view-saved-sets";

const PHASE_WORD = { ks2: "KS2", ks4: "GCSE", ks5: "Post-16" } as const;

export function groupSetWithResults(s: Pick<SavedComparatorSet, "rows">): number {
  return s.rows.filter((r) => !r.isTarget && (r as { value?: number | null }).value !== null && (r as { value?: number | null }).value !== undefined).length;
}

export function groupSetCount(s: Pick<SavedComparatorSet, "rows" | "members" | "group">, phase: "ks2" | "ks4" | "ks5"): string {
  const n = groupSetWithResults(s);
  const likely = s.group?.likelyMembers ? ` · ${s.group.likelyMembers} likely` : "";
  return `${n} with ${PHASE_WORD[phase]} results · ${s.members.length} in all${likely}`;
}
