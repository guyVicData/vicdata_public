# Brief: Academic Results review, stage 1 — wiring/functionality fixes

Guy is running a structured 4-stage review of the Academic Results feature (1. wiring/
functionality, 2. UI/UX, 3. data shown, 4. changes/additions), flagging real issues
against sample schools as he finds them. This brief covers his first batch of flags,
already root-caused against the real code and real hosted data before writing this —
don't take the diagnosis below on faith, but it should save you the investigation.

## Part A — Map goes blank after switching to Graphs/Rankings and back

**Root cause, confirmed by diffing against Rolls' own working `MapView.tsx`**:
`AcademicMapView.tsx`'s Leaflet init effect is missing two things Rolls' own map has,
both added there after a real live bug (see `MapView.tsx`'s own 2026-09-05 comment):

1. No `ResizeObserver`/`map.invalidateSize()` call. `AcademicDataView.tsx`'s wrapping
   div changes className when `activeView` flips away from `"map"` (loses
   `min-h-[480px] flex-1`) and back (regains it) — `DataViewErrorBoundary`'s own
   `key={`${activeView}-${effectiveStage}-${familyId ?? "whole"}`}` fully unmounts and
   remounts `AcademicMapView` on every switch (same pattern Rolls' own map uses, keyed
   on `activeView` alone). Leaflet measures its container once at `L.map()` call time
   and never re-measures itself — MapView.tsx's own comment documents this exact
   failure mode ("blank/cut-off tiles") and fixes it with a `ResizeObserver` calling
   `map.invalidateSize()`. AcademicMapView has no equivalent at all.
2. No teardown on unmount. MapView.tsx's cleanup does
   `resizeObserver?.disconnect(); if (mapRef.current) { mapRef.current.remove();
   mapRef.current = null; }`. AcademicMapView's cleanup is just `cancelled = true` —
   the old Leaflet instance, its tile requests and its DOM/event bindings are never
   torn down when you navigate away, leaking a live map instance every single switch.

**This is the same root cause behind the Category filter appearing to "not work" on
Map** — `familyId` is part of the same remount key, so selecting a category triggers
an identical unmount/remount of the Leaflet instance.

**Fix**: bring `AcademicMapView.tsx`'s init effect in line with `MapView.tsx`'s own
pattern — add the `ResizeObserver`/`invalidateSize()` call after `mapRef.current = map`
and observe `mapElRef.current`, and fix the cleanup to disconnect the observer and
call `mapRef.current.remove()` before nulling the ref. Copy the mechanism, not
necessarily every option MapView.tsx also has (gesture-handling/clustering are
out of scope here, per the original build brief's own "no clustering, no choropleth"
scope for this simpler map).

Verify with a real interaction sequence once built (a real browser check, not just a
read of the diff): load a school's Data View, confirm the Academic map renders,
switch to Graphs, switch to Rankings, switch back to Map — the map and its markers
must still be there, and confirm the same for selecting/clearing a Category (family)
filter while on the Map tab.

## Part B — Category filter appears broken on Rankings; the ▾ caret implies a
drop-down that doesn't exist anywhere

Two separate, real things here, not one bug:

1. **Rankings never receives `familyId`/`familyLabel` at all** —
   `AcademicDataView.tsx`'s render call for `AcademicRankingsView` passes only
   `targetProfile`, `tickedProfiles`, `stage`, `startPeriod`. This is a **deliberate**
   scope decision from round 2's own build (see `AcademicRankingsView.tsx`'s own header
   comment: "subject-family metrics do NOT get their own Rankings entry ... Family/
   subject comparisons live in Graphs only"), not an oversight — but the shared
   `CategoryFilter` row above the content is rendered unconditionally for all three
   views, so a user on Rankings sees a fully clickable set of category pills that
   silently do nothing. That's the real bug: the control shouldn't be shown as live
   where it has zero effect.
   **Fix**: hide (or visibly disable, your call on which reads better) the
   `CategoryFilter` row in `AcademicDataView.tsx` when `activeView === "rankings"`.
   Don't build family-level Rankings — that was a deliberate round-2 scope cut, not
   something this round should reopen.
2. **The ▾ caret on each category pill (`CategoryPill`'s `hasCaret`) visually implies
   an expandable next level, but clicking a pill never expands anything in place** — it
   just sets `familyId`, which (on Graphs only) appends a new "Subject/family
   breakdown" section further down the page, itself containing a completely separate
   `<select>` dropdown for subject. There is no drill-down UI anywhere near the pill
   itself, and nothing resembling "the next level" on Map or Rankings at all.
   **Fix, this round**: remove the caret from `CategoryPill` (or restyle it so it
   doesn't read as an expander) since nothing actually expands from the pill — this is
   a truthful-affordance fix, not a request to build inline expansion. Flag clearly in
   your report whether Guy should decide separately (stage 2/4 territory, not this
   round) whether the Subject picker ought to move closer to the category pills it
   logically follows from.

While in this file: confirm `AcademicGraphsView`'s own family section (`{familyId &&
familyLabel && (...)}` block) genuinely renders and updates when a category is
selected — a real browser check on a school with real family-level data, not just a
code read, since Guy's flag may partly be this section being easy to miss below the
fold rather than actually broken.

## Part C — Map popup labels need real data, not just the school name

`AcademicMapView.tsx`'s marker tooltip is currently just
`.bindTooltip(`${p.name}${isTarget ? " (this school)" : ""}`)` — no figures at all.
Guy's own example: "an A-level map — label needs to say X 17 year olds, Y average
points per A-level entry."

**Fix**: extend the tooltip content using data already computed in the same drawing
loop — no new fetching needed:
- The population figure already driving circle size when no family is selected
  (`populationAtAge(p, age)`, i.e. the same count behind "X of `HEADLINE_AGE[stage]`
  year-olds"), or the family entries figure (`latestFamilyYear(p, stage,
  familyId)?.entriesTotal`) when a family is selected — match whatever the circle
  size is currently encoding, so the label explains the circle the user is looking at.
- The relevant headline/family average — `headlineValueAt(years, latestYear(years)
  ?.period ?? -1, measureKey)` formatted via the same `HEADLINE_LABEL`/`HEADLINE_UNIT`
  pattern used elsewhere in this file (or `latestFamilyYear(p, stage,
  familyId)?.avgPointScore` when a family is active).
Use `L.Tooltip`'s HTML support (Leaflet tooltips accept HTML content) to lay this out
as more than one line if that reads better than a single string — match whatever
Rolls' own MapView.tsx tooltip does, if it already has a multi-line pattern worth
reusing.

## Part D — Leighton Park / Wellington College's very low GCSE Attainment 8: real
finding, not a data-coverage bug

Investigated directly against real hosted data before writing this — **this is not a
"were they added recently" gap and not a genuine performance problem**. Real
`academic_headline_lookup` results for both schools (URN 110110 Leighton Park, URN
110125 Wellington College), every year 2021–2024:

- `ebacc_94_percent` / `ebacc_95_percent` / `engmath_94_percent` / `engmath_95_percent`
  are **exactly 0.0** for both schools, every year.
- `attainment8_average` is real but low (13.6–26.3 for Leighton Park, 13.7–18.2 for
  Wellington College, vs. a national average around 46–48).
- Both schools have **zero rows** in all three ingested subject-entries sources
  (`dfe_ks4_subject_entries_backfill`/`_live`/`_historic`) for these URNs — the
  subject-level table will show nothing for either school at KS4, which is itself a
  real, expected consequence of the same underlying cause, not a separate ingest bug.

This is a well-documented, real DfE methodology exclusion, not a VicData or ingest
problem: the DfE does not count IGCSEs — the qualification many leading independent
schools use instead of reformed GCSEs — in Attainment 8 or EBacc at all. Per Barnaby
Lenon (ISC): "The DfE does not allow IGCSEs to count in its performance tables and
that is why the GCSE results of some of the highest-performing schools in Britain
appear as zero in these tables." A school whose pupils mostly sit IGCSEs will show a
real but near-meaningless Attainment 8 (built only from whichever few reformed GCSEs,
typically Maths/English, those pupils also sit) and a literal 0% EBacc, regardless of
how well those pupils actually did.

**Don't build a "gate the average on when data started" fix — that would misdiagnose
the real cause and hide a genuinely correct (if genuinely misleading) DfE figure.**
Instead: add an honest caveat wherever KS4 Attainment 8/EBacc is shown (the free
snapshot card and Graphs' Overview section, at minimum), triggered when a school's
`ebacc_94_percent` and `engmath_94_percent` are both 0 for its latest year while
`attainment8_average` is present and non-trivial (a real, checkable signature of this
exact pattern — don't hardcode by school name). Wording is already drafted and settled
in `docs/vicdata_phase3_academic_results_summary_wordings_v1.md` §11 (added as part of
this same review finding) — use it as written: "This school's GCSE figures may not
reflect its full curriculum — DfE's performance tables exclude IGCSEs, which many
independent schools use instead of reformed GCSEs."

## Deliverable

Full report, same shape as every prior round: what you changed and why for Parts A–C,
a real browser-tested confirmation of the map/category-filter fixes (not just a code
read), and for Part D, confirmation of where the new caveat appears and on what real
schools you saw it trigger/not trigger (Leighton Park and Wellington College should
trigger it; a normal comprehensive with real EBacc entries should not). Build and test
locally — do not commit, push, or touch hosted/production. Guy will review the fixes
against the same sample schools before anything ships.
