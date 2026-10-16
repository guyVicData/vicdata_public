# VicData 0.8 — IGCSE schools: subject rankings for subjects taken as GCSE — report

Report for `docs/v0.8/vicdata_0_8_igcse_subject_rankings_claude_code_prompt_v1.md`. Built 16 Oct 2026 in the worktree `~/dev/vicdata_public_igcse`, on branch **`v0.8-igcse-subjects`** from `main` @ `da44856`. The ingest's part is on `~/dev/vicdata` **`feat/igcse-subject-areas`**: a dry run only, not promoted.

## The rule, as built

| Measure | IGCSE school |
|---|---|
| Whole-school GCSE measures (Attainment 8, English and maths, EBacc, Progress 8) | **Out of every ranking**, as before ("not ranked at GCSE (IGCSE)") |
| A subject group (family) across schools | **Out only where the group is incomplete at the school**; its own view labels the group |
| A single subject entered as GCSE 9–1 | **Ranked like any other school**: rankings, sets, "10 nearest", maps, Comparisons |

## The inference function, and the groups with required subjects

`src/lib/igcse-words.ts` (pure; the client and the server share it). The ingest has a line-for-line Python copy (`ingest/group_aggregates.py`).

- **`igcseTakenAsIgcse(igcse, gcseSubjects)`:**
  - for an IGCSE-flagged school, English Language and Mathematics where it has no GCSE entries in one that year;
  - never any other subject: a subject the school simply doesn't offer isn't "taken as IGCSE".
- **`igcseFamilyIncomplete(familyId, igcse, gcseSubjects)`:** a family lacking one of those, or a subject it requires.
  - Sciences & Maths needs Mathematics; Languages & Literature needs English Language.
- **Groups with required subjects: none.**
  - `subject_families` holds family id, label, SSA tier-1 areas and sort order, with no "required" column.
  - `FAMILY_REQUIRED_SUBJECTS` exists and is empty, so only those two families can be incomplete.
- **Server loaders** (`src/lib/igcse.ts`):
  - `igcseFamiliesOut()`: each IGCSE school's incomplete families by year, read hourly like the flag;
  - `igcseFamilyOut(familyId, period)`;
  - `withIgcseFamilies(profiles)`, for the data view's family map.
- **Client helper** (`src/lib/academic-data-view.ts`): `igcseOutFor(profiles, stage, { subject, familyId })`, the schools a view leaves out given what it shows.

## Where it applies

- **Teacher:**
  - **Subject rankings:** `subjectRanking` no longer removes IGCSE schools. The population count says what's included: "of 3,443 schools with GCSE Biology results".
  - **Sets for subject views:** `rankFixedSets` returns `subjectRanked` (the IGCSE members kept), and the chooser-set and saved-sets routes pass it on as `subjectRows`, only where a member was left out.
  - **"10 nearest" for a subject:** the same build with the IGCSE filter off, so the 10 nearest by the same rules with IGCSE schools in. Where that differs from the whole-school ten, the caption says so: "The 10 nearest schools, including 5 not ranked at GCSE overall (mostly IGCSE): each is ranked in the subjects it entered as GCSE."
  - **Every subject view reads those sets:** Comparisons with a subject chip, "Add an average", the set's grades, and Column 1's Trend map.
  - **Whole-school views keep the IGCSE-free rows.**
  - **Maps** (`RankingsMap`) exclude by what they show: nobody on a subject, incomplete families on a family, every IGCSE school on the headline.
- **SMT Academic:**
  - an IGCSE school at GCSE now gets its GCSE area chips (an incomplete one under its short label), its subject rows (ranked), its complete areas against the set, its grade profile and entries mix;
  - only value added and the whole-school results trend keep the IGCSE note, and the Attainment 8 and English and maths tiles stay the IGCSE tile;
  - an incomplete area's rank tile reads "not ranked against other schools: Sciences & Maths · no maths (IGCSE)".
