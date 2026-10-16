// VicData 0.8 IGCSE subjects (follow-up 2): one ranking for every product. Standard competition
// ranking, highest first: tied values share a place and the next place skips (two at 3rd, then 5th),
// R-RANK-TIES. A school with no figure is never placed (R-COMPARATOR-NO-FIGURE). Pure: the client and
// the server both import it. The older helpers (rankByValue, ranksOf, rankWithin, rankDescendingWithTies,
// rankIn) are thin wrappers over this, so every ranking agrees, including on ties.

export type Place = { rank: number; of: number; tied: boolean };

/** Every placed item's rank, out of how many, and whether it shares the place. */
export function competitionRanks<K>(items: readonly { key: K; value: number | null }[]): Map<K, Place> {
  const placed = items.filter((i): i is { key: K; value: number } => i.value !== null && Number.isFinite(i.value)).sort((a, b) => b.value - a.value);
  const count = new Map<number, number>();
  for (const p of placed) count.set(p.value, (count.get(p.value) ?? 0) + 1);
  const out = new Map<K, Place>();
  placed.forEach((p, i) => {
    const prev = placed[i - 1];
    const rank = prev && prev.value === p.value ? out.get(prev.key)!.rank : i + 1;
    out.set(p.key, { rank, of: placed.length, tied: (count.get(p.value) ?? 0) > 1 });
  });
  return out;
}

/** The place `value` would take among `values` (its own figure included in `values`). */
export function placeAmong(values: readonly number[], value: number): Place {
  return { rank: 1 + values.filter((v) => v > value).length, of: values.length, tied: values.filter((v) => v === value).length > 1 };
}
