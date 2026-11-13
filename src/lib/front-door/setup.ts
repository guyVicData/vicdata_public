// VicData 0.8 front door (A6, R-SETUP-ONE-SCREEN): the one-screen setup's rules, pure.
import type { TeacherPhase } from "@/lib/teacher-view-phases";

/** The phases setup lists: GCSE and Post-16 the school has, both on the one screen (KS2 has no subjects to pick). */
export function setupPhases(phases: TeacherPhase[]): ("ks4" | "ks5")[] {
  return (["ks4", "ks5"] as const).filter((p) => phases.includes(p));
}

/** The live count: entries (this year) across the ticked subjects, and how many are ticked. */
export function setupTotals(subjects: { key: string; entries: number }[], ticked: string[]): { entries: number; subjects: number } {
  const on = subjects.filter((s) => ticked.includes(s.key));
  return { entries: on.reduce((t, s) => t + s.entries, 0), subjects: on.length };
}
