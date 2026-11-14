// VicData 0.8 review fixes (14 Nov, M1): a walk screen's title from its view's catalogue title, with every
// placeholder filled ("[feeder-age]-year-olds: your feeders, [la] and England"). The walk used to delete a
// placeholder it had no word for, leaving fragments ("-year-olds: your feeders, and England", "Your place
// among the, at 11+"). Now a title with a placeholder left, or one that would start with punctuation,
// falls back to the view's own label (R-WALK-WORDS). Pure.
import { entryPoint } from "@/lib/admissions/entry-points";

/** True when a title still holds a placeholder or doesn't start with a letter or digit. */
export function titleProblem(t: string): string | null {
  if (!t.trim()) return "empty";
  if (/\[[^\]]*\]/.test(t)) return "placeholder left";
  if (!/^[\p{L}\p{N}]/u.test(t.trim())) return "starts with punctuation";
  return null;
}

/** Fill every [key] from `fill`; any left unfilled (or a fill that leaves a fragment) gives `fallback`. */
export function fillTitle(template: string, fill: Record<string, string | number | null | undefined>, fallback: string): string {
  let t = template;
  for (const [k, v] of Object.entries(fill)) {
    if (v === null || v === undefined || String(v).trim() === "") continue;
    t = t.split(`[${k}]`).join(String(v));
  }
  t = t.replace(/\s{2,}/g, " ").trim();
  if (titleProblem(t)) return fallback;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "Year 7" for 11+, "Reception" for 4+, "Year 12" for 16+ (the entry year group). */
export function entryYearWord(age: number | null): string | null {
  if (age === null) return null;
  if (age === 4) return "Reception";
  return age >= 5 ? `Year ${age - 4}` : null;
}

/** The roll's age band from the entry year: "Years 7–11", "Years 12–13", "Reception to Year 6". */
export function entryBandWord(age: number | null): string | null {
  if (age === null) return null;
  if (age === 4) return "Reception to Year 6";
  if (age >= 16) return "Years 12–13";
  if (age >= 11) return `Years ${age - 4}–11`;
  return `Years ${age - 4}–6`;
}

/** Every placeholder Admissions' catalogue titles use, from the entry point and the pipeline answer. */
export function admissionsTitleFill(entry: string, p: { poolTrends: { age: number; laName: string | null }; school?: { laName: string | null } | null } | null): Record<string, string | number | null> {
  const ep = entryPoint(entry);
  return {
    entry: ep?.label ?? entry,
    "entry-year": entryYearWord(ep?.age ?? null) ?? ep?.label ?? entry,
    "entry-age": ep?.age ?? null,
    "feeder-age": p?.poolTrends.age ?? (ep ? Math.max(4, ep.age - 1) : null),
    la: p?.poolTrends.laName ?? p?.school?.laName ?? null,
    rivals: "rivals",
    "entry age band": entryBandWord(ep?.age ?? null),
  };
}

/** SMT's: the school, the set and level, the results group. */
export function smtTitleFill(school: string, set = "the set"): Record<string, string> {
  return { school, set, level: "The school", group: "Headline results" };
}
