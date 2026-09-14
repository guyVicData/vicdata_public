# Academic Results — round 3: Map (edit 2), Graphs (edit 1), Rankings (edit 1)

Three sections, gathered live plus two decisions confirmed with Guy directly
(entries-vs-population, and the grade-band colour scale) — both folded into
the relevant items below rather than left open. Read this brief in full
before starting; Map round 2 (commit bec66f8) is the current baseline.

## Part A — Map (edit 2)

### A1. Real entries/candidate numbers for GCSE and Post-16 (decided)

Checked directly against the live DfE data: GCSE's live "A level and other
16 to 18 results"-sibling publication ("Key stage 4 performance") data set
has a real `pupil_count` indicator — a genuine per-school cohort-size figure
— that this project's `dfe_ks4_headline.py` does not currently ingest (its
own `_INDICATOR_COLUMNS` list doesn't include it, confirmed via the live
data set's own `/meta` endpoint). Post-16's data set already carries the
real per-(school, exam_cohort) entries count we DO ingest
(`aps_per_entry_student_count`, landed in the KS5 qualification-type-
awareness round, used for `dominantKs5Cohort`), plus a real whole-
institution total, `end1618_student_count` (identical across every
exam_cohort row for a school — confirmed present in the live data set's
`/meta` response, not currently ingested, per `dfe_ks5_headline.py`'s own
existing comment explaining why it wasn't landed at the time). KS2's live
school-level data set ("Key stage 2 attainment", "institutional level")
genuinely has no cohort-size/pupil-count indicator at all — confirmed via
its own `/meta` response — so there's nothing to add there.

Decided with Guy directly: use real entries for GCSE and Post-16, keep roll
population for KS2 (DfE simply doesn't publish one). Concretely:

- Add `pupil_count` to `dfe_ks4_headline.py`'s `_INDICATOR_COLUMNS`,
  re-ingest/backfill.
- Add `end1618_student_count` to `dfe_ks5_headline.py`'s `_NUMERIC_COLUMNS`
  (it's whole-institution, not per-cohort, so lands once per school/period —
  same shape `aps_per_entry_student_count` already has per-cohort, just
  without the `exam_cohort` dimension in its own breakdown key), re-ingest/
  backfill. Use this whole-institution figure for the Post-16 map circle
  size/label whenever no specific cohort is selected (the round-2 default
  per-school-own-cohort state); use the existing per-cohort
  `aps_per_entry_student_count` whenever a specific cohort IS selected — the
  real number of that cohort's own entries, not the whole-institution total.
- `AcademicSchoolProfile`/`fetchAcademicProfiles` need these two new real
  fields threaded through; `AcademicMapView.tsx`'s own `sizeValue()` and the
  popup/label text (item A4) switch to these for KS4/KS5 (family-level
  sizing is unaffected — it already uses real `entriesTotal`, per Round 2
  Part B). KS2's `sizeValue()`/labels stay on `populationAtAge`, unchanged.
- Verify this doesn't silently change `dominantKs5Cohort`'s own real
  per-cohort ranking logic — it should still use `aps_per_entry_student_
  count` exactly as now; `end1618_student_count` is ONLY for the map's own
  default-state sizing/label, a new, separate real quantity, not a
  replacement for the existing per-cohort one.

### A2. Grade-band colour scale (decided)

Current: grade-band mode reuses the Trend mode's own diverging red-green
scale (`trendColour(gradeValue - 50)`), which reads as a trend indicator, not
a results indicator — genuinely confusing. Guy's own direct instruction once
this was discussed: **value-based, normalised to the real min-max range of
whichever comparison set is currently on the map** (not rank position, and
not a universal fixed scale) — computed the same way circle SIZE already is
(`minSize`/`maxSize` from `withCoords` in the current drawing effect),
recomputed every time the set/exclusions/stage change. His own reasoning,
verbatim: "if it is value based we need to see how much variation there is
within sets... sometimes the differences will be huge... othertimes very
small, but the differences do matter" — real min-max normalisation is what
keeps a tightly-clustered set (e.g. UCAS points 38-44) reading as mostly
similar shades while a widely-spread one (e.g. KS2 percentages) uses the
full range, rather than either flattening real differences or manufacturing
fake ones.

Use a real sequential (single-hue) palette distinct from Trend's diverging
red-green scale — light-to-dark blue is the working recommendation (reads
as "more/better" without borrowing Trend's own red/green semantics); a
short, named set of real hex stops, not an ad-hoc gradient, matching
`TREND_LEGEND_STOPS`'s own shape in `trend-colours.ts`. Name the actual
scale/module choice in the build report.

### A3. Trend/Grade band buttons: reorder + reposition (supersedes round 2)

Reverse the button order to "Grade band" first, then "Trends" (plural, not
"Trend" — matches the noun form used everywhere else, see A4). Move the pair
back to the RIGHT-side overlay stack, under `PdfExportButton` — this is
Rolls' own real position for its Trend/Sector toggle (`topRightStackRef`,
`MapView.tsx`) and supersedes Map round 2's own "move to the left" item,
which turned out not to match Rolls' actual layout once seen live.

### A4. Popup refinement

Real, concrete rewrite, not a restyle: bold the key number(s), one stat per
line (not a single run-on sentence), and a real date on every quoted figure
— the latest real ingest year for grade-band view, the earliest real year in
the series for trend view (both already available per-school; don't
hardcode a global "latest year"). Add a real rank number to the grade-band
popup ("#1 of 11 compared schools") — text changes with whichever
comparison set is currently active, same "recompute against the live set"
discipline the round-2 comparator widening already established, not a
cached value. Growth/decline wording: introduce ONE shared constants module
(`src/lib/trend-labels.ts` or similar) both Rolls' and Academic's components
reference, rather than each hardcoding its own strings — Rolls'
`GraphsView.tsx` currently has an inline adjective form ("Growing"/
"Declining"/"Broadly stable"); Guy's own example popup text below uses a
noun form ("Decline -25pp", "Decline -15%"). Provide both real forms in the
one shared module (e.g. `{ up: { noun: "Growth", adjective: "Growing" },
down: { noun: "Decline", adjective: "Declining" }, flat: { noun: "No
change", adjective: "Broadly stable" } }`), have both existing Rolls' usage
and the new Academic popups read from it — a real shared constant, not two
separately-maintained string sets that can drift.

Exact target copy per stage, current vs new (KS2 example numbers/rank are
Guy's own worked examples, not placeholders — GCSE/Post-16 follow the same
shape using each stage's own real measures):

**KS2**
- Grade band, current: "57 10-year-olds, 74.0% meeting the expected standard
  in reading, writing and maths"
- Grade band, new:
  - **54** pupils entered for KS2 tests (2024/5)
  - **74%** met expected standard (2024/5), #1 of 11 compared schools
- Trend, current: same as grade-band current (undifferentiated today)
- Trend, new: Decline **-25pp** in % pupils meeting expected KS2 since
  2022/3

**GCSE**
- Grade band, current: "183 15-year-olds, 49.9 Attainment 8 average score"
- Grade band, new:
  - **183** pupils entered for GCSEs (2025/6)
  - **49.9** Attainment 8 average (2024/5), #5 of 14 compared schools
- Trend, new: Decline **-15%** change in Attainment 8 since 2021/2

**Post-16**
- Grade band, current: "153 17-year-olds, 36.3 average points per A-level
  and International Baccalaureate entry"
- Grade band, new:
  - **183** pupils entered for Post-16 exams (2024/25)
  - **36.3** average UCAS points (2024/5), #9 of 21 compared schools
- Trend, new (see A5 — currently has no working trend map view at all):
  Decline **-15%** change in average UCAS points since 2021/2

### A5. Post-16 map: Trend/Grade-band toggle doesn't really work today

Real, live-observed gap, not fully diagnosed yet: Guy's own note is "add
grade bands/trends button (ie include trends as view)" for Post-16
specifically, and "trends current: no map view" — meaning Post-16's map
doesn't currently offer a genuine working Trend view (or the toggle isn't
meaningfully available) the way KS2/GCSE do. Root cause is likely
`gradeBandAvailable` in `AcademicMapView.tsx` (`!familyId && (stage !== "ks5"
|| ks5Cohort === "A level")`) — grade band is gated to the "A level" cohort
specifically, forcing `effectiveColourMode` to "trend" for every other
cohort/the null default — but confirm this against the real live behaviour
first rather than assuming that's the whole story. Both real view modes
should work properly for Post-16 the same as KS2/GCSE (using A1's per-
cohort/whole-institution entries switch and A2's colour scale like every
other stage), not stay conditionally gated to one specific cohort. Name the
real root cause found in the build report.

## Part B — Graphs (edit 1)

Rolls' own `GraphsView.tsx` already has the exact real components this asks
for — reuse them directly, don't rebuild a similar version:

- `SectionHeading` (real collapsible-section toggle, `aria-expanded`,
  chevron, "independently collapsible, open by default") for the
  accordion structure.
- `Card` (real per-chart fullscreen expand, `FullscreenChartModal`) for
  "graphs can be expanded to full screen".

`AcademicGraphsView.tsx` currently has neither — four flat `<section>`
blocks with no collapse/expand at all. Restructure into three named,
independently-collapsible sections (mirroring `SectionHeading`'s own "all
open by default" behaviour):

**Section 1 — Entries.** Two-column: left, candidate numbers since the
start of the real series with a trend line (real entries per A1 for GCSE/
Post-16, roll population for KS2 — same source the map now uses, not a
second computation); right, a bar chart of the comparison set's own real
candidate numbers. Match Rolls' own graph style/format for both (axis,
colour, legend conventions) rather than a new look.

**Section 2 — Results.** 50:50 two-column: left, a bar chart of the overall
results summary — school vs. comparison set, latest real year; right, the
existing growth/decline-since chart, moved into this position unchanged.

**Section 3 — Subjects.** Move the existing subject-family selector into
this section (currently sits above/outside the graph sections). For now,
just make the existing subject graphs visible here as-is — Guy's own note:
"then I will refine" — don't redesign beyond relocating.

## Part C — Rankings (edit 1)

Four real headline-number tiles at the top of the Rankings view, above the
existing rank tables (worked example below is KS2 — GCSE/Post-16 use each
stage's own real headline measure/label/baseline, same values Overview's own
Part-3 headline number and the rank tables already compute, not a new
calculation):

- **Latest results** — the real current value + its own descriptor (e.g.
  "74.0% meeting the expected standard in reading, writing and maths").
- **Trend** — direction + magnitude + since-date, using A4's own shared
  noun-form wording (e.g. "Decline -25pp in % pupils meeting expected KS2
  since 2022/3").
- **Position** — real rank in the current set (e.g. "#6 of 11 compared
  schools").
- **Position over time** — Up/Down/Static (whichever is real for this
  school) plus the real from/to rank+year pair (e.g. "from #4 (2022/23) to
  #6 (2024/25)").

## Build notes

Same discipline as every prior round: local build/test only, no commit,
push, or hosted/production changes. A1's ingest additions need a real
backfill against real data (same pattern as prior ingest rounds — verify
real before/after row counts, don't just add the column and assume). Re-
verify A5 with real execution against a real Post-16 school, not by
inspection alone. Full build report in the usual shape when done, naming
every real design/implementation judgement call explicitly.
