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

// Review pack 22 Nov, issue 8 (R-RANK-TIES, the words): every place is written by these, the dashboards' tiles and
// tables and the walks' answers alike, so a shared place reads "=2nd" everywhere (the walk said "2nd" where its
// dashboard said "=2nd" for the same three-way tie).

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 22 -> "22nd", 1234 -> "1,234th". */
export function ordinalWord(n: number): string {
  const r = Math.round(n);
  const t = r % 100;
  const suffix = t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[r % 10] ?? "th";
  return `${r.toLocaleString("en-GB")}${suffix}`;
}

/** A place: "=2nd" where it is shared, else "2nd". */
export const placeWord = (rank: number, tied?: boolean): string => `${tied ? "=" : ""}${ordinalWord(rank)}`;

/** "=2nd of 4" -- with what's ranked when given ("=2nd of 4 subjects"). */
export function placeText(p: { rank: number; of: number; tied?: boolean }, what?: string): string {
  return `${placeWord(p.rank, p.tied)} of ${p.of.toLocaleString("en-GB")}${what ? ` ${what}` : ""}`;
}
