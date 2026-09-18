Academic Map — grade-band colour PALETTE change only. Nothing else from the
map colour-bug batch is in scope here (that's a separate, larger prompt with
its own doc — this is deliberately split out on its own since it's small and
independent).

Guy's own instruction: the current grade-band scale's lightest stops don't
have enough contrast to read against the map basemap. Shift the whole scale
darker rather than dropping the lightest stop — start the bottom of the new
scale where the CURRENT scale's own quarter-mark stop is, and make the top
darker than the current top too, so the scale still spans a genuinely wide
range, just shifted up.

`GRADE_BAND_STOPS` in `src/lib/trend-colours.ts` is currently:

```ts
const GRADE_BAND_STOPS: { t: number; hex: string }[] = [
  { t: 0, hex: "#eff6ff" }, // blue-50
  { t: 0.25, hex: "#bfdbfe" }, // blue-200
  { t: 0.5, hex: "#60a5fa" }, // blue-400
  { t: 0.75, hex: "#2563eb" }, // blue-600
  { t: 1, hex: "#1e3a8a" }, // blue-900
];
```

Replace with the same five-stop shape, shifted two steps darker along the
same Tailwind blue scale (bottom = today's t=0.25 stop, top = one step
darker than today's t=1 stop):

```ts
const GRADE_BAND_STOPS: { t: number; hex: string }[] = [
  { t: 0, hex: "#bfdbfe" }, // blue-200 -- was the t=0.25 stop
  { t: 0.25, hex: "#60a5fa" }, // blue-400 -- was the t=0.5 stop
  { t: 0.5, hex: "#2563eb" }, // blue-600 -- was the t=0.75 stop
  { t: 0.75, hex: "#1e40af" }, // blue-800 -- new
  { t: 1, hex: "#172554" }, // blue-950 -- darker than the old t=1 stop
];
```

This is a starting proposal grounded in Guy's own instruction, not a locked
value — look at how it actually renders against the real basemap (light
mode and dark mode both, if the map supports both) and retune the exact
stops if they don't read well once you can actually see them.

Nothing else changes — `gradeBandColour()`'s own interpolation logic,
`GRADE_BAND_LEGEND_STOPS`, and every call site are untouched; this is a
palette-values-only edit.

Local build/test only, no commit/push. Build report: a screenshot or clear
description of how the new scale reads against the map, not just "done."
