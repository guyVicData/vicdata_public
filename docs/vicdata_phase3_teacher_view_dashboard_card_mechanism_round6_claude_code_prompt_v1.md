# Teacher view — dashboard card mechanism, Round 6: Claude Code prompt

Read `docs/vicdata_phase3_teacher_view_dashboard_card_mechanism_round6_brief_v1.md` in full before writing any code — it was updated on 2026-09-23 with every open decision resolved (§6). This prompt reflects that update; if you were mid-build against an earlier version of either doc, re-read both before continuing.

**The wireframe is a primary source, not a nice-to-have.** It's a live, interactive Design-canvas artifact: <https://claude.ai/artifact/3Mu1shp1U9SF8RxPDXTDaw> — four boards, `Main.dc.html` (Candidates), `Results.dc.html`, `Context.dc.html`, `Rankings.dc.html` (labelled "Comparisons" on the board itself). Open it and click through every control on every board before you start — the Add picker, both measure pickers, the sort headers, the year/From/Since controls, the trend-line toggle, the "vs:" selector, the checklist in Context's dropdown, the two pills on Comparisons. This build should be pixel-perfect against it: spacing, icon choices, colour, copy, the exact shape of each dropdown. Where the wireframe and this prompt genuinely conflict, the wireframe's caption text (the grey paragraph under each board) usually explains why.

## Resolved since the last version of this prompt

All of these are settled — build them as instructions, not open questions:

- **Add menu (§6.6)**: Candidates and Results' Add menu is exactly 3 options (Current snapshot / Trend / % change). The old per-subject axis picker is replaced, not kept alongside it.
- **Context's compare-against list (§6.1)**: 3 options only (Whole school / subject area / selected), matching the wireframe. `category_vs_categories` stays deferred.
- **Comparisons rename (§6.2)**: UI copy only — "Comparisons" in headings/labels/onboarding. No code, module, route, or persisted-key renames.
- **Date range (§6.3)**: no hardcoded year anywhere. Every From:/Since: selector derives its own range from real data (`yearsOfData()`-style), per column, per measure.
- **Comparator-school history (§6.4)**: real per-year data already exists via `fetchAcademicProfiles`, currently discarded at `route.ts:98-103`. Wire the real series through `rankSets` rather than building on the wireframe's fabricated `genSeries()`.
- **Grade 4+ rate (§6.5)**: build real at KS4 off the real `subjectData.gradeDistribution` data (already in the payload, just unread today); A\*–E equivalent at KS5. Strict double-award counting (both digits ≥4). Data only goes back to 2023/24 — state that in the UI rather than padding the range.
- **Comparisons' two pills (§6.7)**: build "Compared against" (folding in the four existing comparator sets) and "Measure" (flat Results/Candidates pair only — comparator data is whole-school, not per-subject, so no Grade 4+ here).
- **From:/Trend line/Since: controls (§6.8)**: build them on every Trend/% change panel across all four columns — they're wireframed, working controls.
- **KS2 (§6.9)**: not applicable — Teacher view has no KS2 instance. Nothing to do here.
- **Saved-pin migration (§6.10)**: not applicable — there are no real Teacher view users yet, so there's nothing saved to fall back for. Don't build any drop/notice/migration logic for old pinned axis views; just ship the new mechanism.
- **Staging (§6.11)**: staged local commits per numbered section below, each `tsc --noEmit`/`eslint`/production-build clean before moving to the next.
- **Push — one-off change from the usual pattern**: push each section once it's clean, rather than holding for a single push at the end. Guy wants to review this round on the live site as it lands, not only locally. This is specific to this round; don't treat it as the new default for future rounds without asking again.

## Build order

### 1. Cross-column: any panel removable (brief §3)

Foundational — do it first, once, in the shared mechanism, not four times per-column.

- Fold "Current" into whatever array/state `ColumnBuilder` and `teacher_view_preferences` already use for Trend/% change, rather than a second parallel remove path next to the existing hardcoded default box.
- Add "Current snapshot" as a third Add-picker option (icon: simple card/rect with a header line, per the wireframe). This *replaces* the old per-subject axis-picker Add options in Candidates and Results — remove those, don't leave them dormant alongside the new 3-option menu.
- Every remove control (Current, Trend, % change) is visibly present but disabled once it's the only panel left — never hidden, never able to empty a column to zero.
- No migration logic for old saved pins — there's nothing to migrate.
- Verify: pin/unpin down to one panel and back up on a real school, reload the page, confirm persisted state matches, confirm zero panels is unreachable.
- tsc/eslint/build clean → push.

### 2. Results — Measure switcher, real years, real Grade 4+ (brief §4.1)

- Build the measure-picker pill: Average point score (real), Grade 4+ rate (build real per above), Grade bands/Grade counts greyed "Coming soon".
- Build "From:"/"Trend line" on Trend and "Since:" on % change, all deriving their year range from real data — no hardcoded years.
- Rebuild Current's default view as horizontal-bar-with-national-marker (extend `ViewChart.tsx`'s bar style, add the marker). Second icon: sortable 3-column table (Subject / Result / vs National), click-to-sort with direction flip, summary sentence independent of sort order.
- Verify against a real school with more than one qualification type present (GCSE + BTEC/OCR) and a real school whose Grade 4+ history is genuinely short (2023/24 on) to confirm the From: control doesn't imply years that don't exist.
- tsc/eslint/build clean → push.

### 3. Context — combined picker, per-instance measure (brief §4.2)

- Make Context's measure a genuine per-instance choice (Candidates / Results, same sub-measures as §2) rather than the current fixed `entries`-only `COLUMN_MEASURE`. Everything else in this column depends on this being real.
- Build the single combined dropdown (3 compare-against options, not 5), the subject-chip row shared between Current and Trend, the three-way Current icon toggle (donut disabled/greyed whenever the active measure isn't Candidates), the year control (real-years-only), Trend's two-line chart plus From:/Trend-line, and % change's per-subject bars plus one extra comparison-group bar plus Since:.
- Verify the donut's disabled state is genuinely inert (not just visually greyed) when a Results measure is active, and that switching "Compare against" while a Results measure with no obvious per-subject-in-category members is active still renders sensibly.
- tsc/eslint/build clean → push.

### 4. Comparisons, renamed from Rankings (brief §4.3)

- UI copy rename only ("Comparisons" everywhere visible; no code/module/route renames).
- Build both pills: "Compared against" (the four existing comparator sets, now one picker instead of four separate boxes) and "Measure" (flat Results/Candidates only).
- Add the Graph icon view (order: graph, map, ranking) — reuse the bar style from §2, no marker, your own school's bar bold and dark. **Reuse `RankingsMap.tsx` as-is for Map — do not rebuild it.**
- Build the "vs:" selector (Average across {set} / any one named school in the set) on Trend and % change, on **real** comparator history (wire the real per-year series through `rankSets`, per the resolved §6.4 above — not the wireframe's synthetic drift). Changing the comparator set resets the selector to "Average."
- Build From:/Trend-line/Since: here too, deriving real years the same way as §2/§3 — this also resolves the date-range inconsistency the wireframe flagged, since there's no fixed range left to disagree.
- tsc/eslint/build clean → push.

## Verification and build report

Follow brief §7's checklist. Write a full build report in the usual format — what's built, where the content/data came from, and a "simplifications made without you there to confirm" section for anything genuinely judged rather than specified. Name the real school(s) verified against, including one used specifically to check the From:/Since: real-years logic and one used for the Grade 4+ short-history case.
