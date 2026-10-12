// VicData 0.7 admissions (A1): the LA birth blend. Pure.
//
// Births are by local authority only (catchment births don't exist in our data). The pool's
// births are a blend of the LAs the set's schools are in, weighted by their pupils at the age
// that matters (R-ADM-LADDER). The Admissions lead can override the weights; the override is
// saved with the lists (admissions_lists.la_blend) and used as given, renormalised to 1.

export type BlendWeights = Map<string, number>; // DfE LA code -> weight (sums to 1)

export function autoBlend(schools: { laCode: string | null; pupils: number | null }[]): BlendWeights {
  const sum = new Map<string, number>();
  for (const s of schools) if (s.laCode && s.pupils && s.pupils > 0) sum.set(s.laCode, (sum.get(s.laCode) ?? 0) + s.pupils);
  return normalise(sum);
}

export function normalise(w: Map<string, number>): BlendWeights {
  const total = Array.from(w.values()).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const out: BlendWeights = new Map();
  if (total <= 0) return out;
  for (const [k, v] of w) if (v > 0) out.set(k, v / total);
  return out;
}

/** Blended births per calendar year: the weighted average of each LA's births, for the years
 * every weighted LA has. One LA at weight 1 is that LA's births. */
export function blendBirths(weights: BlendWeights, birthsByLa: Map<string, Map<number, number>>): Map<number, number> {
  const out = new Map<number, number>();
  if (weights.size === 0) return out;
  const years = new Set<number>();
  for (const la of weights.keys()) for (const y of birthsByLa.get(la)?.keys() ?? []) years.add(y);
  for (const y of years) {
    let v = 0;
    let ok = true;
    for (const [la, w] of weights) {
      const b = birthsByLa.get(la)?.get(y);
      if (b === undefined) { ok = false; break; }
      v += w * b;
    }
    if (ok) out.set(y, v);
  }
  return out;
}
