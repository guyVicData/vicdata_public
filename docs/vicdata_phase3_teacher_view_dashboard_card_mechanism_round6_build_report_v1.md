# Teacher view — dashboard card mechanism, Round 6 — build report

Covers `vicdata_phase3_teacher_view_dashboard_card_mechanism_round6_brief_v1.md` and its companion prompt, both as updated 2026-09-23 with every §6 decision resolved. Built against the four Design-canvas boards (`Main.dc.html`, `Results.dc.html`, `Context.dc.html`, `Rankings.dc.html`), read directly from the artifact rather than worked from the brief's description of them.

Five commits, one per section plus a rendering fix, each `tsc --noEmit` / `eslint` / production-build clean before the next began, and each pushed as it landed per this round's one-off push authorisation.

| | commit |
|---|---|
| §3 cross-column panel mechanism + Candidates | `4a18c05` |
| §4.1 Results measure switcher + Grade 4+ | `e81dec4` |
| §4.2 Context combined picker + per-instance measure | `eeaf009` |
| §4.3 Comparisons pills, Graph, "vs:" selector | `4bc8504` |
| Trend chart axis fix | `9d06717` |

---

## Before any code: what the re-check found

Brief §1's first lesson is not to trust §2 by the time someone builds. Re-checked directly:

**§2 was accurate.** `ColumnBuilder.tsx`, `CardBox.tsx`, `teacher-view-catalogue.ts`'s `AXES`/`COLUMN_MEASURE`, `teacher-view-rankings.ts` and `RankingsMap.tsx` all looked exactly as described. The "Current" box really was rendered unconditionally outside the pinned array in all four columns; Results really did have one measure; Context's measure really was fixed to `entries`; all four comparator sets and the map really were finished work.

**One gap the brief did not anticipate, raised and resolved as §6.6.** The wireframe's Add menu offers three things; the shipped Add menu offers the five `AXES` per ticked subject. Nothing in the brief said what happens to the latter. Guy resolved it: replace, not keep alongside.

### CONFIRM-FIRST results

**§4.1, Grade 4+ data — it already exists, and was already in the payload.** Real per-subject, per-grade counts come from `dfe_ks4_subject_entries` raw facts via `parseSubjectGradeDistribution`, and the teacher dashboard route has been returning them as `subjectData.gradeDistribution` all along. `page.tsx` read `subjectData.entries` and discarded the rest. No grade-boundary source was needed and no ingestion work was required. Two real limits, both built around rather than papered over — see §4.1 below.

**§4.3, comparator-school history — also already there, also already discarded.** `fetchAcademicProfiles` returns every school's full `AcademicHeadlineYear[]`, ascending by period. `rankSets` collapsed each school to `latestMeasureAt(...)` and dropped the rest. So the answer to §6.4 was (a) real data, and the work was ~15 lines in the route rather than new plumbing or the wireframe's caveated synthetic history. The wireframe's `genSeries()` drift is not used anywhere.

**§6.3, the date range — neither figure was ever real.** Both 2018/19 and 2019/20 were hardcoded constants in the boards' mock `YEARS` arrays. Resolved by deriving every range from data, which is also why the inconsistency cannot come back.

---

## §3 — Any panel removable, minimum of one

`ColumnBuilder` is replaced by `ColumnPanels`. A column is now up to three peers — Current, Trend, % change — rendered in a fixed order whatever order they were added in.

- **The floor is a disabled control, not a hidden one**, per §3's own wording. It is a real `disabled` button, so it is inert to the keyboard as well as the mouse, and its `aria-label` says why ("a card always keeps at least one").
- **Add offers exactly what is missing** and disappears when all three are showing.
- **Persistence reuses the existing `columns` JSON.** The default set (Current alone) is the key being *absent* — the same shape `resetColumn` already used for "never customised", so the two cannot drift into two states. Anything saved that is not a panel id is ignored, and an empty result falls back to the default, so a column can never come back from the database with nothing on it.
- **Settings live alongside**, under prefixes that cannot collide with a column id (`measure:`, `against:`, `chosen:`, `set:`). No schema change.
- **No migration**, per §6.10.