- **Admissions:**
  - `familyPlaces` and the rivals' subject areas leave an IGCSE school out of incomplete areas only (its own incomplete area isn't ranked against its rivals either);
  - subject places go through the shared `subjectRanking`.
- **Data view:** the family map, as above. The data view still has no GCSE tab for an IGCSE school itself: its whole-school figures aren't comparable.
- **Public page:** no ranking (unchanged; the GCSE line stays out for an IGCSE school).
- **Group Academic and the group as a set:**
  - the group's subject areas come from the ingest (below);
  - a group set reaches Teacher through the saved-sets route, so its IGCSE members come back for subject views.

## Follow-ups

1. **The short label.**
   - Everywhere Teacher names the school's own category (Results' and Candidates' headings, Context, "Add an average", the category average line, the editor and "Copy this view"), and SMT's area chips: "Sciences & Maths · no maths (IGCSE)", "· no Mathematics (IGCSE)" (where Statistics or Additional Maths is held), "Languages & Literature · no English (IGCSE)" or "· no English Language (IGCSE)".
   - The full sentence, "Sciences & Maths (sciences only: maths taken as IGCSE). DfE's tables hold GCSE results only…", is in Results', Candidates' and Context's (i), and in SMT's notes for that area.
   - **The rank tile:**
     - Measured in headless Chrome with the app's CSS: the plain "of 4 in Sciences & Maths" already fills two lines of the 11 px tile, and the short label took three to six.
     - So the tile names the category by what it is at the school: "of 4 in Sciences (maths: IGCSE)", "of 7 in Languages (English: IGCSE)" (`igcseTileName`).
     - That is two lines at every Column 1 width from the phone's 358 px card up.
2. **Ties:**
   - `src/lib/rank.ts` holds standard competition ranking. `rankByValue`, `ranksOf`, `rankWithin`, `rankIn` and `rankDescendingWithTies` delegate to it, and a unit test checks all of them agree.
   - Column 1's within-category and at-school tiles now say "=3rd".
   - `rankFigures` (mirrored by the SQL function), `resolveRankingSet`'s inline rank and `teacherMapFills` already ranked this way and are unchanged.
3. **Births notes:** no change (confirmed).
4. **The flaky rule test was R-SMT-YEARS:**
   - **Cause: shared state in the rehearsal's fetch wrapper, not a timeout.** Under load, `area_context` answered with a statement-timeout error. `install-lsoa-next.ts` read that error as data and threw a TypeError, which the app's own retry (`rpcRetrying`, timeouts only) can't see.
   - **Fix:** failed answers now pass through untouched, as in production. `synthetic-year.ts`'s current-periods branch had the same gap.
   - **The rule test now names a subprocess's own error line**, not "Command failed".
   - **Evidence:** six concurrent rehearsals all failed before and all passed after. No timeout was raised.

5. **Group legend overflow:**
   - a set's legend entry stays on one line, truncated, with the full name as its tooltip (`SetKey`), so the legend wraps within the panel, every series keeps its entry, and the footnote stays;
   - Results' title truncates the same way; Against others clamps a long set name to two lines;
   - the trends' (i) names the set in full ("Compared against: …").
   - **Test:** `src/lib/groups/legend.test.ts`, with the longest real set label: mix-matched for "Christ Church (Church of England) Infant School and Nursery and Christ Church (Church of England) Junior School Federation", 168 characters, the longest of 3,733 group names.
   - Checked in headless Chrome at 1440 and 390.
