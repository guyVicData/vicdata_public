# Academic Results — Map: grade-band colour/scale bugs (live review, post round 3)

Five items reported live straight after Round 3 shipped (1-3 and 5 against
Yerbury Primary School's map, 4 against the trend wording generally). Read
directly against the real code before writing this up (not guessed) — every
root cause below is confirmed by reading the actual constants/logic, not by
live reproduction.

## 1 & 2. Root cause: grade-band colour is driven by a DIFFERENT real measure
than the one shown as the school's percentage

`src/lib/academic-data-view.ts` defines two separate per-stage measure-key
maps:

```ts
export const HEADLINE_MEASURE: Record<KsStage, string> = {
  ks2: "Reading, writing and maths::expected_standard_pupil_percent",
  ks4: "attainment8_average",
  ks5: "A level::aps_per_entry",
};

export const GRADE_BAND_MEASURE: Record<KsStage, string> = {
  ks2: "Reading, writing and maths::higher_standard_pupil_percent",
  ks4: "engmath_94_percent",
  ks5: "A level::aab_percent",
};
```

`HEADLINE_MEASURE` is what's shown everywhere as "the school's result" —
Rankings, Overview, the map popup's own headline stat (`data.avgValue`).
`GRADE_BAND_MEASURE` is a genuinely different, stricter "higher bar" DfE
threshold (comment at its definition: "Grade-band ('higher bar') threshold
field per stage... spec §3, §9") that predates Round 3 — but Round 3's own
`gradeValue` computation (`AcademicMapView.tsx` ~L390-402) uses
`GRADE_BAND_MEASURE[stage]` to drive BOTH the circle colour AND the
`minGrade`/`maxGrade` range the legend scales to, while the popup right next
to it shows `data.avgValue` (`HEADLINE_MEASURE[stage]`).

For KS2 specifically: "expected standard" (HEADLINE_MEASURE, shown as the
%) and "higher standard" (GRADE_BAND_MEASURE, driving colour) are two real,
only loosely-correlated national figures — nationally "higher standard" runs
roughly 0-30% school-to-school while "expected standard" runs roughly
40-95%. That's exactly item 1 (colour doesn't track the displayed %) and
item 2 (legend scale reads 0-29% against a visible 93%-47% set) — both are
the same root cause, not two separate bugs.

This isn't KS2-only. KS4's `GRADE_BAND_MEASURE` (`engmath_94_percent`, a
real percentage) drives colour while the popup shows `attainment8_average`
(a 0-90 points score, `HEADLINE_UNIT.ks4 === "points"`) — same mismatch,
plus the legend's own `formatHeadlineValue(stage, s.value)` call formats the
engmath percentage using KS4's `points` unit (no "%" suffix), a second,
compounding display bug. KS5's "A level" cohort has the identical shape:
Round 3's own A5 fix (`AcademicMapView.tsx` ~L381-399) deliberately colours
by `aab_percent` for that cohort while the popup shows `aps_per_entry`
(average UCAS points) — same mismatch, same missing "%" in the legend.

**Recommended fix**: make grade-band colour track the SAME real value the
popup/Rankings/Overview already show — i.e. drive `gradeValue` off
`HEADLINE_MEASURE[stage]` (or, for KS5, the cohort's own resolved headline
measure, same as every non-"A level" cohort already correctly does per A5's
existing fallback) rather than the separate `GRADE_BAND_MEASURE` map. That
removes the mismatch at the source for all three stages, and the KS4/KS5
unit-formatting bug goes with it since colour and popup then share one real
number, one real unit, everywhere. This does mean dropping the standalone
"higher bar" threshold idea from the map's colour mode — flag that
explicitly in the build report as a real product-level change, not a silent
byproduct, since it was a deliberate earlier design choice, but Guy's own
two live reports both expect colour to track the number people can actually
see, so this is the direction unless something surfaces that argues
otherwise.

## 3. "Grade band" title overlaps the top of the colour scale

`GradeBandColourKey` and `TrendColourKey` (`AcademicMapView.tsx` ~L153-215)
share one constant, `TREND_KEY_TITLE_HEIGHT = 16`, subtracted from the box
height to get the bar's own height, with the title `<p>` given that same
fixed `height: 16` and no `overflow-hidden`/`whitespace-nowrap`. Trend's own
title is a single short word ("Trend") that fits on one line at that size;
Grade band's title is the two-word, uppercase, tracking-wide string "Grade
band" in the same ~56px-wide box — very likely wrapping onto a second line
that has nowhere to go (the `p`'s fixed height doesn't clip it) and pushes
down into the bar immediately below it, which is exactly what's reported.
Confirm this is really what's happening (not by inspection alone — see it
render) and then either give `GradeBandColourKey`'s own title a taller
height reservation, keep it to one line (`whitespace-nowrap`, maybe a
shorter word or smaller tracking), or widen the box slightly — whichever
reads cleanest next to Trend's own key, since the two should still look like
the same real component family per the prior round's own "match as closely
as possible" instruction.