`ColumnBuilder.tsx` is deleted rather than left dormant, per the prompt's explicit instruction. The `AXES` catalogue itself stays — the meetings slide picker still renders axis views from it — so this removed the dashboard's axis *menu*, not the axis *machinery*.

**Candidates is built in full here**, since §3 is its section: Current as bars or a ranked list, Trend as one focused line with the chip row, % change as every taught subject side by side with no selector.

## §4.1 — Results

Measure pill, real Grade 4+, and the rebuilt Current.

- **Current** is now the horizontal bar with a national-average marker. Built by extending `ViewChart` with a `row` layout rather than writing a second bar component, per the brief's "extend, don't parallel". The marker is genuinely new — no bar in Teacher view carried one before — and the bar scale covers the markers as well as the values, or a benchmark above every bar would sit off the end of its own track.
- **Second view** is the sortable 3-column table. Per §5, the summary sentence is computed from the *unsorted* rows, so reordering the table never rewrites the sentence under it. Nulls sort last in both directions — "no published figure" is not the smallest value.
- **Grade 4+ is real end to end.** 9–4 over every graded entry, from the rows described above.

Three things the real data forced:

1. **It only goes back to 2023/24**, a documented limit of the parser. Switching to it therefore *shortens* the axis rather than drawing empty years, the From:/Since: controls offer only the years that exist, and the card says so in a line under the figure.
2. **Double awards ("54", "43") count only when both digits are ≥4** — §6.5's strict reading.
3. **Vocational scales have no grade 4.** They return no figure rather than a zero. See "judged, not specified" below.

At Post-16 the equivalent question is the **A\*–E rate**, off the same rows. The IB component scale is also 7–1, so it would read as GCSE numerics; the phase decides which bar applies, and an IB row at Post-16 is not scored against a GCSE bar it was never on.

The threshold measure has no published England figure to sit against — the national anchor this app holds is points per entry, per subject. So its bars carry no marker and the table's third column falls back to the subject's own previous published year, which is a real comparison rather than a column of dashes.

**Grade-scale knowledge moved** out of `SubjectDeepDiveDrawer` into `src/lib/subject-grades.ts`, read by both. Two copies of "which scale is this subject on" would be two things to get wrong the first time DfE adds a band — which is what that code's own comment was written about.

## §4.2 — Context

**The architecture gap is closed.** Context's measure was fixed by `COLUMN_MEASURE.context = entries`, a per-*column* constant. The column now reads a per-*instance* choice, so the same card can be pointed at Candidates or either real Results measure. `COLUMN_MEASURE` stays where it is for the meetings slide picker; the dashboard no longer depends on it.

**One combined dropdown, not two pills** — Guy's explicit choice, and a deliberate difference from Comparisons. Worth stating because it looks like an inconsistency: Context's two dimensions are read as one sentence ("Geography against Humanities, on candidates"), so they are chosen together; Comparisons' are independent. Three compare-against options per §6.1, groups self-inclusive.

**The wireframe needed a fudge here and real data does not.** Its caption flags that it divided a flat school-wide figure by an assumed 24 subjects to get a plausible per-subject line. Real per-subject rows exist, so instead there are two genuinely different group figures, used for different things:

- the **total**, which the donut's share is a share of;
- the **per-subject average**, which is what a single subject is actually comparable with — so it is what the bar marker, Trend's dashed second line and the % change group bar all use.

**The donut is genuinely inert** for a Results measure, not just greyed — a real disabled button — and an already-selected donut falls back to bars on a measure switch rather than drawing a share of an average point score.

**Current's year prev/next** steps only through years the active measure really has. A year chosen there that the new measure lacks falls back rather than blanking the card.

**The focused chip is lifted to the page** so the picker's "Other subjects in …" row is labelled from the focused subject's own real family — the two controls cannot describe different groups.

Group members are addressed by **subject name**, not by the ticked list's (subject, qualification) key, because they are whole-school subjects. For the threshold measure the rate is computed per qualification type and then averaged: pooling a subject's grade rows would put a GCSE 9–1 row beside a vocational Pass and score them against a bar only one of them is on.

