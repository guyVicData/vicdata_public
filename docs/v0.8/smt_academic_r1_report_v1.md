# VicData 0.8: SMT Academic by qualification, round 1 report (v1)

Built from `docs/v0.8/smt_academic_claude_code_prompt_v1.md` and the plan `docs/v0.8/smt_value_added_plan_v1.md`, with the boards in `docs/wireframes/smt-value-added/`. Covers feedback F-44 and F-45. Branch `feat/smt-academic-modes`, not merged. Two parts were built alongside on their own branches and merged in: the pills and Pupils' new views (`feat/smt-no-pills`), and the XS–XL sizes (`feat/smt-entry-size`).

**Before the demo, three things are Guy's.** Each is listed in "What Guy runs" below.
1. Check the value-added subject matches.
2. Apply the size table and run its sync.
3. Re-seed the SMT dashboards. The live store still holds the old Academic and Pupils configs.

## What changed

### Step 0: value-added subject matches (a draft, not applied)
- **The draft.** `docs/v0.8/va_subject_matches_draft.md` matches all 368 value-added (qualification, subject) names, across every qualification and both years, to the results file's names. The 46 that need a look are listed first:
  - VicData's own name matches, such as "Art & Design (Fine Art)" → "Fine Art" and "Computer Studies/Computing" → "Computer Science";
  - the EPQ and the IB's whole-diploma and core rows, which sit outside the subject areas.
- **How it's built.** The list comes from `docs/v0.8/smt_academic_scripts/va_subject_matches.py`, a read-only export of vicdata-production. The same script writes `src/lib/smt/va-subject-matches.ts`, which the app reads, so the approved list is a data change only.
- **Today's gap.** 17 of 60 A-level value-added subjects get no area, covering 8,625 of 37,837 school-subject rows (23%). Across all qualifications, 84 of 368 names get none. With the list, every name has an area or an "outside" mark.
- **The live bug.** Choosing a Post-16 area silently dropped value-added subjects. That bug goes with the old view: the new by-area view places every row.

### The pills come off (from `feat/smt-no-pills`)
- **Removed.** Both pills are gone from every SMT dashboard. So are `SmtFilters`, `DEFAULT_SMT_FILTERS`, `pillsFor` and all the filter threading.
- **Girls and boys** (`DV-SMT-P-GIRLS-BOYS`, mixed schools only):
  - girls' share by year group against the middle of the set's mixed schools;
  - its change since 2019/20;
  - where it shifts: Year 7 against Years 8–11, and the sixth form against Years 7–11.
- **Day and boarding** (`DV-SMT-P-DAY-BOARDING`, boarding schools only): boarders' share each census year, against the middle of the set's boarding schools. The census has no boarders by phase, so it is the whole roll, and the (i) says so.
- **The three pill bugs are gone.**
  - The Scorecard's roll row is the whole roll, ranked on the whole roll.
  - There's no sex filter left to drop under "Boarding only".
  - Single-sex set schools are left out of the girls' share rather than counted as 0. At Acland Burghley the set's middle is 44.0% over 6 mixed schools; counting the 4 single-sex schools as 0 would have given 24.1%.
- **Unchanged.** "The school now" keeps its tiles; Admissions keeps `ADM_SEX_FILTER`.

### Academic: the shell
- **Level chips** are GCSE and Post-16 only. An old `?level=whole` falls back to the school's main level.
- **Row 2** holds the **Results · Entries · Value added** switch, then:
  - at Post-16, the qualification groups the school offers: All, A level, Applied, EPQ, Core Maths, AS, IB, T level;
  - at GCSE, the area chips;
  - at GCSE in Value added, the line "Subject areas don't apply: DfE publishes no GCSE value added by subject".
- **The state lives in the address:** `?level=&mode=&group=&applied=&area=`. It is remembered per user (`src/components/smt/useAcademicState.ts`), parsed in `src/lib/smt/qual-groups.ts:parseAcademic`, and resolved by the route.
- **Applied** uses DfE's two headline types, Applied general and Tech level. Each gets a column-1 line, and a two-chip switch sits above the chart, table and map.
- **Comparison sets** (`src/lib/smt/academic-sets.ts`):
  - each group's default is the 10 nearest offering it, using Teacher's `findSurroundingSchools` (relaxed gender rule) plus an "offers it" filter;
  - each applied type has its own set;
  - a chosen set holds across groups, and the views say how many of it offer the group;
  - the pill names the set ("10 nearest offering IB"; "10 nearest offering each qualification" under All).
