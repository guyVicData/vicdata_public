// VicData 0.7 admissions (A1): entry points. Pure.
//
// An entry point is the age a child joins at, in September: 4+ (Reception), 11+ (Year 7),
// 16+ (Year 12), or any custom age from 2 to 17. Its RUNGS are the younger ages the same
// children are at now, each held by a kind of school; the ladder walks them back to births.
export type EntryPoint = { id: string; label: string; age: number };

export const STANDARD_ENTRY_POINTS: EntryPoint[] = [
  { id: "4+", label: "4+ (Reception)", age: 4 },
  { id: "11+", label: "11+ (Year 7)", age: 11 },
  { id: "16+", label: "16+ (Year 12)", age: 16 },
];
export const CUSTOM_AGE_MIN = 2;
export const CUSTOM_AGE_MAX = 17;

export function entryPoint(id: string): EntryPoint | null {
  const std = STANDARD_ENTRY_POINTS.find((e) => e.id === id);
  if (std) return std;
  const m = /^age:(\d+)$/.exec(id) ?? /^(\d+)\+$/.exec(id);
  if (!m) return null;
  const age = Number(m[1]);
  return age >= CUSTOM_AGE_MIN && age <= CUSTOM_AGE_MAX ? { id: `age:${age}`, label: `${age}+`, age } : null;
}

// Which kind of school holds children of a given age now (the rung's default set).
export type HolderKind = "births" | "nursery" | "primary" | "secondary" | "sixth_form";
export function holderOf(age: number): HolderKind {
  if (age < 2) return "births";
  if (age <= 3) return "nursery";
  if (age <= 10) return "primary";
  if (age <= 15) return "secondary";
  return "sixth_form";
}

/** The youngest age the census counts reliably as a rung: Reception and up (4). Younger
 * children are only partly in school nurseries, so the ladder reads births for them. */
export const COUNTED_MIN_AGE = 4;

/** The rung ages for an entry point, from the entry age down to the youngest counted age. */
export function rungAges(ep: EntryPoint): number[] {
  const out: number[] = [];
  for (let a = ep.age - 1; a >= COUNTED_MIN_AGE; a--) out.push(a);
  return out;
}

/** Horizon in years from the first entry year (inclusive count of years). */
export function horizonYears(ep: EntryPoint, firstEntryYear: number, lastBirthYear: number): number {
  if (ep.age <= COUNTED_MIN_AGE) {
    // Reception (and younger): births give real pools up to the last birth year's cohort;
    // at most two years beyond it (R-ADM-LADDER).
    const lastBirthsEntry = lastBirthYear + ep.age;
    return Math.max(0, lastBirthsEntry + 2 - firstEntryYear + 1);
  }
  return 10;
}

/** September of next year's entry, from a date: the first September strictly after today
 * (on 7 Oct 2026 that is September 2027; September 2026's entry has happened). */
export function firstEntryYear(today: Date): number {
  const y = today.getUTCFullYear();
  return today.getUTCMonth() >= 8 ? y + 1 : y; // months 0-based: 8 = September
}