## 4. Growth/decline wording doesn't track the displayed pp number

Reported live: a school that changed +10pp is labelled "No change," +11pp
is "Growth," and a separate school at -9pp is also "No change" — the label
boundary doesn't sit where the displayed number would suggest.

Root cause, confirmed directly: `trendBadge()` (`src/lib/data-view-cards.ts`
~L18-27) decides `direction` ("flat"/"up"/"down" → the "No change"/"Growth"/
"Decline" wording via `trend-labels.ts`) from a RATIO percentage —
`pctChange = ((current - anchor) / anchor) * 100`, flat if
`abs(pctChange) < FLAT_THRESHOLD_PCT` (15) — while the NUMBER shown next to
that wording for percent-unit stages (KS2's headline stat) is
`trendMagnitudeFor()`'s raw percentage-POINT difference (`current - anchor`,
unrelated to `anchor`'s own size). These are two different quantities: a
school moving from 69%→79% is +10pp raw but only a 14.5% ratio change (under
the 15 threshold → "flat"); one moving from 60%→71% is +11pp raw but an
18.3% ratio change (over 15 → "up"). The label boundary shifts around
depending on each school's own anchor value rather than sitting at a fixed
pp cutoff — exactly the inconsistency reported, and it'll keep looking
essentially random however the single ratio threshold is retuned, because
the wording and the number it sits next to are fundamentally measuring two
different things.

Guy's own replacement spec, absolute pp-based, symmetric for growth/decline
(some rounding needed at the edges — treat this as -2 to -5 "small decline",
-6 to -15 "decline", mirrored for growth, i.e. no gap or overlap between
tiers):

- 0 to ±1pp: **No change**
- 2pp to 5pp: **Small growth** / **Small decline**
- 6pp to 15pp: **Growth** / **Decline**
- 16pp+: **Steep growth** / **Steep decline**

This only makes sense where the displayed change is genuinely in
percentage points — confirm directly which real call sites that is (KS2's
own headline trend via `trendMagnitudeFor`, unit `"pp"`) rather than
assuming; KS4/KS5's own trend already uses a relative `%` change via the
same function (different unit, `trendMagnitudeFor`'s own `"%"` branch,
correctly left as ratio-based) and Rolls' own roll-count trend uses
`trendBadge()`'s ratio `pctChange` directly for both wording and number
together (no mismatch there, since roll counts have no natural "point"
unit) — neither of those should change unless something in the code shows
otherwise. `trend-labels.ts` is shared between Rolls and Academic
(round 3) and currently only has three tiers (up/down/flat); extending it
to the new 7-tier scheme needs a real design call on how to do that without
breaking Rolls' own existing 3-tier usage — make that call directly, name it
in the build report, rather than guessing silently.

## 5. Grade-band palette: lightest stops don't read against the map

Guy's own direct instruction: the current scale's lightest stops (the low
end) don't have enough contrast against the map basemap to read as a real
colour at all. Shift the whole scale darker rather than just deleting the
lightest stop — start the bottom of the new scale where the CURRENT scale's
own quarter-mark stop is, and make the top darker than the current top too,
so the scale still spans a genuinely wide range, just shifted up.

`GRADE_BAND_STOPS` (`src/lib/trend-colours.ts`) is currently:

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

Sense-check this actually reads well against the real basemap (light mode
and dark mode both, if the map supports both) before treating it as done —
this is a first specific proposal grounded in Guy's own instruction, not a
locked value; retune the exact stops if they don't look right once actually
rendered. This is independent of item 1/2's fix (which changes what real
VALUE the colour is computed from, not the palette itself) — both apply
together.

## Build notes

Local build/test only, no commit/push, same discipline as every round.
Re-verify items 1 and 2 live against Yerbury Primary and at least one GCSE
and one Post-16 school (to confirm the KS4/KS5 shape is really the same
issue, not just theorised from the code) before fixing. For item 4, name
the real schools/values used to confirm the new tiers land where expected.
For item 5, look at the real rendered result before calling it done. Name
the real before/after values for a couple of real schools in the build
report throughout — not just "fixed."