6. **Three snags:**
   - **Negative zero:** every measure's delta takes its sign from the printed figure (`signedDelta`), so a change that rounds to zero prints as zero does ("+0.0"), never "−0.0". Each measure keeps its own rounding: the first version moved half-points (−6.5pp printed −7pp), parity caught it, and it's fixed and pinned by a test.
   - **"Has grown the most":** the summary says "has fallen the least" when every subject fell, and "has held steady" at zero (`moversSentence`).
   - **Croydon's two chips:**
     - Both read "Business Studies · BTec, OCR, VRQ"; chips that would read alike now take the exact qualification ("Business Studies · BTEC Extended Diploma", "· BTEC Foundation Diploma", …), then DfE's own name (`uniqueChipLabels`).
     - They aren't merged: each chip is its own qualification's figures.
   - **`engmath_97_percent`: not built.** No view in the app shows it, so there is no trend or change line to remove. Showing it, current year only, is a new figure that needs a place: logged for Guy.
7. **BTEC historic points: cured.**
   - Croydon College (130432) has no zero-point BTEC rows in 2021/22 or 2022/23: each has real points or null.
   - Across every school, BTEC and OCR rows with zero points: 2021/22 none, 2022/23 one, 2023/24 one.
   - The two remaining (132779 Construction Extended Diploma 2022/23, 8 entries; 130681 Computer Architecture Certificate 2023/24, 6 entries) look like genuine all-fail results. Not changed.

## Leighton Park and King's Worcester, before and after (national, GCSE points)

| | Before (`main`) | After |
|---|---|---|
| Leighton Park, Biology | not ranked ("not ranked at GCSE (IGCSE)") | **=854th of 3,443** |
| Leighton Park, Chemistry / Physics | not ranked | =1,159th of 3,298 / =462nd of 3,311 |
| Leighton Park, Combined Science / Art and Design | not ranked | =258th of 3,750 / =1,020th of 3,837 |
| Leighton Park, Attainment 8; English and maths | not ranked | not ranked |
| Leighton Park, Sciences & Maths; Languages & Literature | not ranked | not ranked (no GCSE maths, no GCSE English Language) |
| Leighton Park, Humanities; Arts, Media & Design | not ranked | 537th of 3,894; 620th of 3,844 |
| Leighton Park, Biology's category | "Sciences & Maths (sciences only: maths taken as IGCSE)" | "Sciences & Maths · no maths (IGCSE)"; tile "of 4 in Sciences (maths: IGCSE)"; the sentence in the (i) |
| King's Worcester, Art and Design / History / Geography | not ranked | =175th of 3,837 / =182nd of 3,573 / 199th of 3,659 |
| King's Worcester, Biology | not ranked | not ranked: no GCSE Biology entries (absent, not inferred as IGCSE) |
| King's Worcester, Humanities; Arts, Media & Design | not ranked | 343rd of 3,894; 133rd of 3,844 |
| King's Worcester, Sciences & Maths; Languages & Literature | not ranked | not ranked |
| Leighton Park, "10 nearest" for a subject | the whole-school ten (no IGCSE school) | the ten nearest, 5 of them IGCSE schools; the whole-school ten unchanged |
| Leighton Park, SMT Academic at GCSE | the IGCSE tile only | 6 areas, 16 subjects (13 ranked: Biology 4th of 7 in its set, 851st nationally), 4 areas against its set |

These figures are from 16 Oct. Production's data moved during the day (a GIAS refresh was running), so a count can differ by a few schools between runs.

## The differences, by product

### Server side: the rankings themselves

The same code paths were run on `main` and on the branch, read-only, for four schools and ten subjects (`rankdiff.mts`).

- **Subject rankings (Teacher, SMT's subject rows, Admissions' subject places):** every subject's population gains the IGCSE schools with that subject as GCSE.
  - Biology goes from 3,250 to 3,443 schools, Combined Science from 3,563 to 3,750, Latin from 193 to 364, Mathematics from 3,958 to 4,013.
  - A non-IGCSE school's rank moves down wherever IGCSE schools rank above it. For example:
    - The Chase's Biology: =786th of 3,249 → =889th of 3,443;
    - Abbey Grange's (100053) Chemistry: =107th of 3,111 → =134th of 3,298;
    - Abbey Grange's Latin: 128th of 193 → 292nd of 364.
