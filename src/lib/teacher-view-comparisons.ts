// Teacher view Comparisons: which comparator schools a figure is shown and ranked among
// (VicData 0.6 S2). Lifted VERBATIM out of ComparisonsPanels so a Comparisons view moved
// out of its panel keeps the same population rules. Pure and client-safe (the server-side
// set building lives in teacher-view-comparator-series.ts and chooser-sets.ts).

/**
 * R-COMPARATOR-NO-FIGURE, R-FOCUS-NEVER-FILTERED: a comparator with no published figure
 * for what is being compared (at Post-16 most often a school that does not offer the
 * focused subject) is not listed for it; the school itself always stays. Not applied
 * while the per-subject rows are still loading, when "no data yet" is not "no data".
 */
export function comparisonSchools<S extends { urn: string; isTarget: boolean }>(
  allSchools: S[],
  seriesFor: (urn: string) => unknown[],
  loading: boolean,
): S[] {
  return loading ? allSchools : allSchools.filter((s) => s.isTarget || seriesFor(s.urn).length > 0);
}

/**
 * R-COMPARATOR-NO-FIGURE, R-FOCUS-NEVER-FILTERED: the schools ranked on the latest year,
 * largest first. A comparator with history but nothing in the latest year is left out --
 * a row of dashes is not a position; the school itself stays, figure or not.
 */
export function rankedComparisons<S extends { urn: string; isTarget: boolean }>(
  schools: S[],
  valueAt: (urn: string) => number | null,
): (S & { value: number | null })[] {
  return [...schools]
    .map((s) => ({ ...s, value: valueAt(s.urn) }))
    .filter((r) => r.isTarget || r.value !== null)
    .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
}

/**
 * R-RANKING-SAMPLE: a national/regional ranking's schools are a sample (the top and the
 * school's neighbours), so no map -- Current, Trend or % change -- is drawn of them.
 */
export function sampleAllowsMap(rankingSet: unknown): boolean {
  return !rankingSet;
}

/**
 * R-RANKING-SAMPLE: Current's view. A ranking has no Map (its default is the tiles view);
 * a list of schools has no tiles view. Whichever was chosen falls back to the other's.
 */
export function comparisonsCurrentView<V extends string>(rankingSet: unknown, viewChosen: V): V | "tiles" | "map" {
  return !sampleAllowsMap(rankingSet) ? (viewChosen === "map" ? "tiles" : viewChosen) : viewChosen === "tiles" ? "map" : viewChosen;
}

/**
 * R-RANKING-SAMPLE: compared on the ranking's own measure (the phase headline -- no subject
 * chip, no grade rate, not entries), rank and average come from the WHOLE population, not
 * from the sample's schools.
 */
export function onRankingMeasure(rankingSet: unknown, subjectLabel: string | null, threshold: unknown, measureId: string): boolean {
  return !!rankingSet && !subjectLabel && !threshold && measureId !== "entries";
}

/**
 * Comparisons change-map round (moved here in 0.6.1 S3c so the series builder's maps read the
 * same figures): each school's change as a panel measures it, keyed by URN for the map. The
 * school's own row is keyed "own" in the panels' tables, so it maps back to its URN.
 */
export function changeByUrn(
  series: { key: string; values: (number | null)[] }[],
  targetUrn: string | undefined,
  value: (values: (number | null)[]) => number | null,
): Record<string, number> {
  const byUrn: Record<string, number> = {};
  for (const s of series) {
    const v = value(s.values);
    if (v !== null) byUrn[s.key === "own" ? targetUrn ?? s.key : s.key] = v;
  }
  return byUrn;
}

// The change map's own % format on a count: whole, signed, a true minus.
export const signedPercent = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%`;