- **Independent and IGCSE schools at GCSE** compare with the 10 nearest state schools with Progress 8. This uses a new default-off `stateOnly` option on `findSurroundingSchools`. A set with no state schools gets the message in the middle of every view.
- **Layout.**
  - Large view: chart, ranking table, map, subject areas, grade profile.
  - Row 2: the trend against the set's middle half; every line's change, or Entries' biggest moves; the entries mix, "against the set", or Value added's set's schools.
- **Retired views.** Academic's old value-added, subjects and "results by band" views are gone, and so is the 14-row cut. Notes live in the (i), never in footer lines.

### Results, Entries, Value added (`src/lib/smt/academic.ts`, `src/components/smt/views/Academic.tsx`)
- **Results:**
  - **Column 1:** points per entry with DfE's grade, or VicData's IB, T level, Core Maths and AS points. The EPQ line says VicData holds no EPQ points.
  - **Chart and map:** each school coloured by its quarter in the set, with the set's median marked.
  - **Subject areas:** each subject ranked only against the same subject in the same qualification.
  - **Grade profile:** each qualification on its own scale, with its top-grade share.
- **Entries:**
  - **The measure:** each group's share of the level's entries, always with the count beside it.
  - **Subject areas:** three years of entries, XS–XL against England, share against the set's typical school, and how many of the set offer it.
  - **Row 2:** biggest moves, the entries mix, and where the mix differs most from the set.
- **Value added:**
  - **Bands:** DfE's own band where DfE publishes one; Progress 8's five bands derived exactly from DfE's definition; VicData's three from the 95% range everywhere else.
  - **Chart:** a dot and its 95% range, a line at 0, the axis fitted to the data, and England's place on a strip.
  - **Ranking table:** place in the set, region and England, and "n clearly above / below".
  - **Map:** coloured by band.
  - **Subject areas:** the set's schools as dots, with † for VicData's matches.
- **Years** come from years.ts and the data only. Rehearsing a synthetic Post-16 2025/26 (`scripts/year-rehearsal/install-ks5-2025.ts` + `smt-academic-rehearsal-check.mts`): every mode's trend runs to 2025/26 with no code change (Results 2022–2025, Entries 2023–2025, Value added 2023–2025).

## What's new data, and what's an existing read
| Read | New? | Notes |
|---|---|---|
| The KS5 headline snapshot (`population("ks5")`) | existing, widened | Now also keeps Academic, Applied general, Tech level and Technical certificate points with their grade, value added and band, plus VicData's `bucket:*` points and entries. One national read an hour, as before. |
| Subject × qualification rollup (`academic_subject_qualification_headline_lookup`) | existing RPC, new use | Post-16 subjects, groups, entries and the "offers it" filter. Cached per school set. |
| GCSE subject rollup (`academic_subject_headline_lookup`) | existing | GCSE subjects; the qualification rollup is Post-16 only. |
| Subject value added (`dfe_ks5_subject_value_added`) | existing source | Read for the school and its set only, cached. |
| **England's value added for one qualification** (that qualification's "All subjects" row, every school, one year) | **new** | England places for EPQ, Core Maths, AS and IB value added. Read once an hour per qualification and year. |
| **`subject_entry_size_fifths`** (app database) | **new table + sync** | XS–XL cut points per stage, qualification, subject and year. Written by `scripts/sync-subject-entry-size-fifths.ts`, read by `src/lib/subject-entry-size.ts`, never computed per request. |
| GIAS gender for set schools (Pupils) | new cached read | Mixed or single-sex, for Girls and boys. |

No per-request scans of `canonical_facts`. Timing for Plumstead Manor in one process: the first build is 2.5 s (cold); the same state again is 17 ms; other modes and groups 9–10 ms once the sets are cached; GCSE cold 1.2 s.

## Real-data checks
All are 2024/25 for Post-16 and 2023/24 for Progress 8. The sets are the build's own, by Teacher's rule.

