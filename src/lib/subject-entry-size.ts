// VicData 0.8 SMT Academic, Entries mode: the size badge XS-XL for a subject's cohort against
// England -- fifths of all schools entering that subject in that qualification, that year
// (docs/v0.8/smt_academic_claude_code_prompt_v1.md §5; R-SMT-ENTRIES-SIZE).
//
// The cut points are precomputed by scripts/sync-subject-entry-size-fifths.ts into
// subject_entry_size_fifths (migration 20261122090000); nothing here scans entries. The badge
// is the existing XS-XL one: SizeBadge and sizeBadgeForValue from age-band-distributions.ts,
// drawn in BADGE_ORDER (components/dashboard/PhaseBreakdownCard).
//
// Decisions (documented in the migration too):
//   - the population is the schools ENTERING it: a school with no entries is left out;
//   - fewer than MIN_SCHOOLS_TO_SIZE schools entering: no badge (null), and the UI says
//     "too few schools to size";
//   - each qualification also has a row for its own total, subject ALL_SUBJECTS, so a
//     qualification or group can be sized;
//   - subjects are their latest names (subject-latest-names.ts), summed where DfE merged two;
//     qualifications are the labels the ingest stores (as every other subject read keys them).
//
// What "entries" means, so the count passed to entrySizeBadge is the one the cut points were
// made from:
//   - Post-16: entries_total from academic_subject_qualification_headline_lookup (the
//     per-qualification rollup the UI already reads);
//   - GCSE: DfE's total exam entries for the subject in that exact qualification. A GCSE
//     Double Award counts once per pupil here; the KS4 subject headline (bucket "all") counts
//     it twice, so use the per-qualification count, not that headline's, for Combined Science.

import { cachedReference } from "./server-cache";
import { createServerAnonSupabaseClient } from "./supabase";
import { sizeBadgeForValue, type SizeBadge } from "./age-band-distributions";

export type EntrySizeStage = "ks4" | "ks5";

/** Below this many schools entering a subject in a qualification that year, no badge. */
export const MIN_SCHOOLS_TO_SIZE = 10;

/** The subject of a qualification's own total row. */
export const ALL_SUBJECTS = "All subjects";

export type EntrySizeKey = { qualification: string; subject: string; period: number };

export type EntrySizeFifths = EntrySizeKey & {
  schools: number;
  p20: number;
  p40: number;
  p60: number;
  p80: number;
};

export const entrySizeKey = (k: EntrySizeKey) => `${k.qualification}::${k.subject}::${k.period}`;

// ------------------------------------------------------------------ pure: the fifths

/** Linear-interpolation quantile of an ascending list (the age-band sync's method). */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** The fifths of the schools entering (counts <= 0 left out); null when nobody enters. */
export function fifthsOf(counts: Iterable<number>): Pick<EntrySizeFifths, "schools" | "p20" | "p40" | "p60" | "p80"> | null {
  const sorted = Array.from(counts)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  // To 2 dp: entries are whole numbers, so this never moves a school across a cut point, and
  // it keeps float noise (12.400000000000006) out of the table.
  const at = (q: number) => Math.round(quantile(sorted, q) * 100) / 100;
  return { schools: sorted.length, p20: at(0.2), p40: at(0.4), p60: at(0.6), p80: at(0.8) };
}

/**
 * The school's badge for its entries against England's fifths. Null when the school has no
 * entries, there are no fifths for it, or fewer than MIN_SCHOOLS_TO_SIZE schools enter it.
 * Exactly on a cut point is the band above (sizeBadgeForValue: value < p20 is XS).
 */
export function entrySizeBadge(entries: number | null | undefined, fifths: Pick<EntrySizeFifths, "schools" | "p20" | "p40" | "p60" | "p80"> | null | undefined): SizeBadge | null {
  if (!fifths || fifths.schools < MIN_SCHOOLS_TO_SIZE) return null;
  if (entries === null || entries === undefined || !(entries > 0)) return null;
  return sizeBadgeForValue(entries, fifths);
}

/** True when there are fifths but too few schools to size against them (the UI's wording). */
export const tooFewSchoolsToSize = (fifths: Pick<EntrySizeFifths, "schools"> | null | undefined) => !!fifths && fifths.schools < MIN_SCHOOLS_TO_SIZE;

// ------------------------------------------------------------------ server read

const TABLE = "subject_entry_size_fifths";
const PAGE = 1000;

type Row = { qualification: string; subject: string; period: number; schools: number; p20: number | string; p40: number | string; p60: number | string; p80: number | string };

// One key stage's year, every qualification and subject: a few thousand small rows at most,
// the same for every school, so loaded once an hour (server-cache.ts) and shared.
function loadYear(stage: EntrySizeStage, period: number): Promise<Map<string, EntrySizeFifths>> {
  return cachedReference(`subject-entry-size-fifths:${stage}:${period}`, async () => {
    const supabase = createServerAnonSupabaseClient();
    const out = new Map<string, EntrySizeFifths>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(TABLE)
        .select("qualification, subject, period, schools, p20, p40, p60, p80")
        .eq("ks_stage", stage)
        .eq("period", period)
        .order("qualification")
        .order("subject")
        .range(from, from + PAGE - 1);
      // Thrown, so the cache keeps nothing (a table not yet applied is re-asked next time).
      if (error) throw new Error(`${TABLE}: ${error.message}`);
      for (const r of (data ?? []) as Row[]) {
        const f: EntrySizeFifths = { qualification: r.qualification, subject: r.subject, period: r.period, schools: r.schools, p20: Number(r.p20), p40: Number(r.p40), p60: Number(r.p60), p80: Number(r.p80) };
        out.set(entrySizeKey(f), f);
      }
      if (!data || data.length < PAGE) break;
    }
    return out;
  });
}

/**
 * England's fifths for each requested (qualification, subject, period), keyed by entrySizeKey.
 * A key with no row (nobody entered it, or the table isn't there yet) is absent from the map.
 * Batched: one cached load per year asked for, whatever the number of keys.
 */
export async function entrySizeFifths(stage: EntrySizeStage, keys: EntrySizeKey[]): Promise<Map<string, EntrySizeFifths>> {
  const periods = Array.from(new Set(keys.map((k) => k.period)));
  const years = await Promise.all(
    periods.map((p) =>
      loadYear(stage, p).catch((e) => {
        console.warn(`[entrySizeFifths] ${stage} ${p}: ${(e as Error).message}`);
        return new Map<string, EntrySizeFifths>();
      }),
    ),
  );
  const byPeriod = new Map(periods.map((p, i) => [p, years[i]]));
  const out = new Map<string, EntrySizeFifths>();
  for (const k of keys) {
    const key = entrySizeKey(k);
    const f = byPeriod.get(k.period)?.get(key);
    if (f) out.set(key, f);
  }
  return out;
}
