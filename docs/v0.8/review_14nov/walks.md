# Walk-throughs review (main @ a648be5), read-only

Method: read walks.ts, teacher-screens.ts, teacher-model.ts, group-answers.ts, walks-check.ts, axis.ts,
components/front-door/{WalkPage,charts,role-walks}.tsx; ran the Teacher screen builders on three fixture
variants (base Geography; "Physics, 1 pupil, school St Thomas's"; "KS5 Further Mathematics, falling, 2020/21-2021/22
gap, no LA") — scratchpad/review/teach.ts — and every head office answer on the Harris and Dukes fixtures
(scratchpad/review/g2.tsx). Looked at every walk PNG in front_door_crosscheck/after, front_door_1/2 390 shots,
followup_13nov group shots.

Severity: **S1** wrong figure or broken text a user will see; **S2** misleading/ungrammatical in a common case;
**S3** edge case or polish.

---

## S1 — wrong or broken

1. **Admissions walk titles lose their placeholders and read as fragments.** `role-walks.tsx:56-61` (`titleOf`)
   fills only `entry`, `entry-year`, `set`, then deletes any other `[...]`. The catalogue titles
   (`src/catalogue/admissions.ts:207-226`) use `[feeder-age]`, `[la]`, `[rivals]`, `[entry-age]`. Real output:
   - DV-ADM-P-MAP: "Your feeders, sized by pupils aged, coloured by trend"
   - DV-ADM-P-POOL-INDEXED: "-year-olds: your feeders, and England"
   - DV-ADM-M-NOW: "Your place among the, at 11+"
   - DV-ADM-M-BARS: "-year-olds by school, ranked, with where each sits in regional and national results rankings"
   - DV-ADM-M-MAP: "Your rivals, sized by pupils aged"
   Fix: pass `feeder-age` (entry age − 1, from `entryPoint(entry)`), `entry-age`, `la` (pipeline's LA name),
   `rivals` ("rivals" / the set name) in `AdmissionsWalk`; and make `titleOf` fail loudly (fall back to the
   view's `label`) when any placeholder is left, instead of stripping it.

2. **Admissions walk header shows "your entry point".** `WalkPage.tsx:68` fills the header question with
   `{ subject: chip.split(" · ")[0] }` only; the admissions question is "How many children could join us at
   [entry]?", so `fillTemplate` substitutes the fallback: header reads "How many children could join us at your
   entry point?" while the chip says "Admissions · 11+". Fix: pass `ctx` into `WalkFrame`/`WalkHeader`
   (`{ entry: label }` from AdmissionsWalk), not a string re-parsed from the chip.

3. **Indexed "nearby and nationally" lines are not 100 at the year the caption says.**
   `teacher-screens.ts:194-198,220,226`: lines are divided by their value at `shared` (first year *every* line
   has a figure), but the chart starts at `from` (first year *any* line has one) and the caption/notes say
   "Every line starts at 100 in {years[0]}" and "Entries, indexed ({years[0]} = 100)". Visible in
   `front_door_crosscheck/after/walk_many_6.png`: The Chase sits at ~98 in 2020/21 and every line crosses 100
   at 2021/22, under "Entries, indexed (2020/21 = 100)". The "Partly: … moved to N (from 100)" answer is wrong
   the same way. Fix: `cut` from `shared` (start the chart at the base year), or label with
   `periodLabel(m.periods[shared])`.

4. **SMT Pupils "largest year group" is always the youngest.** `role-walks.tsx:217` sorts on `.count`, but
   `YearGroup` (`src/lib/smt/pupils.ts:35`) has `total`; every key is 0, the sort is a no-op and the first year
   group is named ("Its largest year group is Year 7" / "Reception"). Fix: sort on `total`, drop the casts.

5. **"Has our position changed?" misreads a missing latest year.** `teacher-screens.ts:334`: when the
   school has no points in the latest year `rs[last]` is null; `null < r[0]` is true, so the answer says
   "Up", then prints the last *real* place against the latest year's label (e.g. "Up: 5th in 2021/22, 3rd in
   2025/26" when 3rd was 2023/24). Fix: use the last non-null index (`li`) for both the comparison and the
   year, as entries-trend does.

6. **Entries "Yes and more / No … grown more slowly" is wrong when entries fall.** `teacher-screens.ts:209-213`.
   Physics fixture (3 → 1 pupils, index 33): "No: Physics entries have grown more slowly here than at the 1
   nearest schools, in St Helens and in England." It shrank 67%. Also "Yes and more" doesn't answer "Is the
   same thing happening…?" (if it grew faster here, the same thing *isn't* happening elsewhere), and the
   sentence names the LA and England even when they were filtered out of `others` (no LA → "in the LA").
   Fix: build from the values: "Geography entries here rose 18% since 2020/21 (index 118), faster than the
   10 nearest schools (101), Worcestershire (101) and England (104)." / "…fell 67%, while …". Name only the
   lines in `others`.

7. **Admissions/SMT answers that are blank or not sentences** (`role-walks.tsx`). When `p`/`m` is null,
   `DV-ADM-P-PIPELINE`, `-P-MAP`, `-P-ENTRY-LINE`, `-M-BARS`, `-M-SHARE-LINE` return `answer: ""` (an empty
   answer line under the question) and `body: null` (empty panel). Fix: one honest sentence each ("No pool is
   published for 11+ yet.") and a `none`-style body.
   `DV-ADM-P-PIPELINE` with a change appends a bare fragment after a full stop: "…from births after that. up 3%"
   (lower-case, no subject, no year, no full stop). Fix: `` ` The pool is ${pct(...)} by ${changeYear}.` ``.

## S2 — misleading or ungrammatical in common cases

8. **Static captions instead of answers** (question asked, nothing answered; no figure):
   - SMT Academic "What moved most since last year?" → "Last year to this, every line of the school's results." (`role-walks.tsx:207`)
   - "How were the grades spread?" → "The grade profile in bands, latest year." (`:199`)
   - Admissions "Is the pool growing or shrinking?" → "The pool against the LA and England, indexed to 100." (`:279`)
   - "Where are our rivals?" → "Your rivals, where they are."; "Who is gaining…?" → "Who is gaining share, and who is losing it, against their results."; "And how do our results compare?" → "How your results compare with your rivals'." (`:287-293`)
   - "Are we winning more of the pupils around us?" → "Your share of the pupils at 11+, against your rivals, year by year (Admissions' own figures)." (`:181`) — also hard-codes 11+, wrong for `smt_primary-overview` (4+).
   - "How old are they?" → "Children by single year of age, 0–15."; head office "Which subject areas lead?" on Harris → "8 subject areas against England." (strengths empty; `group-answers.ts:111-113`); "What shape is the group?" → "42,938 pupils by age in 2025/26, against 33,427 in 2019/20." (no shape; and +28% beside a like-for-like +9.8% on the roll screen, unexplained).
   Fix: compute the answer the view draws (top mover; share of top band vs set; pool change %; leader and our rank; biggest age group; largest share gain).

9. **Places without "of N"; bare "2 of 8".** `role-walks.tsx:173` "Strongest against the 10 nearest: Attainment 8, 2 of 11. 5 headlines are ranked." → "…Attainment 8, 2nd of 11. 5 headlines are ranked." (and "1 headline is ranked"). `:283,285` "23.4% of the market at 11+ joined you in 2025/26; 2 of 8." → "23.4% of the 11+ pool joined you in 2025/26, 2nd of 8 schools by share." / "2nd of 8 schools by share." `teacher-screens.ts:334` "Down: 4th in 2021/22, 5th in 2025/26." → "Down: 4th of 11 in 2021/22, 5th of 11 in 2025/26." (the "of" series already exists).

10. **Possessive on names ending in s**: `teacher-screens.ts:265,277,334` give "Physics's grades…", "Further Mathematics's grades…", "…to see Further Mathematics's place change"; `group-answers.ts:51-54` "Over 5 years Ark Schools's roll…"; `role-walks.tsx:236` "St Helens's residents aged…". Fix: a `possessive()` helper (`/s$/ → "'"`), or rephrase ("Grades in Physics", "the roll of Ark Schools").

11. **"pupil" in Post-16**: `teacher-screens.ts:77` "A small group, so a few pupils move it a lot." and `:273` "A small group: one pupil is a big share." print for KS5 (fixture: "9 students took Further Mathematics … A small group, so a few pupils move it a lot."). Use the phase noun. `charts.tsx:487` table header "Pupils" for KS5 grades too.

12. **No small-number caveat on points.** The file header promises "a figure under 10 pupils says 'only'", but points screens never do: 1-pupil Physics → "An average of 9.0 per entry … 4.0 above England", "1st of 2 subjects at the school", "9.0 average points here: the most among these schools". Fix: when entries < 10 append "(only N pupils)" to points-tiles, points-category/whole, nearby-points, nearby-rank.

13. **"the most" for points**: `teacher-screens.ts:304` "5.4 average points here: the most among these schools." → "the highest among these schools".

14. **Tense with "since"**: `teacher-screens.ts:374` "Geography grew by 22 pupils since 2021/22" → "has grown by 22 pupils since 2021/22"; "fell by 11 students since" → "has fallen by 11 students since"; "Geography is level since" → "has been level since". `group-answers.ts:51` "Over 5 years Harris Federation's roll is up 3.5%" → "Harris Federation's roll has risen 3.5% over 5 years". `role-walks.tsx:289` "Your share moved up 1.2 points since the first year." → "Your share has risen 1.2 percentage points since 2019/20." (name the year; "points" → "percentage points").

15. **2021/22 baseline without a caveat** (well walk, screen 5): after/walk_well_5.png "Down since 2021/22: from 5.5 to 4.9 average points." 2021/22 was the generous-grading year (the design's note says so); the build's answer and note don't. Fix: when the first year is 2021/22 add "2021/22 was graded more generously, so compare with care." (or start from 2022/23 as R-TREND-FROM-2223 does elsewhere).

16. **points-area answer reads as a list of labels**: `teacher-screens.ts:208` "Geography here averaged 4.9 in 2025/26: 10 nearest 4.7, Worcestershire 4.6, England 4.8." → "Geography here averaged 4.9 in 2025/26, against 4.7 at the 10 nearest schools, 4.6 in Worcestershire and 4.8 in England." Silently drops a comparator with no latest figure (fixture: nearest gone, no mention).

17. **Counts that disagree inside one walk**: head office Overview says "54 schools" (GRP-O-NOW) then "59 schools on the map" and "59 schools listed" (GRP-O-MAP / GRP-S-TABLE; Harris). Dukes 26 vs 25. Fix: say why ("59 schools on the map; 5 have no 2025/26 census roll") or count the same set.

18. **GRP-A-NOW phase hidden**: "Attainment 8: 51.0 across the group's 30 schools in 2025/26; England 47.6." Harris has 54 schools; 30 = secondaries. → "across the group's 30 secondary schools". Dukes: "England 40.2" vs Harris "England 47.6" — if this is the independent-sector England, say so.

19. **Mid-sentence lower-case / missing verbs**: `role-walks.tsx:197` SMT-A-NOW joins summary items: "Attainment 8 48.2 · Progress 8 0.12 · EBacc 25%" (no colon, no full stop; raw `${x.value}`); `:177,203` print raw `f.value` (unrounded floats; ASCII hyphen for negative P8). `:262` C-NEARBY starts with `agesWord` (lower-case "aged 4–10: up 3% …"). `pct()` (`:52`) gives "level, 0%" and "up 0%" for |v|<0.5. Fix: format via the dashboards' number formatter; `pct` → "level" under half a unit.

20. **"[n] nearest" plurals and zeros**: "The 1 nearest schools", "1 nearest schools", "the 1 nearest", "0 of them published …", "1 of the schools publish no figure" (`teacher-screens.ts:189,210,217,289-291,319`), "3 fell and 0 held steady" (`group-answers.ts:118`), "1 headlines are ranked", "1 subject areas", "1 feeder schools", "1 entries in 2024/25" (tile label, `:85` hard-codes "entries"). Fix: a `plural()` and "none" for 0; "the nearest school" for 1.

21. **Head office projection sentence**: `group-answers.ts:144` "Around 12 of 20 schools the number of children is projected to rise; around 8, to fall or hold (not a forecast)." ("Around" reads as "approximately"; "projected … not a forecast" contradicts.) → "Near 12 of the 20 schools the number of children is projected to rise; near 8 it is projected to fall or hold. (ONS-based projections, not a forecast.)"

22. **Lists without "and"**: `group-answers.ts:131` "…among them 8,388 primary, 25,922 secondary, 6,951 in the sixth form." → "…8,388 in primary, 25,922 in secondary and 6,951 in the sixth form."; `teacher-screens.ts:161` three missing years give "2019/20 and 2020/21 and 2021/22 had no published results." → Oxford-free list join.

23. **Results trend doesn't answer up or down**: `group-answers.ts:69` "Attainment 8: 51.0 in 2025/26, from 52.6 in 2021/22." and SMT `:177,203` "Attainment 8: 46.1 in 2019/20, 48.2 in 2024/25." → "Attainment 8 is down, from 52.6 in 2021/22 to 51.0 in 2025/26."

## S3 — polish

24. Questions: "Which schools are growing and shrinking?" → "Which schools are growing, and which are shrinking?"; "How many take it at each?" / "How did they do at each?" → "…at each school?"; "What has changed a lot, and stayed changed?" → "What has changed a lot, and for good?"; "How well did they do?" (walk title, no antecedent in the header) → "How well did they do in [subject]?"; post16-many screen 1 ternary is dead (`walks.ts:64` both branches the same). primary "Are we filling our Reception places?" walk has no screen that answers it (WALK_SCREENS_LEFT_OUT) — change the question.
25. Voice: Teacher/SMT answers are third person ("the school", "here"), Admissions/SMT market "you/your", questions "we/our". Pick "we/our" (matches the questions) or "the school".
26. Title capitals: "Geography Candidates: 2024/25", "Geography Results over time" (`:81,166,249`) → "Geography candidates", "Geography results over time". Group tags "Size and results · All phases" vs "all phases" elsewhere. "Schools ranked · each school against the group, Nearest in size, same type and England" — the set name's comma reads as a list; quote it.
27. Fallbacks: no category → "Other its area subjects", "its area average: 5.2", "below the its area average of" (`:108,116,132`). Use "the subject's area" / "other subjects in its area".
28. GRP-O-AGAINST "…is up 3.7%, 5 of 5 groups with a figure." → "(all 5 groups have a figure)".
29. `teacher-model.ts:155` GRADE_RANK lists "D" twice; BTEC rows sort D before D*.
30. Admissions P-MAP feeder count sums `rungSets[].schools` (`role-walks.tsx:277`); a school in two rungs' sets is counted twice. Count distinct URNs.
31. Screenshot file names are off by one step (`walk_many_4_mid_390.png` shows step 3; `walk_well_2_dark_390.png` shows step 1).

---

## Graphs

Screenshots checked: crosscheck/after walk_many_1–6, walk_well_1–6 (2,5,6 read closely), walk_nearby_1–5 (2,5), dumbbell; 390 phone: walk_many_4_mid, walk_well_2_dark, walk_nearby_1_dark; followup group_overview_2_mid_390. All drawn, keyed and on scale; dumbbells point the right way (ring = first, dot = latest, ▲/▼ match). Problems:

G1. (S1, = finding 3) indexed nearby chart: 100 is at the wrong year (walk_many_6.png).
G2. (S2) **HBars on a phone**: `charts.tsx:255` `grid-cols-[minmax(0,16rem)_1fr_3.5rem]`. Grid fills the fixed-max label track to 16rem before the 1fr track gets space, so at 390 (≈316px inside the panel) the bar track is ~0 and the row overflows. Affects nearby screens 2–3. No 390 screenshot of them exists. Fix: `sm:grid-cols-[minmax(0,16rem)_1fr_3.5rem] grid-cols-[minmax(0,8rem)_1fr_3rem]`.
G3. (S2) VBars: the bar value label sits on the dashed average line when a bar ≈ the average (walk_many_2.png: History "106" is struck through by the 108 line). Fix: print the value inside/below the bar top, or put the label on a plate background.
G4. (S2) Unpublished-year labels (`charts.tsx:150-154`) all sit at `top-1`; two adjacent gaps (2019/20, 2020/21 — the usual case) overlap: "2019/20: not published2020/21: not published". Fix: one label spanning consecutive gaps ("2019/20–2020/21: not published", as the design does).
G5. (S3) Lines: a non-focus series with a one-year segment (England/LA/nearest have no marker) draws nothing — only its end label (`:157-170,173-180`). Draw a dot for length-1 segments.
G6. (S3) Lines: end labels are `whitespace-nowrap` in a fixed 150px right gutter (`:141`); long school names ("Christopher Whitehead Language College 4.9") run past the plate and are clipped by `overflow-x-auto` (at 390 the plot itself is ~150px wide). Truncate with title, or use the key at phone width.
G7. (S3) Rank-over-time chart: y ends at the worst place observed (5th) with no "of 11"; add "of N" to the axis caption or end label.
G8. (S3) Grades `ShareAxis` (`:418-421`): when one grade holds 100% (1-pupil subject), max = 1.1 and a "110%" tick is drawn. Cap at 1.
G9. (S3) Map (390, walk_nearby_1_dark): numbers 3 and 5 collide; the list's "81 entries" wraps; the 390 shot predates the rings/distance fix, so no current phone shot. Map list says "no entries" for a missing figure (`:443`) — that means not published, not zero: "no figure".
G10. (S3) Group 390 (group_overview_2_mid_390): the side-by-side table is cut at the right (values "54", "55" half-visible; the column header shows "sc"); the picker truncates to "Nearest in size, …". The caption repeats the note line beneath it.

**No screenshot exists for**: any SMT walk (overview, academic, pupils, context, primary), either Admissions walk, any Post-16 walk, head office walks other than overview step 2 / academic 4 / pupils 2, Teacher nearby 2–4 and grades at 390, the "none" states. SMT C-MAP has no chart at all in the walk — just "The map … is on the dashboard: open it." (`role-walks.tsx:248`).

## Tables and rankings inside walks

T1. **Nearby ranking (`charts.tsx:425-448`, nearby screen 4)**: columns Rank / School / Average points / Distance. Missing: the year (only in the title), "of N" (the answer has it, the table not), **entries per school** — a 3-entry school ranks 1st on average points with nothing to show it. Add an "Entries" column and a caption "Ranked highest first on average points per entry, 2025/26; N schools with a figure; M without."
T2. **Nearby bars (hbars)**: no year on the axis caption ("Entries" / "Average points per entry"); points bars don't show entries. Add year and n.
T3. **ChartTable** (`:470-513`): vbars/hbars header is ["", "entries"] with no year; tiles table header is ["",""]; map table has no distance or year; lines table has no unit; grades header "Pupils" for KS5.
T4. **Map list**: "63 entries" with no year; "no entries" for unpublished.
T5. **Group Schools ranked (GRP-A-RANKED)**: answer names the leader but not its figure or our spread; the 390 side-by-side hides the figures (G10).
T6. Admissions M-BARS / ACAD-RANK: answers are static or blank (finding 7–8), so rank X of N lives only in the chart.
