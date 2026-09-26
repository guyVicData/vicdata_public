# Teacher view Post-16 Part D: England fallback dropped, Context group on exact grain: build report (v1)

Prompt: `vicdata_phase3_teacher_view_post16_partD_fallback_and_context_fix_claude_code_prompt_v1.md`. I read Part C's build report in full first. Built from `bf83826`:

| Commit | Fix |
|---|---|
| `b7ba4c5` | 1. England bucket fallback dropped |
| `1972e29` | 2. Context's group moved onto exact-grain rows |

Checks: `tsc --noEmit` and `eslint` on the touched files are clean, and `npm run build` succeeds. I computed the figures below from live data with the anon key, using the same logic as the page. Localhost is gated, so the on-screen checks are for you.

## 1. England bucket fallback dropped (`b7ba4c5`)

- **`page.tsx`, `englandValue(item, period)`:** no `fallback` parameter any more.
  - GCSE: the subject's England figure.
  - Post-16: the exact `{subject}::{qualificationType}` figure, or nothing.
  - `englandAt` and `englandFor` both call it. The focused item, the peers and the onboarding preview therefore all follow one rule.
- **Dashboard route, `englandAverages()` at KS5:**
  - It no longer fetches the per-bucket England figures. Nothing reads them any more, and this saves one national lookup per load.
  - It returns `basis: "qualification"`, with `values` keyed `{subject}::{qualificationType}`. The separate `qualificationValues` field is gone.
- **Effect:** a qualification with no England figure shows no marker. Per Part C's flag 2 that covers VRQ, AEA, EPQ, suppressed years and 2021/22 AS. The school's own figure was already empty in every such case, so no marker that sat beside a real figure disappears.

## 2. Context's group on exact-grain rows (`1972e29`)

`page.tsx`:

- **New `groupRows`.**
  - At Post-16 it is `qualificationHeadline` minus AS level and AEA rows.
  - At GCSE it is `headline`, unchanged.
  - `groupValueFor()` and the `contextMembers` list both read it.
- **Entries:** the sum of the subject's qualification rows. Each qualification is counted once, so the whole-subject `all` row can no longer double every total.
- **Points, Post-16 only:** the qualifications' average points, weighted by each one's points-eligible entries (entries × points coverage).
  - **Decision:** a plain mean would let one IB entry count as much as forty A-level ones.
  - This is the closest the data gets to the whole-subject row it replaces. DfE weights by qualification *size*, which isn't in these rows, so the two can differ slightly where sizes differ (e.g. IB Standard level vs A level).
  - GCSE is read as before.
- **Threshold (A\*–E) at Post-16:** AS and AEA grade rows are left out as well, so all three measures exclude them the same way.
- **`asOrAeaOnly` stays.** It is now only needed for the "nothing selected yet" fallback in Selected subjects, which starts from the ticked items, not the rows.

### What Context's numbers do now: please sanity-check these on a real school

"All subjects" group for 2024/25. Old = the previous code; new = this commit. I checked each new total against the school's own KS5 total minus its AS/AEA entries, and it matched exactly at all seven schools.

| School | Real KS5 entries | of which AS/AEA | Group entries total, old → new | Per-subject entries, old → new | Per-subject points, old → new |
|---|---|---|---|---|---|
| 100369 (IB + A level) | 471 | 0 | 942 → **471** | 32.5 → 16.2 | 51.6 → 52.4 |
| 102239 (heavy AS) | 1,252 | 661 | 2,480 → **591** | 88.6 → 21.1 | 38.5 → 39.6 |
| 102786 (heavy AS) | 1,145 | 595 | 2,290 → **550** | 109 → 26.2 | 38.0 → 38.7 |
| 101676 | 1,019 | 226 | 2,038 → **793** | 101.9 → 39.7 | 47.8 → 50.1 |
| 100284 (heavy AS) | 425 | 209 | 830 → **216** | 43.7 → 11.4 | 31.3 → 34.0 |
| 130448 (BTEC college) | 1,333 | 73 | 2,664 → **1,260** | 88.8 → 42.0 | 26.1 → 25.7 |
| 130432 (BTEC college) | 1,316 | 87 | 2,612 → **1,229** | 65.3 → 30.7 | 26.5 → 24.7 |

What to sanity-check before trusting it:

1. **The donut share roughly doubles everywhere,** because the total it divides by is halved. At schools with a lot of AS it goes up about four times: at 102239 the total drops from 2,480 to 591, since the doubling and the 661 AS entries both come out. A subject that showed as 2% of "All subjects" could now show as 8%. Both effects are correct, but the jump will look large to anyone who remembers the old figure.
2. **Per-subject points rise at heavy-AS schools.** AS is no longer blended into the A-level figure. At 100284, Mathematics goes from 37.9 to 43.3, Economics from 32.4 to 38.3, and Government and Politics from 36.5 to 40.0.
3. **Per-subject points can fall at mixed A-level/BTEC colleges.** The old per-subject figure was a flat mean of the `all` row and each bucket row. The new one weights by entries. At 130432, Computer Science goes from 13.1 to 7.0, Chemistry from 29.7 to 24.3, and Further Maths from 33.7 to 28.8. **These are the ones most worth checking by eye.**
4. **Ticking an AS or AEA item directly.** Its own entries are compared against a group that now contains no AS/AEA at all, so its share is a share of a total it isn't part of. C1 made the same choice for the subject list; this carries it through to the figures. **Say if you want a focused AS item to count itself into the group instead.**
5. The donut's own-subject figure and the "Selected subjects" group follow the same rules, so their numbers move the same way.

## Part C live checks, reconfirmed against the data

Re-run on live data. Only check 3 changes, because of fix 1.

1. **100369, IB HL Chemistry:** own figure 58.29 for 2024/25, and SL is 45.71, as separate bars. England: HL 43.13, SL 37.84, A level 36.24, all exact figures.
2. **100369 Sciences & Maths:** every peer with a scored qualification has an England marker, and the "England Sciences & Maths average" line is there. Unaffected by this round.
3. **% Change geography:** the table still appears for scored KS5 items. **Changed:** a focused VRQ, AEA or EPQ item now also shows **no England marker** in Results. The fallback used to draw its bucket's England average beside the empty bar.
4. **AS vs A-level Psychology:** separate England figures still exist, 2024: AS 24.13, A level 33.39.
5. **AEA** still sits under Other in the picker. Unaffected.
6. **GCSE Gujarati 2023 / Persian Language 2021, 2024:** the England marker is still present. Unaffected.
7. **New, Context at 100369, Post-16, "All subjects", entries:** the group total for 2024/25 is 471 (it was 942), so each subject's share of it doubles.

## Open decisions for Guy

1. Should a focused AS/AEA item count itself into Context's group (item 4 above)? As built, it doesn't.
2. The points weighting uses points-eligible entries, not DfE's size weighting (item 3 above). Size-weighting would need `points_size_units` on the headline RPC, a vicdata change. Only worth doing if the 130432-style moves look wrong to you.
