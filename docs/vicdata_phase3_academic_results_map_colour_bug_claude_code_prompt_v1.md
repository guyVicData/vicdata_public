Live bug report on Academic Map's grade-band colour mode, found right after
Round 3 shipped. Full detail in
docs/vicdata_phase3_academic_results_map_colour_bug_brief_v1.md — read it in
full before starting.

Root cause for items 1 and 2 (colour doesn't track the displayed percentage;
legend scale reads 0-29% against a visibly 93%-47% set) is already found by
reading the code, not guessed: `GRADE_BAND_MEASURE` in
`src/lib/academic-data-view.ts` is a genuinely different real DfE measure
per stage than `HEADLINE_MEASURE` (the value shown in the popup/Rankings/
Overview) — a pre-existing "higher bar" threshold idea that predates Round
3, now driving the map's colour and its own min-max legend range while the
popup right next to it shows a different number entirely. Same root cause
hits all three stages, not just KS2 (see the brief for the KS4/KS5 detail,
including a second compounding "%" formatting bug on top of it). The brief's
own recommendation is to drop the separate `GRADE_BAND_MEASURE` map and
drive grade-band colour off the same `HEADLINE_MEASURE`/resolved-cohort
value already shown everywhere else — confirm that's right by seeing the
real before/after on a couple of real schools, then implement; name it
explicitly in the build report as dropping the old "higher bar" idea, not a
silent byproduct.

Item 3 (title overlapping the scale) is a likely CSS sizing issue — the
brief names the probable cause (a shared fixed-height title constant sized
for Trend's one-word title, not Grade band's two-word one) — confirm by
seeing it render, then fix.

Item 4 (growth/decline wording): also already root-caused by reading the
code, not guessed. `trendBadge()`'s "flat"/"up"/"down" wording comes from a
RATIO percentage threshold, completely decoupled from the raw
percentage-point number shown next to it for KS2's headline trend — that's
why the label boundary lands somewhere different for every school instead
of at a fixed pp cutoff. Replace it, for pp-unit trends specifically, with
Guy's own absolute banding: 0-1pp no change, 2-5pp small growth/decline,
6-15pp growth/decline, 16pp+ steep growth/decline. The brief has the exact
scope (which real call sites are pp-based vs ratio-based — don't touch the
ratio-based ones without a real reason) and flags that `trend-labels.ts`
(shared with Rolls) needs a real design call to extend from 3 tiers to 7
without breaking Rolls' own existing usage.

Item 5 (palette contrast): Guy's own instruction — the lightest grade-band
stops don't read against the map basemap. Shift the whole `GRADE_BAND_STOPS`
scale darker rather than dropping the lightest stop: the brief gives a
specific concrete replacement (bottom = today's quarter-mark stop, top one
step darker than today's top, same Tailwind blue scale) as a starting
proposal — look at how it actually renders and retune if it doesn't read
well, don't treat the given hex values as locked in. Independent of items
1/2 (palette vs. the value driving it) — both apply together.

Local build/test only, no commit/push. Full build report when done, naming
real before/after values for a couple of real schools for every item, not
just "fixed."
