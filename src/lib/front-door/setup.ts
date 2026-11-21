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

/**
 * R-TEACHER-VIEWING-NO-SETUP (review pack 22 Nov, issue 1): the GCSE and Post-16 dashboards' setup gate.
 * Setup is the signed-in person's own first-run choice, read from their own rows. A platform admin's
 * peek or View as is someone else's school, so it is never gated (setup would show and save the
 * admin's own school): the dashboard opens as set up, on every phase the viewed school has. Embeds and
 * the SMT home's ?from=smt shortcut were never gated either.
 */
export function teacherDashboardGate(input: { viewingAs: boolean; fromSmt: boolean; done: TeacherPhase[]; phase: TeacherPhase; schoolPhases: TeacherPhase[] }): { onboarded: boolean; phases: TeacherPhase[] } {
  const { viewingAs, fromSmt, done, phase, schoolPhases } = input;
  if (viewingAs) {
    const phases = schoolPhases.includes(phase) ? schoolPhases : [...schoolPhases, phase];
    return { onboarded: true, phases: [...new Set([...phases, ...done])] };
  }
  return { onboarded: done.includes(phase) || fromSmt, phases: done };
}

/** The subjects a peek or View as opens on: the viewer's own saved ticks there if any, else the viewed school's subjects. Shown, never saved. */
export function viewingTicked(saved: string[], schoolSubjects: string[], viewingAs: boolean): string[] {
  return viewingAs && !saved.length ? schoolSubjects : saved;
}

/** What /teacher/setup does for this caller: only the signed-in person sets up their own school. A peek or View as never sees setup and never saves it. */
export function setupModeFor(input: { signedIn: boolean; viewingAs: boolean; peek: boolean }): "own" | "skip" {
  return input.signedIn && !input.viewingAs && !input.peek ? "own" : "skip";
}
