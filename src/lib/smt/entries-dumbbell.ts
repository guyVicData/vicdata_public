// VicData 0.8 feedback C (C10, Teacher 2): the whole school's entries by subject, first year to latest, for
// SMT Academic at each level -- the dumbbell Teacher's Context › Trends draws, which Guy wanted for SMT. Pure:
// from the same subject-by-qualification rows as the rest of Academic (qualRows), so its totals are the
// page's own. One row per subject and qualification with entries in both years, largest first; the
// qualification is named only where the level has more than one (never "(GCE A level)" on every row).
import type { QualRow } from "./academic-data";
import { shortQualification } from "./qual-groups";

export type EntriesDumbbell = {
  firstYear: number;
  latestYear: number;
  rows: { key: string; label: string; qualification: string | null; familyId: string | null; first: number; latest: number; change: number }[];
  average: { first: number; latest: number } | null;
  leftOut: number; // subjects with entries in only one of the two years
};

export function entriesDumbbell(rows: QualRow[], urn: string, latest: number, from: number, familyOf: (subject: string) => string | null): EntriesDumbbell | null {
  const mine = rows.filter((r) => r.urn === urn && r.period >= from && r.period <= latest && r.entries > 0);
  const years = Array.from(new Set(mine.map((r) => r.period))).sort((a, b) => a - b);
  if (years.length < 2 || years.at(-1) !== latest) return null;
  const first = years[0];
  const by = new Map<string, { subject: string; qualification: string; familyId: string | null; first: number; latest: number }>();
  for (const r of mine.filter((x) => x.period === first || x.period === latest)) {
    const k = `${r.qualification}::${r.subject}`;
    const cur = by.get(k) ?? { subject: r.subject, qualification: r.qualification, familyId: r.familyId ?? familyOf(r.subject), first: 0, latest: 0 };
    if (r.period === first) cur.first += r.entries;
    else cur.latest += r.entries;
    by.set(k, cur);
  }
  const all = Array.from(by.entries());
  const both = all.filter(([, v]) => v.first > 0 && v.latest > 0);
  if (!both.length) return null;
  const quals = new Set(both.map(([, v]) => v.qualification));
  const many = quals.size > 1;
  // The level's main qualification goes unnamed; the others carry a short tag.
  const main = Array.from(quals).sort((a, b) => both.filter(([, v]) => v.qualification === b).length - both.filter(([, v]) => v.qualification === a).length)[0];
  const out = both
    .map(([k, v]) => ({ key: k, label: v.subject, qualification: many && v.qualification !== main ? shortQualification(v.qualification) : null, familyId: v.familyId, first: v.first, latest: v.latest, change: v.latest - v.first }))
    .sort((a, b) => b.latest - a.latest || a.label.localeCompare(b.label));
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return { firstYear: first, latestYear: latest, rows: out, average: out.length > 1 ? { first: mean(out.map((r) => r.first)), latest: mean(out.map((r) => r.latest)) } : null, leftOut: all.length - both.length };
}
