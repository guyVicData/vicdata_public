# VicData 0.6.3, grade counts, maps, tables: report

Branch `v0.6.3-grades-maps`, from `main` (83d949e). **No stop condition was hit** (no RLS change, no migration, no Data View change, no figure change outside the expected list), so it is merged into `main` and pushed. **Members' pictures and some Post-16 figures change on purpose** (listed below with before/after). **The Data View is unchanged**, pixel for pixel and figure for figure (checked, below).

**Checks on every commit:** `tsc --noEmit`, eslint (0 errors; the 2 warnings are main's), `next build` clean; unit tests 340/340 at the end (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`); real-data rule tests `PASS=16, FAIL=0, ERROR=0` (MANUAL 15, NONE 20, SUPERSEDED 2). No migration, no database write, no RLS change, and no server key in client code.

Read with `docs/OPEN_QUESTIONS.md`, "2026-10-06 — 0.6.3 grade counts, maps, tables" (S1–S4).

## Stages and commits

| Commit | What |
|---|---|
| `23ee6c9` | S1: Grade counts selection drives Context and Comparisons |
| `600c394` | S2: maps: size = entries, colour = what you selected, the hover explains |
| `2573df4` | S3: Post-16 safeguards |
| `abde916` | S4: year tables, years across or years down |
| (this) | S5: checks, screenshots, this report |

## What changed

### S1: Grade counts selection

- **Column 1 Current:** click a grade to select it; click another to widen to the range; click again to start a new one; **Clear** (or the same single grade) removes it. U / Fail / Unclassified can't be range ends (they do nothing; the tooltip says why).
- **The selection is the top bar's Grades ▾** (band:range, same key and format): Custom 9–5 there shows 9–5 here, and the other way round. Grades ▾ now shows on Grade counts too ("Pick a range" with nothing selected).
- **The answer line** shows on the card, e.g. *"Grade 9: 8% of entries (11) · England 6%"*, *"Grades 7–9: 34% of entries (45) · England 27%"*, *"A*: 23% of entries (8) · England 18%"*. England is left off when partial (a grade suppressed or unpublished).
- **Context and Comparisons follow:** the selection's share, by subject / by school, titled *"Share at grade 9, by subject in Humanities & Social Sciences"* and *"Share at grade 9, by school (10 nearest schools)"* on every view, map included; Trends follow; a chip *"Grade 9 · from your highlight"* on both panels goes back to Column 1 (on a phone, the Results tab).
- **Before any selection:** a quiet card, *"Click a grade in Results to compare it across subjects"* / *"…across schools"*. **The silent average-points fallback on Grade counts is gone.**
- **Minimum:** below 5 graded entries (MINIMUM_SUBJECT_N) a school reads *"too few entries"* in Comparisons' ranking (no rank) and is a hollow dot on the map; Context leaves the subject out and its note says so.

### S2: maps (Comparisons Current / Trend map / Change map, Column 1's Trend map; cards and fullscreen)

| Map | Size | Colour | Hover |
|---|---|---|---|
| Candidates Current | entries | none (neutral) | entries |
| Candidates Trends | entries | change in entries, red → pale amber → green, centred on 0 | "+12 entries since 2022/23", then entries |
| Results Current | the subject's (graded) entries | the selected measure **by rank in the set: pale blue → deep purple** (Guy's change during the build: rank hues apart from change's) | "Grade 4+: 76% (101 of 132)" / "Grade 9: 12% (7 of 58)" / "Average points: 5.3", then entries |
| Results Trends | entries | change in the selected measure over the panel's span (from 2022/23), red → pale amber → green, one symmetric scale | "+4pp since 2022/23", then entries |

- The school itself: a **thick ring**, white on the dark card, dark grey on the light card and on fullscreen's light basemap (was red #dc2626). No figure / too few entries: a **hollow grey dot**, saying which on hover.
- **A labelled key on every map:** the card's unlabelled strip is gone; the card has one wrapped line ("Darker purple = higher Grade 4+ rate in the set · Dot size = entries in History"), fullscreen a key box (scale with named ends, hollow dot, "This school").
- **Rank follows the measure:** Comparisons' "rank N of M" beside the map is on Grade 4+ / bands / the selection too (was points). Maps plot the active set's schools only.
- **Column 1's Trend map** now follows Results' measure and span; its Grade band / Trends toggle is gone.
- DV-C3-CUR-MAP offers Grade 4+ and bands in the editor.
- **How:** one new optional prop `teacherMap` on RankingsMap → AcademicMapView (built by `src/lib/teacher-map.ts`), as `changeValues` was. The Data View never passes it. No shared colour helper was edited; the new scales are new exports (`RANK_SEQ_STOPS`, `RAG_DIVERGING_STOPS`).

### S3: Post-16 safeguards

| Check | Before (main) | After (branch) |
|---|---|---|
| King's Worcester 117037, A level Maths, A* share 2021/22 · 2022/23 · 2023/24 · 2024/25 | 0% · 0% · 0% · 22.9% | **44.4% (20/45) · 25.0% (14/56) · 39.3% (22/56)** · 22.9% (8/35) |
| … England's A* share, same years | 0% · 0% · 0% · 17.9% | **23.2% · 17.7% · 17.7%** · 17.9% |
| … A*–B (a range: "*" already sat inside it) | 84.4 · 80.4 · 87.5 · 68.6 | unchanged |
| Croydon 130432, BTEC Ext. Cert. Business, England's Distinction* share 2021/22 · 2022/23 | — · — (raw codes `* D M P`) | **20.1% · 9.8%** |
| Sevenoaks 118952, IB HL Biology, 7 / 6–7 | 60.5/87.7 · 36.4/84.8 · 49.1/92.5 · 47.4/79.5 | unchanged (scored on the IB 7–1 scale) |
| The Chase History / Croydon BTEC Grade counts England ticks | — | unchanged (no non-grade England rows in the latest year) |

1. **"*" is A*** at KS5 in the Teacher view's grade rows (own and comparators) and England's/areas' grade rows. 2023/24 rows wrote "*" too, not only 2021/22–2022/23.
2. **The scale** comes from the qualification type (T Level → T Level scale); a comparator tied between T Level and vocational is scored (`scaleFits`). No real T Level school was checked; covered by a unit test.
3. **Context keeps to the focus's family** on bands and a counts selection at Post-16 (AS / AEA still out first).
4. **England's share** is over graded rows only; Grade counts' England ticks now use Grade bands' denominator. Historic vocational labels are mapped on England's rows too (verified above).
5. **An AS / AEA focus** is compared on its own qualification's graded entries (size, share, rank). On points, no exact-AS figure exists for other schools, so Comparisons says so rather than plotting A levels.
6. **A*–E on a BTEC / IB / T Level focus** says on the panels: *"A*–E applies to A levels; use a grade or band for this qualification."*
7. No Post-16 presets: the prompt is the starting state there.

New rule tests, PASS on real data: R-ALEVEL-STAR (117037), R-HISTORIC-GRADE-LABELS-AREA (130432), R-SCALE-FROM-QUAL (118952), R-COUNTS-SELECTION (137625). R-HISTORIC-GRADE-LABELS updated ("*" rows now read as A*).

### S4: tables

- Every year table (Trend, change, Results' area, Comparisons', Grade counts' change; card and fullscreen; both paths) has a **"Swap rows and columns"** button.
- **Years down** shows every year (the card too) and the Change row (0.6.2's from-2022/23 rule and note kept). Wide sets scroll inside the card; the card never widens.
- **Remembered per member** per view; the editor's new **Layout: Auto / Years across / Years down** (the View step's table look box) sets the default; **Auto opens one or two rows years down.**

## Data View: unchanged

- **Pixels:** the Data View's map (AcademicMapView exactly as AcademicDataView mounts it) on real profiles, 4 schools × (whole school, a category / A-level bucket, a BTEC bucket at Post-16) × light and dark × Grade band and Trends: **40 screenshots and 40 marker dumps (every dot's path, fill, outline), 80/80 byte-identical**, main vs branch.
- **Figures:** the Data View's own reads (modern subject data and profiles) for 137625, 117037, 130432, 118952 hash **identically** on both trees. The changed grade code is reached only from the Teacher routes (four-year rows, comparator grades, grade geography).
- The only shared files touched are AcademicMapView (behind the optional prop), grade-rows / subject-grades (new functions; `bestScale` and `gradeOrderFrom`, which the Data View uses, unchanged) and grade-spread (Teacher only).

## Parity

Main vs branch, the members' Teacher page on fixtures captured from real data by **each tree's own fetchers** (scripts and the classifier's output: `docs/v0.6/audit_scripts/grades_maps_tables/`):

- **Matrix:** 137625 GCSE History, 100053 GCSE, 117037 Post-16 Maths, 130432 Post-16 BTEC Business, 118952 Post-16 IB Biology. Candidates, Points, Grade 4+ / A*–E, Grade bands, and Grade counts with no selection, a single grade (9 / A* / Distinction* / 7) and a range (7–9 / A*–A / D*–D / 6–7). 1280 and 390, light and dark (alternating across cases, both covered per school). Every visible panel, every rail view.
- **1,356 view pairs, 0 unexpected:**

| State | IDENTICAL | NOISE | EXP-MAP | EXP-TABLE | EXP-COUNTS | EXP-POST16 | EXP-KNOCKON | UNEXPECTED |
|---|---|---|---|---|---|---|---|---|
| Candidates | 150 | 0 | 30 | 60 | 0 | 0 | 0 | 0 |
| Points | 140 | 0 | 40 | 60 | 0 | 0 | 0 | 0 |
| Grade 4+ / A*–E | 92 | 0 | 28 | 28 | 0 | 64 | 0 | 0 |
| Grade bands | 172 | 0 | 40 | 42 | 0 | 0 | 0 | 0 |
| Counts, nothing selected | 6 | 2 | 0 | 10 | 10 | 2 | 0 | 0 |
| Counts, one grade | 6 | 1 | 30 | 49 | 100 | 2 | 2 | 0 |
| Counts, a range | 5 | 1 | 30 | 49 | 100 | 3 | 2 | 0 |

- **What each kind is:** EXP-MAP, S2's maps. EXP-TABLE, S4's swap (212 of those tables have **exactly main's words**; the 86 whose figures differ are all in counts or Post-16 grade states). EXP-COUNTS, S1. EXP-POST16, S3: the A*–E note on the IB and BTEC focus (64), and King's Worcester's spread losing its stray "* 0% · 0" row (A* merged; 6). EXP-KNOCKON: on a counts selection at 100053, Context's vertical bars (a % axis) ask for 6 px more and the grid takes 3 px from Column 1 (words equal). NOISE: words equal, anti-aliasing (max 3/255 per channel), or one 1 px sub-pixel offset at 390.
- **Every non-map Current view outside Grade counts is identical** (292), apart from the A*–E note (28).
- **Views on one side only, all expected:** main's points-fallback views on Grade counts with nothing selected (160) where the branch draws the prompt (40); Context's donut on a counts selection (20, branch only).
- **Both drawing paths:** 12 new-feature views (maps a–d, the prompt, the chip and titles, tables, the A*–E note) are pixel-identical between `?views=v1` and the default renderer.
- **Harness noise:** main logged Leaflet's `_leaflet_pos` error on two Post-16 Grade 4+ maps at 1280 (as in 0.6.2); the branch logged none.
- **Context's Post-16 family rule** changed no figure in these five schools (none of their Post-16 bands groups mixed families).

## Logged calls

See OPEN_QUESTIONS.md. The ones worth a look:
- The rank scale is blue → purple (your note during the build), not green; deepest = top.
- Comparisons' titles say "(10 nearest schools)", the set's own name, not "(10 nearest)".
- A partial England figure is left off the answer line rather than marked "partial".
- Context leaves a too-few-entries subject out (with a note) rather than drawing a "too few entries" row.
- The swap button sits above each table (a row of its own), so every year table is one button-row taller.
- An AS focus on points shows a note in Comparisons (no exact-AS figures exist for other schools).
- No real T Level school was found/checked.

## Click-through for Guy (after Render's "Deploy live", hard-refresh)

1. The Chase (137625) GCSE, focus **History**, Results → **Grade counts**. Columns 2 and 3 show "Click a grade in Results…". Click **9**: the answer line "Grade 9: 8% of entries (11) · England 6%"; Context "Share at grade 9, by subject…", Comparisons "Share at grade 9, by school…", each with the chip. Click **7**: "Grades 7–9: 34%…". Click **Clear**. Click **U**: nothing (hover says why).
2. Top bar **Grades ▾ → Custom 9–5**: Grade counts highlights 9–5.
3. Comparisons Current **Map** on Candidates (grey dots, size only), on Grade 4+ (purple by rank, white ring on your school), Trends → **Trend map** / **Change map** (red–amber–green), each in fullscreen. Column 1 Trends → **Map** follows Grade 4+.
4. King's Worcester (117037) Post-16, Maths, Grade counts → click **A***: "A*: 23% of entries (8) · England 18%"; Trends → the A* trend no longer falls to 0 before 2024/25.
5. Any year table: the ⇄ button swaps; reload: it's remembered. A single-subject table opens years down.

Screenshots: `docs/v0.6/grades_maps_tables_screenshots/` (both themes; `s1-*` the click-through, `s2-*` maps a–d card and fullscreen, `s3-*` Post-16, `s4-*` tables).
