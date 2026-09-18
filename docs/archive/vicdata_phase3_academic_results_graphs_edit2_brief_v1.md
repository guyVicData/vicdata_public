# Academic Results — Graphs page (edit 2): three items, in page order

All three grounded directly in the real code (and, for Section 2, the real
screenshot Guy sent) — not guessed.

## Section 1 — "Candidate numbers since..." — KS2 has no real historic
entries series; roll population is already the fallback, but only as a
single current-year point, not a real trend

Confirmed directly (not re-checked live — this was already established
during Round 3's A1 decision via DfE's own `/meta` endpoints): KS2's live
school-level data set genuinely has no cohort-size/entries indicator at all.
GCSE and Post-16 do (`pupil_count`/`end1618_student_count`, landed and
backfilled this round) — KS2 never will, DfE doesn't publish one.

`AcademicGraphsView.tsx` (~L381-388) already knows this and already falls
back to roll population for KS2, with an explicit caption saying so
("roll population for KS2, which DfE doesn't publish an entries figure
for") — so the intent here was already right. But the fallback value itself,
`populationAtAge(targetProfile, HEADLINE_AGE.ks2)`, only ever has ONE real
data point: `AcademicSchoolProfile.ageGenderCounts` is documented in its own
comment (`academic-data-view.ts` ~L63-70) as "Current-snapshot per-age
census population" — a single latest census figure, not a series. So for
KS2, the graph titled "Candidate numbers since [year]" with "a trend line"
(Round 3's own brief, Part B) can only ever show one bar/point today, not a
real multi-year roll trend, regardless of the fallback being conceptually
correct.

The real historic version of this exact data already exists elsewhere in
the codebase — it just isn't threaded into the Academic profile fetch.
Rolls' own `data-view-profiles.ts` (~L342-354) computes
`ageGenderCountsByPeriod: Map<number, AgeGenderCounts>` from the same real
`dfe_school_census`-sourced facts, one real entry per period, for exactly
this kind of roll-over-time chart. `AcademicSchoolProfile` fetches its own
`ageGenderCounts` independently of Rolls' own profile builder (by design,
per that field's own comment — keeps the Academic fetch self-contained) but
currently only pulls the current snapshot, not the per-period map.

**Fix**: extend the Academic profile fetch to also pull a real per-period
age-10 population series (mirroring `ageGenderCountsByPeriod`'s own real
computation, not re-deriving it differently), and have KS2's Section 1 use
that real series for its trend line instead of the single current point.
Confirm directly what years are really available for a couple of real KS2
schools before wiring the chart, and name the real range found in the build
report.

## Section 2 — delete the preserved headline block; keep just the two
side-by-side graphs

The screenshot shows Section 2's current top block: a headline number
("74.0%"), a "5% since 2022/23" trend line, the dot-strip/spread indicator
with min/max labels (47.0%/93.0%) and "3% above the average of 72.0%..."
text, and a two-line target-vs-average trend chart — all sitting ABOVE the
two side-by-side graphs Round 3 actually asked for in this section.

Confirmed directly in `AcademicGraphsView.tsx` (~L429-499): this is a real,
explicit, NAMED judgement call from Round 3's own build (see the comment at
~L433-439) — the pre-existing headline-number/`SpreadStrip`/
`TargetVsAverageTrend` block was deliberately kept as an "introductory"
block above the section's own new content, on the reasoning that it was
"real, useful content this restructure doesn't ask to remove." Guy's own
instruction now: delete it. That's the whole `<div className="mb-6">...
</div>` block (~L440-476) — the headline number, the `SpreadStrip`, and the
`TargetVsAverageTrend` chart all go. What stays, unchanged, is the
`<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">` block right below
it (~L478-499): the "Results summary" same-year bar chart on the left, the
"Growth / decline since..." diverging bar chart on the right — Section 2
becomes just those two, side by side, nothing above them.

## Section 3 (Subjects) — the actual subject-family selector was never
moved; only its downstream content was

Guy's own question: "this change was missed — why?" Confirmed directly by
reading both files: the picker itself, `CategoryFilter` (the pill buttons
that set `familyId`), still lives in `AcademicDataView.tsx` — rendered in
that component's own external header row, gated on
`activeView === "graphs"` (`AcademicDataView.tsx` ~L466). Round 3's Graphs
restructure only touched `AcademicGraphsView.tsx` itself: it wrapped the
already-existing, already-conditional subject content under the new
`SectionHeading` (`AcademicGraphsView.tsx` ~L517: `{familyId && familyLabel
&& (...)}`) but never relocated the picker control that sets `familyId` in
the first place. Literally: the content that depends on a family being
picked moved; the thing you pick the family WITH did not. That's why a user
opening the Graphs tab today sees no Section 3 at all until they've already
used a selector that's still sitting outside/above the section it drives —
confusing, and not what "move subject selector into this view" asked for.

**Fix**: move `CategoryFilter` itself out of `AcademicDataView.tsx`'s header
and into `AcademicGraphsView.tsx`'s own Section 3, above its existing
content, so the picker and the graphs it drives are genuinely in the same
place. `AcademicDataView.tsx` will need to keep owning `familyId`/`families`
state and pass `onChange` down (same as it already does for the other
views) — this is a real relocation of the rendered control, not a new
picker. Section 3 should presumably now always render (picker + a genuine
"pick a subject" empty state) rather than only appearing once a family is
already selected, since the picker no longer exists anywhere else for a
user to have used first — confirm that reads right once it's moved, don't
assume.

## Build notes

Local build/test only, no commit/push, same discipline as every round. For
Section 1, name the real per-school year range found. For Section 3,
confirm the moved picker still drives the same real state as before
(Rankings/Map views must be completely unaffected — they never rendered
`CategoryFilter` at all, only Graphs did). For Section 2, a before/after
screenshot in the build report is the clearest way to confirm it landed
right.
