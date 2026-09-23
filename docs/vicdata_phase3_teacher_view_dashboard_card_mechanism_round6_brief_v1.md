# Teacher view — dashboard card mechanism, Round 6: brief

## What this is

Round 6 of the Teacher view card-mechanism work, covering all four dashboard cards — Candidates, Results, Context, and Comparisons (renamed from Rankings, see §5). Prototyped and iterated live with Guy as an interactive wireframe (Design-canvas artifact, four boards: `Main.dc.html` = Candidates, `Results.dc.html`, `Context.dc.html`, `Rankings.dc.html` = Comparisons). This brief is the record of what was agreed and why; the companion Claude Code prompt (`..._round6_claude_code_prompt_v1.md`) turns it into a real, pixel-perfect build.

The wireframe is not just a sketch to work from loosely — every panel is genuinely interactive (click the Add button, the measure pickers, the sort headers, the year arrows). Click through it before building; it answers most "what happens when—" questions a written brief can't.

**As of 2026-09-23, every open decision below is resolved — see §6.** This version folds those answers into the sections they affect; §6 remains as the decision log so the reasoning isn't lost.

## 1. Lessons from previous rounds — read this before building anything

1. **Round 4's own mockups (box-per-view, fullscreen toggle, share icon, "Edit this view" link) were never actually built.** Round 5's build report discovered this the hard way — it went looking for a card mechanism to extend and found only the real, simpler thing described in §2 below. Do not assume this brief's "what's already real" section (§2) is still accurate by the time you build — it was checked directly against the live `vicdata_public` code on 2026-09-23. Re-check it again if building starts later than that.
2. **A grounding claim in this round's own wireframe turned out to be wrong, and was corrected in place once caught.** The Comparisons column's "vs: average / pick a school" selector was captioned as reusing `RollTrendsChart.tsx`'s real "average toggle." A direct re-check found `RollTrendsChart` isn't even part of Teacher view (it's advanced-dashboard pupil-roll only), and its toggle does something different (lines-vs-blended-average, not average-vs-one-named-school). The wireframe's caption now says so plainly. Treat every "grounded in X" claim anywhere in this brief the same way: a claim to re-verify, not a settled fact — including this brief's own.
3. **Context's long-open question — "should the 5 comparison axes work for Results only, or for Candidates too?" (flagged unresolved in the first-pass build report) — was already answered for real, separately from this round.** `teacher-view-catalogue.ts` shares one 5-entry `AXES` catalogue across Results, Candidates, and Context via a per-column `COLUMN_MEASURE`, not two parallel catalogues. Read that mechanism before touching Context — see §2 and §4.2.
4. **Reuse real, working components; don't rebuild what already shipped.** `RankingsMap.tsx` (real Leaflet map, live in Teacher view today) for Comparisons' map view. `ViewChart.tsx`'s labelled-bar style for any new bar chart. The existing `ColumnBuilder` / `CardBox` / `teacher_view_preferences` persistence mechanism for the removable-panel work in §3 — extend it, don't parallel it.
5. **Where this brief flags something as unconfirmed or time-sensitive (marked "CONFIRM FIRST"), re-verify it directly before building on it,** the same discipline the T-Level ingest round used for its own nine lessons-from-real-bugs. A brief written today can be stale by the time someone picks it up. (Both this round's CONFIRM-FIRST checks — §4.1's Grade 4+ data and §4.3's comparator history — were run during the build itself and both came back with real data available; see §6.4 and §6.5.)
6. **When you hit a gap this brief doesn't cover, surface it rather than picking a plausible default and continuing.** §6.6 through §6.10 below are gaps Claude Code itself caught mid-build (existing axis picker, Comparisons' real pill structure, the From:/Trend-line/Since: controls, KS2, saved-pin fallback) — all correctly flagged rather than quietly decided, which is exactly right for this kind of build.

## 2. What's already real today (checked directly, 2026-09-23)

- **Card mechanism**: `src/components/teacher/ColumnBuilder.tsx` (a tick-to-add/remove `TickList`, same component the subject picker uses) pins views onto a column; each pinned view renders as its own `CardBox` (`src/components/teacher/CardBox.tsx`) with its own remove link and fullscreen modal. Pins persist immediately to Supabase (`teacher_view_preferences`, via `src/lib/teacher-view-data.ts: savePreferences`), wired in `src/app/teacher/[phase]/page.tsx`.
- **The "Current" box in every column is rendered unconditionally, outside the pinned-views array** (`page.tsx`, e.g. lines ~885, 936, 1022, 1064, each before its column's `ColumnBuilder` call). "Reset" only clears pins back to zero; it does not touch the default box. **There is no existing way to remove it.** This matters directly for §3.
- **Results**: exactly one real measure, `COLUMN_MEASURE.results = { key: "points", label: "Average point score" }` (`teacher-view-catalogue.ts:101-105`). No Grade 4+ or any threshold-rate measure exists anywhere in the repo. The Results default box is a plain list with a bold points figure and a small ± delta vs England — no bar chart, no national-average marker. `ViewChart.tsx` does render bars, but only for pinned axis views, never the default.
- **Context**: `AXES` (`teacher-view-catalogue.ts:48-59`) has exactly 5 real entries — `vs_school_avg`, `vs_category`, `vs_all_subjects`, `vs_chosen`, `category_vs_categories` — shared across Results, Candidates, and Context via each column's own `COLUMN_MEASURE` (`results` → points, `candidates` → entries, `context` → entries). Context's own measure is fixed to entries today; it does not currently offer a Results-type measure inside the Context column at all.
- **Comparisons (still named "Rankings" in code)**: all four comparator sets are real — `sameSector()`, `localRivals()`, `similarSize()` in `src/lib/teacher-view-rankings.ts`, plus the default nearest-10 — wired into pinnable views via `rankingsViews()` (`teacher-view-catalogue.ts:145-163`), each currently its own separate pinnable box, measure fixed to the phase headline (Attainment 8 etc). The map is real too: `src/components/teacher/RankingsMap.tsx`, a live Leaflet component with real "Nth of total" position, subject filter chips, and its own fullscreen variant, already wired into the Rankings default box.
- **Comparator-school history is real, not single-year.** `fetchAcademicProfiles` already returns per-year `ks2`/`ks4`/`ks5` headline data (`attainment8_average` at KS4, `aps_per_entry` at KS5) for every year on record, for the whole comparator union — the rankings route currently collapses each school to `latestMeasureAt(...)` at `route.ts:98-103` and discards the rest. See §6.4.
- **Real per-subject grade distribution data already exists** in the teacher dashboard payload — `subjectData.gradeDistribution`, parsed by `parseSubjectGradeDistribution` from `dfe_ks4_subject_entries` raw facts — but `page.tsx` currently only reads `subjectData.entries`; the grade-level detail is fetched and thrown away. See §6.5.
- No TODOs, feature flags, or half-built stubs were found in any of the above files — this is finished round-5 work, not scaffolding.

## 3. Cross-column: any panel removable, minimum of one left

Guy's own framing: *"any two can be deleted — leaving just one panel (i.e. default panel is not always the last one left)."*

Current, Trend, and % change become three peers of one removable set, not "one fixed default plus two optional add-ons." Add offers whichever of the three are currently hidden (a new "Current snapshot" option joins Trend/% change in the Add picker). Each panel's remove control is disabled (not hidden — visibly present but greyed, so it's clear why it won't respond) once it's the only panel left, so a column can never be emptied to zero.

**This is the structural change in this round, not a small addition.** Per §2, the real "Current" box is hardcoded outside the pinned-views array today. Making it removable means folding it into the same array/mechanism `ColumnBuilder` and `teacher_view_preferences` already use for Trend/% change, rather than bolting a second, parallel remove-button onto the existing hardcoded box. Whatever three-state shape currently exists (pinned-views array + separate always-on default) likely needs to become one array of up to three entries, persisted the same way, with "Current" simply becoming a normal (if usually pre-pinned-by-default) entry in it.

**Consequence for the existing per-subject axis picker (§6.6):** Candidates and Results today also let a user Add axis-based comparison views per ticked subject (e.g. "Vs. GCSE average") via the same `ColumnBuilder`/`AXES` mechanism described in §2. This round's 3-option Add menu (Current snapshot / Trend / % change) *replaces* that axis picker in Candidates and Results — it does not sit alongside it. Axis-based comparisons live only in the new Context column's combined picker (§4.2) going forward.

**No migration needed for any of this — there are no real users on Teacher view yet (§6.10).** Don't build fallback/notice logic for orphaned saved pins; there is nothing saved to orphan.

Applies identically to all four columns.

## 4. Per-column changes

### 4.1 Results — Measure switcher

A pill under the "Results" title (`"{{measureLabel}} ▾"`) opens a small dropdown: Average point score (real), Grade 4+ rate (build real, resolved below), Grade bands and Grade counts (both shown, greyed, "Coming soon" — no data model exists for either yet, a distribution rather than a single number per subject, deliberately out of scope this round). Picking a measure re-points Current, Trend, and % change at it together; Add stays orthogonal — it only ever asks "how do I want to look at this" (Current snapshot / Trend / % change — see §6.6), never "which data."

**Grade 4+ rate, resolved (§6.5):** build it real at KS4 — grade 9–4 ÷ all graded entries, off the real `subjectData.gradeDistribution` data already flowing through the payload. KS5 gets the equivalent A\*–E rate off the same rows, so the switcher isn't dead at Post-16. Two real limits to build around, not around: the parser only covers **2023/24 onward**, so Grade 4+ Trend has ~2 points and % change has one interval, not a full history — state that plainly rather than padding it; and a double-award GCSE result (e.g. "43") counts as meeting the threshold only when **both digits are ≥4** (strict), matching how DfE reports double-award thresholds.

**"Since:" pill on % change, and "From:"/"Trend line" on Trend (§6.8):** build these — they're wireframed, working controls, not decoration. "From:" cycles through the years that measure/subject combination actually has data for (see §6.3); "Trend line" toggles a dashed least-squares fit over the plotted series; "Since:" is the % change equivalent of "From:".

Current's default view changes from the real plain list to a horizontal bar per subject with a national-average marker (adapted from `ViewChart.tsx`'s existing labelled-bar style — track, colour fill by qualification, value at the end — with a marker added, since no existing bar carries one today). A second icon switches to a sortable 3-column table (Subject / Result / vs National) — click any header to sort by it, click again to flip direction; the summary sentence always names the subject furthest above and closest to/below national, independent of how the table happens to be sorted.

### 4.2 Context — combined "Compare against + Measure" picker

One dropdown (not two separate pills, per Guy's explicit choice) covering both dimensions of what Context compares:

- **Compare against**: Whole school / Other subjects in [subject area] / Selected subjects (tick to build a custom set — self-inclusive, i.e. the group includes the subject being compared, matching the real convention already used elsewhere for comparator-set averages). **Resolved (§6.1): 3 options only, matching the wireframe exactly.** `category_vs_categories` stays deferred — it compares subject *groups* to each other rather than a subject to a group, a different comparison unit that the chip row, bar-with-marker, and 3-column table shapes built this round aren't drawn for.
- **Measure**: Candidates, or Results (Average point score / Grade 4+ rate / Grade bands & counts "Coming soon") — same switcher content as §4.1.

**Real gap to solve, not just UI**: Context's measure is fixed to `entries` in the current architecture (§2). Letting a user switch Context between Candidates and Results measures in the same column — which this round's UI does — needs `COLUMN_MEASURE` (or wherever it's consumed) to support a per-instance measure choice for Context, not a fixed per-column one. This is real plumbing work, not just a new dropdown.

Current gets a subject-chip row (shared with Trend, below), a three-way icon toggle — donut (share-of-group, Candidates measure only; greyed out for Results measures, since a "share" of an average score isn't a meaningful percentage) / bar / table — and a year prev/next control (Current is no longer pinned to 2024/25 only; it uses the same real-years-only logic as §4.1/§6.3). Trend plots two lines, your focus subject(s) and the comparison group's own trend, dashed grey for the group line, with the same From:/Trend-line controls as §4.1. % change keeps the existing per-subject bars (no chip selector — comparing subjects is the point) and adds one more bar for the comparison group itself, with the same Since: control.

### 4.3 Comparisons (renamed from Rankings)

**Naming, resolved (§6.2): UI copy only.** Headings, labels, and onboarding read "Comparisons"; `teacher-view-rankings.ts`, its `ColumnId`, the `rank_*` view ids, and the `ks4:rankings` note key all stay as they are in code. Nothing persisted changes, so no migration is needed.

**Two pills, resolved (§6.7):** the wireframe shows "Compared against: {set}" and "Measure: Results / Candidates" under the heading — build both. The four comparator sets (`rank_list`/`rank_same_sector`/`rank_local_rivals`/`rank_similar_size`), currently four separate pinnable boxes, become the options in the "Compared against" pill rather than four boxes competing for one of the column's three panel slots. **Ship the flat Results/Candidates pair for "Measure"**, not the fuller §4.1 sub-measure list — comparator-school data is whole-school headline only (not per-subject), so a Grade 4+ option here would have nothing behind it.

Current gains a third icon view, **Graph**, alongside the real Map and the existing sortable table (now labelled "Ranking") — order in the icon row is graph, map, ranking, per Guy's own stated order. Graph is a horizontal bar per school in the comparator set plus your own school (bold, dark), same bar style as §4.1's Results chart, no benchmark marker (the bars are the comparison). Ranking stays the default view.

Trend and % change compare your school against the comparator set's own trend, not just your own line: a **"vs:" selector**, defaulting to "Average across {set}," swappable to any one named school in the currently-selected comparator set. Per lesson 2 (§1), **this is a genuinely new mechanism** — it does not reuse an existing real component. Picking a different comparator set above resets the selector back to "Average." Trend and % change also carry the same From:/Trend-line/Since: controls as §4.1 (§6.8).

**Comparator-school history, resolved (§6.4): build on real data.** The wireframe's fabricated `genSeries()` drift (deterministic, keyed off school id, captioned honestly as fabricated) is not needed — real per-year comparator history already exists via `fetchAcademicProfiles`, it's just discarded at `route.ts:98-103`. The work is returning the full series alongside the collapsed latest value in `rankSets`, not new ingestion.

**Date range, resolved (§6.3): derive from real data everywhere, no hardcoded year in any column.** Neither 2018/19 nor 2019/20 in the wireframe was ever real — both were placeholder constants. The real fix is `yearsOfData()`-style logic in every column: each "From:"/"Since:" selector offers exactly the years that school and measure actually have data for. This also removes the inconsistency the wireframe flagged but didn't resolve, since there's no fixed range left to disagree.

## 5. Cross-cutting notes

- Colour stays qualification-based (GCSE green `#34d399`, BTEC/OCR blue `#60a5fa`) for anything tied to a specific subject/qualification; neutral grey (`#57534e`/`#a8a29e`) for anything combined, whole-school, or group-level.
- Every new sortable table follows the same pattern already shipped for Results: header buttons with a trailing arrow, click to sort, click again to flip; the summary sentence is always computed independently of the current sort so it doesn't change as the user reorders the table.
- "Coming soon" measures (Grade bands, Grade counts) are shown, not hidden — greyed, non-interactive, with a small tag — so their absence reads as a known gap, not an omission nobody noticed.
- KS2 is untouched by this round. Teacher view has no KS2 instance at all — there was never a real question here (§6.9 below is kept only as a record that it was asked and dismissed).

## 6. Decision log — all resolved, 2026-09-23

1. **Context's comparison axes** → 3 options, matching the wireframe (see §4.2).
2. **Comparisons rename scope** → UI copy only, no code/module/route rename (see §4.3).
3. **Comparisons' date range** → derive from real data in every column; no hardcoded year anywhere (see §4.3).
4. **Comparisons' comparator-school history** → build on real per-year data already available via `fetchAcademicProfiles`; the wireframe's synthetic history is not needed (see §4.3).
5. **Results' Grade 4+ rate** → build real at KS4 (real per-subject grade data already in the payload), A\*–E equivalent at KS5, strict double-award counting, 2023/24-onward data flagged plainly rather than padded (see §4.1).
6. **Candidates/Results' existing per-subject axis picker vs. this round's 3-option Add menu** — Claude Code caught this gap itself mid-build; not in the original brief. Put to Guy as (1) replace it with 3 options only, (2) keep both, (3) replace but keep axes as a Trend measure. **Guy chose (1).** See §3.
7. **Comparisons' two pills** — another gap Claude Code caught: the wireframe shows "Compared against" and "Measure" pills, but the four comparator sets are today four separate pinnable boxes and the measure is fixed to the phase headline. **Resolved: build both pills** (folding the four comparator sets into "Compared against"), **ship the flat Results/Candidates pair** for "Measure" rather than the fuller sub-measure list, since comparator data is whole-school only. See §4.3.
8. **"From:"/"Trend line"/"Since:" controls** — present on every board in the wireframe, not described in the original brief. **Resolved: build them.** "From:" is also what makes §6.3's derive-from-data approach actually work. See §4.1–§4.3.
9. **KS2** — raised as a possible gap (wireframe is GCSE-shaped throughout). **Not applicable: Teacher view has no KS2 instance at all**, so there was never a real decision here.
10. **Existing saved pins under the old axis picker (§6.6)** — raised as a possible migration concern (drop silently / notice / map onto new options). **Not applicable: there are no real users on Teacher view yet, so there is nothing saved to migrate or orphan.** Build §3/§4 without any fallback logic for this.
11. **Staging** → staged local commits per numbered section (§3 → §4.1 → §4.2 → §4.3), each `tsc --noEmit`/`eslint`/production-build clean before moving on, so Candidates and Results can be checked working before Context and Comparisons land — same separation round 5's build and its gaps-and-ship round used.

**Push, resolved (one-off for this round, not a new standing default):** push each staged section once it's clean, rather than holding everything for local review at the end — it's easier for Guy to review on the live site. This is a deliberate exception to the usual "local commits, push only with Guy's explicit go-ahead" pattern from earlier rounds; don't carry it forward to future rounds without asking again.

## 7. Verification checklist for the build report

- `tsc --noEmit`, `eslint`, and a production build all clean, for every staged section before it's pushed (§6.11).
- Each new mechanism click-tested against a named real school (not just "it compiles") — the Add/remove-any-panel flow down to one panel and back up; Results' Measure switcher on both real measures; Context's combined picker on all three compare-against options crossed with both measures; Comparisons' Graph view, both pills, the "vs:" selector, and the comparator-set switch resetting it.
- Light/dark theme confirmed covered by the existing Teacher-view CSS subtree, not a second parallel toggle (per the round-5 lesson already logged for the fullscreen modal).
- `teacher_view_preferences` round-trips the new panel-removal state correctly on reload — including "Current" now being a removable, persisted entry rather than a hardcoded always-on box.
- Every "From:"/"Since:" selector genuinely offers only years that school/measure combination has data for — spot-check a school with a short real history, not just one with the full range.
- Candidates and Results no longer offer the old per-subject axis-based Add options (§6.6) — confirm they were removed.
- Mobile-width spot check on the new combined dropdowns (Context, Comparisons) — they're the densest new UI in this round.