- **Leighton Park (110110):** independent, IGCSE, main level Post-16. Offers A level, Applied (both types), EPQ and AS.
  - A level Results: **39.95, grade B, 7th of 11**; set median 41.6; England 424th of 2,536. The board's 39.95 and B match, as do the set's figures (Wellington 46.4 … Shiplake 35.0).
  - A level Value added: **+0.09 (−0.06 to +0.24), Average, 8th of 11, England 813th of 2,553**, exactly the board's.
  - EPQ: −0.48, In line. Applied general +0.19, Tech level −0.17.
  - Results' EPQ line: "VicData doesn't hold EPQ points yet".
  - Entries mix: 188 / 233 / 213 / 238 entries; "entered the IB in 2021/22 (62), 2022/23 (49) and 2023/24 (20), and none in 2024/25."
  - GCSE Value added: the 10 nearest state schools with Progress 8, within 5.3 km; middle half −0.13 to +0.51; 3 clearly above, 2 clearly below; Kendrick +1.07 highest. Leighton Park's own row and column 1 say why it has none.
  - The board showed nearer 11–16 schools (John Madejski Academy, Hamilton School). Teacher's phase rule matches 11–18 with 11–18, so they aren't in the set (OPEN_QUESTIONS A7).
- **Acland Burghley (100053):**
  - Post-16 Value added: A level −0.05, Applied general +0.07, Tech level +0.40, EPQ +0.06 (In line), **Core Maths +0.80 (+0.02 to +1.58), Clearly above**. These are the board's figures.
  - By subject area: A-level Mathematics 23 entries −0.14 (8th of 11); BTEC Diploma Applied Science 21, +0.43 (1st of 4); Art and Design marked †; the EPQ outside the areas.
  - GCSE: Progress 8 −0.30 (−0.51 to −0.09), Below average, England 2,348th of 3,663, 9th of 9 in the set. Attainment 8 2025/26 55.2, 4th of 10.
