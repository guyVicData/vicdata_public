# Grade bands and counts: Teacher view planning brief (v1)

Sibling to `vicdata_phase3_grade_bands_backend_brief_v1.md` — this half covers `vicdata_public`, the Teacher view UI. A discussion brief, not a build prompt. Checked against `vicdata_public` HEAD `5c2fa89` (snagging round 1's build report commit).

## The product already anticipates this work — almost exactly the shape we landed on

`MeasurePicker.tsx`'s own comment: "The two measures with no data model yet — Grade bands and Grade counts — are SHOWN, greyed, tagged 'Coming soon'." `teacher-view-panels.ts` already reserves both as real `MeasureId`s: `{ id: "bands", label: "Grade bands" }` and `{ id: "counts", label: "Grade counts" }` in `COMING_SOON_MEASURES`. This work fills in two slots someone already anticipated, not a bolt-on.

Per Guy's own instruction (backend brief, now confirmed), the split is NOT "numeric GCSE/A-level bands versus vocational counts" — every qualification gets full grade counts, at every geography, with none left out. The real split is presentational: **Grade bands** is a summarised range on whatever scale the focused subject's own qualification uses (the two DfE presets plus a genuine custom range, using the same ordering `GRADE_SCALES` already keeps for GCSE, A-level, IB, Pre-U, and every vocational scale alike — "Merit or above" is as valid a band as "grade 7-9"); **Grade counts** is the full per-grade distribution, no summarising at all. Both read the same underlying per-grade data once the backend brief's tables exist; they differ in whether the UI collapses a range into one rate or shows every grade.

## What's genuinely new UI, and what's wiring existing components

**Genuinely new: the custom band-range picker.** Nothing in the codebase is a range control — `MeasurePicker` is a flat list, `ContextPills`/subject tick-lists are multi-select, neither is "pick a lower and upper bound on an ordered scale." This is real, novel UI work, and per Guy's own call it ships with the two DfE presets (4-9, 7-9) from day one, not after them. It needs to work on ANY of the real scales `GRADE_SCALES` already orders, not just GCSE's 9-1 — the control itself should be scale-agnostic (drag/select two positions on whichever ordered list applies to the focused subject's qualification), not a numeric-only widget with vocational bolted on separately.

**Not new: the whole-school donut.** Context's Current panel already has a fully generic donut prop — `donut?: { enabled, groupLabel, groupTotals, shareOf }` (`SubjectPanels.tsx`) — with the fix from this round's Part 1 (`ad9ba27`) making the focus subject self-inclusive in its own group and correcting the "All other entries" legend line. "History: 10% of grade 9s" is this exact same mechanism fed a different `groupTotals` array (whole-school grade-9 totals per period, once "Grade bands" is the active measure) rather than entries totals. `ShareDonut` itself needs no change at all.

**Not new: the tiles.** `NumberTiles`/`NumberTile` (new this round, `NumberTiles.tsx`) is already generic — `{ key, icon, figure, detail, direction? }` in a row, exactly the shape both `CandidatesPanels` and `SubjectPanels`' Results variant already fill differently. A school's own raw count ("342 grade 9s this year"), its rate, and the LA/regional/national benchmark are three more tiles in the same list, not a new component. This also gives item 4's "raw and weighted, even regionally" its natural home: one tile for the total, one for the rate against the benchmark — same pairing the backend brief's schema already produces from one sum.

**Genuinely new: the vocational distribution view.** Nothing today shows "here's the full spread of grades this course's candidates got." Per Guy's own read, comparing a BTEC's Distinction/Merit/Pass spread against a GCSE-shaped "grade 9 equivalent" isn't meaningful, but comparing the same course's spread school-to-school or against its own national/regional figure for that SAME qualification is exactly the point — and per the backend brief's now-confirmed scope, that figure will exist for every qualification, not just the numeric ones. This needs its own visual design pass — worth discussing whether it's a small per-grade bar chart (there's a `HorizontalBarsIcon`/bar view convention already elsewhere in `SubjectPanels`, worth checking if it's a genuine fit or just a superficially similar shape before reusing it) or something else; flagging as undecided rather than picking one now. Given every qualification now gets this view, not just vocational ones, "Grade counts" is really the same distribution view for every subject — GCSE and A-level included — with the band summary as an optional lens on top, not a separate vocational-only feature.

## How this slots into the existing measure/view architecture

Once `bands`/`counts` have a real data model, `MeasurePicker` stops greying them out. Per the corrected scope above, neither measure should grey out on qualification type alone — the only real grey-out condition is the donut's own existing pattern: no data at all for the focused subject in the current period (`enabled: false`), not "this subject happens to be vocational."

Selecting `bands` as the active measure re-points Column 1's Current, Context, and Column 3 the same way selecting any other measure already does (per `MeasurePicker`'s own stated purpose — one switch, three panels follow together): Column 1's Current panel gets the new tiles (school's own count/rate); Context gets the range picker and the donut; Column 3 gets the LA/regional/national ranking-by-rate, reusing Part 4's now-real `rankingSet`/tiles mechanism from this round rather than inventing a fourth way to show a rank.

## Open decisions this brief can't settle alone

- The range picker's own interaction design (drag two handles on the scale, two dropdowns, something else), scale-agnostic per the above — genuinely undecided, worth a wireframe pass once the backend shape is settled, the same way every other new view in this project got one before a build prompt.
- The vocational/full-distribution view's visual shape, as above.
- Whether every qualification's LA/regional/national figure is exactly what the backend brief's grade-grain geography aggregate already gives for free once that table exists, or whether some presentation-side work is still needed to make a vocational course's national comparison legible (a distribution-to-distribution comparison is a harder thing to show clearly than one rate against one benchmark) — worth a design pass, not assumed to be free just because the data is.

## What this brief deliberately doesn't cover

The backend schema and its now-confirmed "every qualification, no exceptions" scope are the sibling brief's territory (`vicdata_phase3_grade_bands_backend_brief_v1.md`) — this one assumes that data exists and focuses on what the Teacher view does with it once it does.
