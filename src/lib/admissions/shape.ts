// VicData 0.7 admissions (A1): size and shape, exactly as the public school page computes them.
// No new size words (XS-XL by phase band, sizeBadgeForValue); the shape is the shared classifier
// on the school's age-gender counts (full- plus part-time headcount, as the page reads them).
// The LOCAL shape is the same classifier on a set's counts summed by age. Shapes are described,
// never ranked (R-ADM-SHAPE-NOT-RANKED). Pure.
import { AGE_BANDS, shapeClassifierInput, type AgeBandKey, type AgeGenderCounts } from "../roll-data";
import { classifyShape, type ShapeLabel } from "../shape-classifier";
import { sizeBadgeForValue, type BandDistribution, type SizeBadge } from "../age-band-distributions";

export function shapeOf(counts: AgeGenderCounts): ShapeLabel | null {
  if (counts.size === 0) return null;
  return classifyShape(shapeClassifierInput(counts))?.label ?? null;
}

export function sumAgeGender(sets: AgeGenderCounts[]): AgeGenderCounts {
  const out: AgeGenderCounts = new Map();
  for (const c of sets) for (const [age, v] of c) {
    const x = out.get(age) ?? out.set(age, { male: 0, female: 0 }).get(age)!;
    x.male += v.male;
    x.female += v.female;
  }
  return out;
}

/** The local shape of a set: the classifier on its summed age profile. */
export function localShape(sets: AgeGenderCounts[]): ShapeLabel | null {
  return shapeOf(sumAgeGender(sets));
}

/** Roll by phase band with its XS-XL badge, as PhaseBreakdownCard draws it. */
export function sizeByBand(counts: AgeGenderCounts, distributions: Map<string, BandDistribution>): { key: AgeBandKey; label: string; total: number; badge: SizeBadge | null }[] {
  return AGE_BANDS.map((b) => {
    let total = 0;
    for (const [age, c] of counts) if (age >= b.minAge && age <= b.maxAge) total += c.male + c.female;
    const d = distributions.get(b.key);
    return { key: b.key, label: b.label, total, badge: d && total > 0 ? sizeBadgeForValue(total, d.quintiles) : null };
  }).filter((b) => b.total > 0);
}