- **Sevenoaks (118952):** IB only, so there's no All chip. IB value added **+0.57 (+0.46 to +0.67), Clearly above, 1st of 8, England 2nd of 53**. The default set is 10 IB schools reaching 46 km (the board's straight-distance set reached 59 km).
- **Plumstead Manor (100183):**
  - Offers All, A level, Applied (Applied general and Tech level), EPQ, Core Maths and AS.
  - Results: Applied general 33.1 (Dist−), 4th of 11; Tech level 33.9 (Dist), 6th of 11.
  - Value added: Tech level +0.09, 4th of 11, England 298th of 627.
  - Entries: 419 Post-16 entries; A level 229 (54.7%; the set's typical school 73.6%); Applied 171 (40.8%); biggest move VRQ Finance 44 → 78.
  - A-level Psychology 23 entries is XS–XL **M** in the size sync's dry run.

## Rules and tests
- **New rules, each with a runner:**
  - R-SMT-NO-PILLS
  - R-SMT-ACADEMIC-MODES
  - R-SMT-QUAL-GROUPS
  - R-SMT-GROUP-SETS
  - R-SMT-COL1-LEVEL
  - R-SMT-VA-BANDS
  - R-SMT-VA-INDEPENDENT
  - R-SMT-ENTRIES-SIZE (MANUAL until the table is applied)
  - R-VA-SUBJECT-MATCH (passes; reports "draft")
- **Rewritten:** R-SMT-VIEW-ACADEMIC-NOW, -VIEW-AREAS, -VIEW-MIX, -VA-HONEST, -SMALL-ENTRIES, -SET-RANKS, -P8-REASON and -BOARDING-ONLY.
- **Superseded** by R-SMT-ACADEMIC-MODES: R-SMT-VIEW-SUBJECTS and R-SMT-VIEW-RESERVED.
- **Results:**
  - **Full rule suite on real data:** PASS=153, FAIL=1, ERROR=0, MANUAL=16, NONE=19, SUPERSEDED=8. The one fail was R-FEATURED-ROW-EVERYWHERE: the new ranking table tinted the school's row with its own colour. It now uses `featuredRow()` and the shared token, and its rerun passes (marked=18, unlisted=none). MANUAL includes R-SMT-ENTRIES-SIZE until the table is applied.
  - Catalogue unit tests: 77 pass, 0 fail.
  - `src/lib/smt/*.test.ts` and `subject-entry-size.test.ts`: 48 pass, 0 fail. This includes the bands at every edge and the address parsing.
  - PGlite for the size table: 18 pass.
- **Checks:** `tsc` (apart from the pre-existing `LayoutProps` until `next typegen`), eslint and `next build` are clean.

## Parity
The check is a server render of the same views by `main` (0f512e5) and this branch, on the same live data. The scripts are in the scratchpad, not committed.
- **Teacher and Admissions:**
  - The only shared code changed is `ControlBar`, whose new row-2 fields are optional, and `surrounding-schools.ts`, whose `stateOnly` is off by default.
  - The control bar rendered with Teacher's props and with Admissions' props is **byte-identical** on both trees.
- **Overview, Pupils, Context** for The Chase, Leighton Park and Acland Burghley:
  - **84 of 86 view renders are byte-identical.**
  - The 2 differences are the day schools' "Your pupils now" sentence, which no longer mentions a filter ("…has no boarders, so the tile doesn't appear").
  - The only other difference: the two new Pupils views exist only on this branch.
- **Not checked:** pixel parity of the live pages (they're behind sign-in). Live checks are below.

## Screenshots
`docs/v0.8/smt_academic_r1_screenshots/`: each board's counterpart drawn by the real components from real data (a local harness, headless Chromium).
- **Every board at 1440, dark:** Main, LP-GCSE, LP-NoState, AB-Areas, AB-GCSE-Map, SV-IB, PM-Option1, AC-LP-Chart, AC-PM-Table, AC-PM-Areas, AC-SV-Map, AC-PM-Entries.
- **Light at 1440:** Main, AC-PM-Entries, LP-GCSE.
- **At 1280:** AC-LP-Chart (dark), AB-Areas (light).
- **Phone at 390:** Main and AC-PM-Entries, dark.
- **Pupils' two new views:** 1440 dark, 390 light.
- **No horizontal scroll at any width.** The subject-areas table scrolls inside its panel on a phone.
- **Where they differ from the boards** (all logged):
  - Value added's trends row has three panels, not the Main board's two (A8).
  - An applied line reads "DfE headline type" where the board named BTEC or OCR by hand (A6).
  - The board's 2025/26 "due mid-Nov" placeholder isn't drawn: the year appears when DfE publishes it.

## Decisions and open points
`docs/OPEN_QUESTIONS.md`: "0.8 SMT Academic by qualification" (A1–A11), plus the Pupils entries from the pills branch. In short:
- A1, the subject list to check;
- A2, EPQ points are a data gap;
- A3, T level has no grade equivalent;
- A4, a set per applied type;
- A5, column 1 ranks in the set in force;
- A6, applied lines can't name their qualification;
- A7, the independent school's Progress 8 set keeps Teacher's phase rule;
- A8, three trends panels;
- A9, GCSE subjects come from the subject rollup;
- A10, the sizes need their table;
- A11, the entries mix's "A level" includes AS.

## What Guy runs (in this order; nothing here has been run)
1. **Check the subject list.** Approved means: `src/lib/smt/va-subject-matches.ts` regenerated with any corrections and `VA_SUBJECT_MATCHES_STATUS = "approved"`.
2. **Merge** `feat/smt-academic-modes` into `main` (after review).
3. **The size table** (migration `20261122090000`), then the sync. This needs `SUPABASE_SERVICE_ROLE_KEY` in the environment:
   ```sh
   cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261122090000_v08_subject_entry_size_fifths.sql && supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('20261122090000', 'v08_subject_entry_size_fifths') on conflict (version) do nothing"
   npx tsx --env-file=.env --env-file=.env.local scripts/sync-subject-entry-size-fifths.ts --dry-run
   npx tsx --env-file=.env --env-file=.env.local scripts/sync-subject-entry-size-fifths.ts
   npx -y tsx --env-file=.env.local --env-file=.env scripts/catalogue-rule-tests.ts R-SMT-ENTRIES-SIZE
   ```
   When Post-16 2025/26 lands, rerun the sync with `--stage ks5`.
4. **Re-seed the SMT dashboards.** Academic's and Pupils' configs changed; Overview's and Context's didn't, so only those two get new versions:
   ```sh
   cd ~/dev/vicdata_public && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/vicdata_seed.sql && supabase db query --linked -f /tmp/vicdata_seed.sql
   ```

## Live checks for Guy (signed in, peek or View as)
- **Leighton Park:** `/teacher/smt/academic?lookAs=110110&as=smt&peek=1`
  - opens on Post-16, A level;
  - switch the three modes, the groups and All;
  - choose GCSE then Value added: the state schools appear.
- **Sevenoaks** (`lookAs=118952`): the IB-only chip, and the set pill reads "10 nearest offering IB".
- **Plumstead Manor** (`lookAs=100183`): Applied shows the Applied general / Tech level switch above the chart, table and map; in Entries mode, XS–XL appears once step 3 has run.
- **Pupils** (`/teacher/smt/pupils?lookAs=110110&as=smt&peek=1`): Girls and boys and Day and boarding are in the rail. At Parliament Hill (`lookAs=100050`) there's no Girls and boys icon.
- **No pills** on Overview, Academic or Pupils. Both themes, 1440, 1280, and a phone.