- **Family places (Admissions' area places, rivals' areas; SMT's areas against the set):** complete families gain the IGCSE schools.
  - Humanities goes from 3,571 to 3,894 schools: The Chase 852nd → 1,150th.
  - Sciences & Maths goes from 3,995 to 4,060 (IGCSE schools with GCSE maths): The Chase 914th → 962nd.
- **Admissions' rivals' areas:**
  - King's Worcester at 11+ now has national places on its complete areas (Arts 133rd, Humanities 343rd).
  - It loses Languages & Literature, which is incomplete.
  - Its set counts grow by its IGCSE rivals' complete areas.
- **"10 nearest":**
  - the whole-school lists are unchanged for all four schools;
  - Leighton Park's and King's Worcester's subject lists each gain 5 IGCSE schools;
  - The Chase's and Abbey Grange's are unchanged (no IGCSE school near enough).

### Teacher parity (`run_parity.sh`, branch against `main` `da44856`, final branch, `main`'s fixtures recaptured on the same data)

The ranking fixtures are computed by the branch's code and shared by both trees, so this compares the browser code only. The server-side changes are listed above.

| Pairs | Identical | Noise | Unexpected |
|---|---|---|---|
| 2,875 | 2,737 | 23 | 115 |

Every one of the 115 is an intended change:

| Difference | Where | Count |
|---|---|---|
| "−0.0" → "+0.0" (follow-up 6) | change tables, sortable tables, area charts, at GCSE and Post-16 | 279 word changes, in 93 pairs |
| "1st" → "=1st", "44th" → "=44th" (follow-up 2) | King's Worcester Post-16 Mathematics; Croydon Law at school | 5 pairs |
| "Mathematics has grown the most (0pp)" → "has held steady (0pp)" (follow-up 6) | King's Worcester's Post-16 change panels' summary (pixels only: the summary sits in the caption) | 16 pairs |
| the known `rk-137625-nat-pending` Trends map flake | — | 1 pair |

Other Teacher checks:
- The public page SSR is identical (137625, 117037).
- The 130416 error file is the README's known random flake.
- **Data drift between runs:** a run with `main`'s fixtures cached from the morning showed Sevenoaks' (118952) Post-16 nearest set with different schools on the two sides: production's data had moved (the GIAS refresh). With `main` recaptured, the 10 fixtures are byte-identical between the trees, and that is the run above.
- **Not exercised here:** the IGCSE label and the subject sets with IGCSE schools. No harness Teacher school is an IGCSE school at GCSE, so those are covered by the rules and the server-side listing.

### Admissions parity (`par.mjs`)

| Comparison | Pairs | Result |
|---|---|---|
| Browser code, on shared answers | 328 | **328 identical** |

The server-side changes (rivals' areas, family places) are listed above. The harness's fixture set (`fx_s12`) came from a variant capture that couldn't be rebuilt faithfully, so no per-tree capture was made.

### SMT parity (`smtpar`)

| Comparison | Result |
|---|---|
| Browser code, on shared answers | **The Chase identical on every page.** Leighton Park differs on every page, only in the narrowed IGCSE wording: the GCSE chip's tooltip ("No comparable whole-school GCSE results…") and the note on its whole-school GCSE views |
| Each tree's code on its own answers | Leighton Park's GCSE Academic: before, the IGCSE tile only; after, as in the table above |

A clean per-tree comparison of the rest wasn't possible: production's data moved between the two captures, and retries timed out. England's school count went from 9,180 to 9,141, and national subject counts fell by a few, on Post-16 too, which this change doesn't touch. That is the GIAS refresh running in another session.

## The ingest change and its command

`~/dev/vicdata` `feat/igcse-subject-areas` @ `f281abd` (pushed over HTTPS). Its report section is "0.8 IGCSE subjects" in `docs/vicdata_group_aggregates_report_v1.md`.

- **The change:** an IGCSE school was out of every KS4 subject area (overnight call #8). It's now out only of an incomplete one, by the same inference. The subjects fetch carries each school's GCSE English Language and maths entries.
- **The dry run** (`bf1671c`, against `8e17f2c` on the same cached inputs) changes subject areas only:
  - **Group rows:** 1,792 of 108,148, all KS4. 91 groups, all independent; in 38 of them the areas shown change. No MAT changes.
  - **Comparison sets:** 200 of 26,823 rows (peer bands 160, England 20, non-group 20).
  - **Group comparison rows and school-years:** 0 changed.
- **Dukes, 2025/26:**
  - Languages & Literature 5 → 8 schools (5.71 → 6.36 points per entry);
  - Humanities 5 → 7 (5.80 → 6.47);
  - Enterprise & Applied 1 → 3, now shown;
  - Sciences & Maths unchanged.
- **England's areas:** gain the IGCSE schools' complete families. Humanities goes from 3,541 to 3,865 schools.
- **Tests:**
  - Python: 17 pass (3 new).
  - PGlite: all pass.
  - The fixtures were regenerated (only subject areas and the build stamp differ) and copied into the app (`docs/v0.8/groups_fixtures`).
  - R-GROUP: 13/13 on the fixtures and on production.
- **Guy's command:** no migration (the lookups are unchanged). From `~/dev/vicdata`, after this app round is merged:
  ```
  cd ~/dev/vicdata && git checkout main && git pull && git merge --no-ff feat/igcse-subject-areas -m "Merge group aggregates: IGCSE schools out of a KS4 subject area only where it is incomplete" && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && caffeinate -dims .venv/bin/python run_group_aggregates.py compute --promote && .venv/bin/python run_group_aggregates.py verify && .venv/bin/python run_group_aggregates.py timing && git push
  ```

## Rules

| Rule | Status |
|---|---|
| **R-IGCSE-SUBJECT** (new, check `igcseSubject`) | pass: Leighton Park and King's Worcester as above |
| R-IGCSE-EVERYWHERE | narrowed to whole-school measures and incomplete groups; its check now tests a family ranking; pass |
| R-IGCSE-GROUP-LABEL | the short label and the (i) sentence; pass |
| R-SMT-IGCSE-WORDING | only the whole-school GCSE views carry the note; pass |
| R-ADM-FLAG-STRENGTHS, R-SMT-LEVEL-CHIPS | recount under the narrowed rule; pass |
| R-ADM-RIVAL-RANKS | failed on `main` too: its fixed IGCSE rival, 117018, left the GIAS data today. It now checks every flagged rival (separate commit); pass |

## Checks

| Check | Result |
|---|---|
| tsc, eslint, `next build` | clean; no server key in `.next/static` |
| Unit tests (every `src/**/*.test.ts` + `scripts/catalogue-unit-tests.ts`) | **494 / 494** |
| Rule tests (production) | **98 pass, 0 fail, 0 errors**, in one full run on the final code |
| R-GROUP (production, switch off) | 13 / 13 |
| PGlite: RLS, the usage log and every `supabase/tests/*.mjs` | **16 / 16** |
| Parity | as above. Teacher: only the intended "+0.0", "=" and movers wording, and one known flake. Admissions: 328 / 328 identical. SMT: only the IGCSE wording at Leighton Park |

## Logged calls

Under "2026-10-16 — 0.8 IGCSE subjects" in `docs/OPEN_QUESTIONS.md`.

## Also: the shared ingest checkout

While this round ran, another session was making a GIAS refresh in `~/dev/vicdata`. I had switched that checkout to `feat/igcse-subject-areas`, so its commit (`a0436ef`, "GIAS refresh 16 Oct…") landed on my branch.

- I moved `main` forward to that commit (a fast-forward: what that session meant to do) and put the checkout back on `main`.
- The ingest work moved to its own worktree, `~/dev/vicdata_igcse`, based on `8e17f2c`.
- Nothing of the other session's was changed. Its commit is on local `main`, not pushed by me.