## §4.3 — Comparisons

**Renamed in UI copy only** (§6.2). `teacher-view-rankings.ts`, the `rankings` ColumnId, the `rank_*` view ids and the `<phase>:rankings` note key are untouched — nothing persisted changes.

**Two pills** (§6.7). "Compared against" folds in the four real comparator sets, which were four separate pinnable boxes competing for one of three panel slots. "Measure" is the flat Results/Candidates pair only — comparator data is whole-school headline, not per-subject, so a Grade 4+ option here would have nothing behind it and is left off rather than shown broken.

**Current gains Graph**, in the wireframe's order (graph, map, ranking) with Ranking still the default. Graph reuses §4.1's bar row with no marker — the other bars *are* the comparison — and your own school reads bold in the foreground colour. Ranking is the shared `SortTable`. **The Map is `RankingsMap`, reused as-is**; §4.3 says do not rebuild it, and it is not rebuilt.

**The "vs:" selector is genuinely new**, as §1's lesson 2 warned. One `versus` shared by Trend and % change, each with its own popover; changing the comparator set resets it to Average, since the school it pointed at may not be in the new set.

**On real comparator history:** a school excluded from the ranking (an IGCSE-heavy independent at GCSE) is excluded from the trend too — its Attainment 8 is not comparable in any year, not just the latest, so plotting its line would contradict the ranking beside it. The set's average is taken per period over the schools that genuinely have a figure that year, so a school entering or leaving the published data does not read as the whole set moving. The series are keyed by urn **once** for the union of every set rather than inlined per set: the four sets overlap heavily, so inlining would send the same history three or four times.

---

## Simplifications and judgement calls made without you there to confirm

1. **Vocational subjects show no figure under the threshold measure.** A BTEC's Distinction/Merit/Pass has no grade 4 and no A\*–E. DfE *does* publish equivalences (Level 2 Pass is widely treated as a standard pass), but applying one would be this repo inventing a mapping rather than reading a published figure — so the measure says "no figure", which is true. **This is the one I'd most like you to look at**, because a teacher of a single BTEC subject sees an empty card when they switch measure. If you want the equivalence, it is a small change in `subject-grades.ts`.

2. **What persists and what does not.** Saved: the panel set, and every "which data" choice (measure, compare-against, selected subjects, comparator set). Not saved: view-shape toggles (bar/table/donut/graph/map), sort column and direction, focused chip, From:/Since: span, the trend-line toggle. The line I drew is that coming back to a card showing a *different number* is disorienting in a way that coming back to the same number drawn as bars rather than a table is not. The brief only required the panel set to round-trip.

3. **Context's "Selected subjects" falls back to the subjects you teach** when nothing is ticked yet, rather than to the whole school. The wireframe falls back to its own four mock subjects, which is ambiguous between the two readings.

4. **The panel tag pill uses the phase accent tint, not the wireframe's teal.** The boards are light-mode-only in stone and teal; this app themes per phase (KS4 green, KS5 purple) and has a dark mode that §7 requires be covered by the existing CSS subtree. A hardcoded teal pill would clash with the KS5 accent and read badly in dark. Same reasoning for the summary strip (`--box-bg`) and every axis colour. **This is the main place the build is deliberately not pixel-identical to the wireframe.**

5. **Comparisons' Trend group line uses the set average or one named school**, and its % change shows two bars. That is the wireframe. But the ranking's own `igcseExcluded` schools are dropped from the average, which the wireframe had no concept of.

6. **`SharePie` and `RankedSet` are deleted.** Both became unreferenced. Context's share figure returns as the donut (a different, better-targeted figure); Comparisons' ranked list returns as the sortable Ranking view, which is what the wireframe draws. Context's old "your subjects are X% of N entries" caption is gone — the donut states the same relationship, against a chosen group rather than always the whole school.

7. **KS2 is left exactly as it was** (§6.9). Its three subject columns keep their round-5 single boxes; Comparisons uses the new panel component, which degrades to position + map with no chips. Nothing KS2-specific was added or removed.

