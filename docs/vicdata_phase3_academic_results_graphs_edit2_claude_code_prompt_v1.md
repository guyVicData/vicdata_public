Academic Results — Graphs page, three items, in page order. Full detail in
docs/vicdata_phase3_academic_results_graphs_edit2_brief_v1.md — read it in
full before starting. This is a clean, standalone Graphs-page prompt —
nothing about the Map's colour/palette is in scope here (that's a separate
prompt).

Section 1 (KS2 entries): already root-caused. KS2 genuinely has no real
historic entries data (confirmed via DfE's own /meta endpoints in Round 3)
and the code already correctly falls back to roll population — but that
fallback (`AcademicSchoolProfile.ageGenderCounts`) is only ever a single
current-year snapshot, not a series, so KS2's "since [year]" trend line can
only ever show one point today. Rolls' own `data-view-profiles.ts` already
computes the real per-period equivalent (`ageGenderCountsByPeriod`) from the
same census source — extend the Academic fetch to pull the same real
per-period age-10 series and wire Section 1's KS2 branch to it, rather than
re-deriving anything new.

Section 2 (Results): delete the preserved headline-number/spread-strip/
target-vs-average-trend block that currently sits above this section's two
side-by-side graphs (`AcademicGraphsView.tsx` ~L440-476 — the brief has the
exact block). It was a deliberate, named Round 3 judgement call to keep it;
Guy's now seen it live and wants it gone. Section 2 becomes just the two
Card components already below it (same-year bar chart, growth/decline
chart), nothing above them.

Section 3 (Subjects): also already root-caused, and directly answers Guy's
own "why was this missed?" — Round 3 moved the subject CONTENT into Section
3 but never moved the `CategoryFilter` picker itself, which still lives in
`AcademicDataView.tsx`'s own header, gated to `activeView === "graphs"`.
Move the actual picker into `AcademicGraphsView.tsx`'s Section 3, keep the
`familyId` state/handlers where they already live and pass them down as
before. Section 3 should presumably always render now (picker + an empty
state before a family's picked) rather than staying invisible until a
family's already chosen via a control that no longer exists outside it —
confirm that's right once it's actually moved rather than assuming.

Local build/test only, no commit/push. Full build report when done, naming
the real per-school year range found for Section 1, and a before/after
screenshot for Section 2.