8. **`defaultBoxTitle("rankings")` is now dead** but retained, because the `ColumnId` union requires the case.

---

## Verification

**Checks:** `tsc --noEmit` clean. `eslint` at exactly its pre-existing baseline — 5 errors and 2 warnings, all in `SchoolSearch.tsx`, `account/page.tsx`, `PeerTrendChart.tsx` and `SchoolMap.tsx`, none touched this round (confirmed by stashing and re-running). Production build passes.

**Logic verified directly against expected values**, not just compiled:

- *Panel mechanism* — default when unsaved, junk ignored, canonical order, add idempotent, remove down to one, **zero panels unreachable**, last panel not removable.
- *Real year ranges (§6.3)* — leading gaps skipped, the last period never offered as a start, single-period ranges offering none, cycling wrapping, slices trimming values and periods together.
- *Arithmetic* — endpoints skipping nulls, one real value not counting as a range, percent change, no divide-by-zero, the ±4% flat band, least squares ignoring gaps, entries summing while scores mean.
- *Threshold measure (§6.5)* — the 9–4 bar, the **strict** double-award rule, A\*–E at Post-16, suppression excluded from both numerator and denominator, vocational and IB returning null rather than a number nobody published.

**One real bug found and fixed during self-review** (`9d06717`): the Trend chart's axis labels sat inside a `preserveAspectRatio="none"` SVG, so they were squashed at card width and stretched 2.75× at fullscreen. Both axes are now HTML positioned over the same coordinate space.

### Live click-testing: NOT done — blocked, and I need one thing from you

This is the outstanding item against brief §7, and it is the same wall the round-5 build report hit.

Confirmed this session, not assumed:

- `http://localhost:3000/` → **401**. `ACCESS_GATE_ENABLED=true` in `.env`, and that file says in terms: *"DO NOT flip these without Guy's explicit go-ahead"*. I have not flipped it.
- `http://localhost:3000/api/testing/preview-session?token=…` → **404**. `PREVIEW_ACCESS_ENABLED` / `PREVIEW_ACCESS_TOKEN` / `PREVIEW_ACCESS_EMAIL` are not set locally, so the route fails closed as designed.

Either of these unblocks it: send me the preview link for the deployed site, or set the three `PREVIEW_ACCESS_*` vars in `.env` locally. I have not generated a session for myself with the service-role key — that is minting auth, and it is your call, not mine.

**The checklist I will run once I can, against a named real school** (and the one I'd ask you to run meanwhile, since it is all now live):

1. **Panels** — Add/remove down to one panel and back up, in each of the four columns; reload and confirm the persisted set matches; confirm the remove control is visibly present and greyed on the last panel, and that zero panels cannot be reached.
2. **Results** — the measure switcher on both real measures; confirm Grade 4+ shortens the year range rather than padding it; confirm Grade bands and Grade counts are visible, greyed and unclickable. Needs a school with **more than one qualification type** (GCSE + BTEC/OCR) so the colour-by-qualification convention is actually exercised, and so the vocational "no figure" case above is seen rather than reasoned about.
3. **Context** — the combined picker on all three compare-against options crossed with both measures; confirm the donut is genuinely inert (keyboard too) on a Results measure and falls back to bars; the year prev/next across a measure switch.
4. **Comparisons** — the Graph view; the "vs:" selector on a named school; confirm switching comparator set resets it to Average.
5. **Themes and width** — light/dark via the existing Teacher-view toggle, and a phone-width pass on the two densest new dropdowns (Context's combined picker, Comparisons' two pills).

**Named school:** I could not name one, because I could not open one. `preview-session`'s own starter URN is **100053**, which its comment describes as a real, open school with real KS4 and KS5 data — that is the school I would start from.

**What I can say without the live check:** every figure on every new panel is computed from data the dashboard route already returned, by functions verified above against expected values. What the live check covers that this does not is the signed-in wiring, the real map inside the new Current view, and how the dense new dropdowns behave at real widths.
