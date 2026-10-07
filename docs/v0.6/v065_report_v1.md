# VicData 0.6.5: Post-16 matched to GCSE — report

Branch `v0.6.5`, from `main` (fdb7f1e). Prompt: `docs/v0.6/vicdata_0_6_post16_match_gcse_claude_code_prompt_v1.md`. Calls are logged in `docs/OPEN_QUESTIONS.md` under "2026-10-07 — 0.6.5". The updated matrix is [`post16_vs_gcse_matrix_v2.md`](post16_vs_gcse_matrix_v2.md); v1 is kept unchanged.

**No stop condition was hit, so it's merged into `main` and pushed:**
- every Post-16 difference in the parity run is on the expected list;
- GCSE is identical (579 views identical, 1 anti-aliasing pair);
- the Data View is untouched (below);
- there's no RLS change, no migration and no database write;
- no server key is in client code: the one new route reads with the anon key on the server, after the membership check.

**Checks on every commit:** `tsc --noEmit` clean; eslint 0 errors (the 2 warnings are main's); `next build` clean; unit tests **351/351**; real-data rule tests **PASS=19, FAIL=0, ERROR=0** (MANUAL 15, NONE 20, SUPERSEDED 2), with two new rules (R-POST16-BAND-DEFAULT, R-POST16-DEFAULT-SET) and R-POINTS-SAME-QUAL extended.

**The BTEC points (matrix change 2)** come from the ingest repo's fix, rebuilt on production before this round. Both trees' parity fixtures were captured after the rebuild, so that change isn't counted as a branch difference. Re-checked: Croydon 130432 Business National Diploma reads 31.16 / 20.27 / 27.39 / 26.47. **No app-side zero guard was added.**

| Commit | What |
|---|---|
| `9539cb1` | S1: Grade bands opens on each Post-16 scale's default range |
| `4862ba4` | S2: A*–E greyed for a non-A-level focus; a saved A*–E shows Average points there |
| `c85224c`, `fd817d7` | S3: Comparisons and maps on the exact qualification |
| `2d8d06c`, `b4df6f8` | S4: the Post-16 default set; its build sped up |
| `44185f7`, `9dfedf4`, `75ad81a` | S4: the set's name and Comparisons' pills (two layout attempts reverted; see S4) |
| `29dbc6c` | S5: the ranking note for a school with no A levels |
| `1e1b971` | S6: the T Level note |
| (this) | the matrix v2, this report, screenshots, audit scripts |

## What changed

### S1 — Grade bands opens on a default range (R-POST16-BAND-DEFAULT)
- **Where:** in `BAND_PRESETS`, as GCSE's 7–9. Each Post-16 scale has one default, and the Grades ▾ menu offers it plus Custom:

  | Scale | Default band |
  |---|---|
  | A level, EPQ | A* to A |
  | AS, Core Maths | A to B (they share the A-level scale, so the preset names its qualifications) |
  | IB subject | 7 to 6 |
  | BTEC single | Distinction* to Distinction |
  | BTEC double | Distinction*-Distinction* to Distinction-Distinction |
  | BTEC triple | Distinction*-Distinction*-Distinction* to Distinction-Distinction-Distinction |
  | T Level | Distinction* to Merit |
  | Pre-U, and A*–E qualifications not listed | custom range only |
- **The scale** is the existing detector's (`scaleForQualification`). The Post-16 presets apply at Post-16 only, so a small GCSE cohort read as IB 7–1 gains nothing.
- **A saved range wins.** One that isn't on the new focus's scale falls back to that scale's default. Before, at Post-16, that meant "Pick a grade range" and blank panels. The saved setting isn't overwritten.
- **Context and Comparisons on bands** now draw bands, not points.
- **The real-data rule:** King's A level Maths opens on A* to A (40%); Croydon BTEC Extended Diploma on D*D*D* to DDD (27.6%) and Extended Certificate on D* to D (7.7%); Sevenoaks IB HL Mathematical Studies on 7 to 6 (77.6%); Christ The King T Level Health on D* to Merit (88.9%).

### S2 — A*–E only where it means something
- **Greyed:** on a BTEC / OCR, IB, T Level or Pre-U focus, the Results switch greys "A*–E rate" with *"A*–E applies to A level, AS, Core Maths and EPQ grades."* on hover.
- **A saved A*–E** shows Average points for that focus. The saved choice is kept, so an A-level focus brings it back.
- **Embeds** (a pinned measure) keep the 0.6.3 panel note.
- **Core Maths and EPQ keep A*–E**, as you decided (logged).

### S3 — Comparisons and maps on the exact qualification (R-POINTS-SAME-QUAL)
- **The new route** `/api/teacher/comparator-qualifications` (membership-gated, one RPC call) returns each school's points and entries for the focus's exact qualification. The page asks for it keyed by set + subject + qualification, beside the map profiles, through the 5-minute fetch cache.
- **What follows from it:** at Post-16 Comparisons (Current and Trends, every view, both paths) and Column 1's Trend map read only those rows. The school's dot is its Column 1 figure:
  - Croydon A level Maths: 24.00 in Comparisons (was the bucket's 21.45);
  - Croydon BTEC Extended Certificate: 21.9 in both.
- **Labels name the qualification:** "Law (AS level)", "Business Studies (BTEC Extended Certificate)", "Mathematical Studies (IB Higher level)". Column 1 keeps its labels.
- **The 0.6.3 AS stand-in is gone.** A note shows only where no other school has the qualification (*"No school in this set has AS level Law entries."*) or none publishes its points.
- **Context is unchanged.**

### S4 — The Post-16 default comparison set (R-POST16-DEFAULT-SET)
- **The rule:** GCSE's own matching (the same distance order, sector, phase and gender rules, and the same backfill), plus Post-16 provision read from real data: KS5 results in the latest two years. FE colleges already defaulted to the nearest FE colleges. A boarding recipe keeps its schools with KS5 results.
- **Unchanged:** GCSE's set, saved sets, and the Data View's calls. The Teacher chooser on its Post-16 page alone sends `post16=1`.
- **The 0.6.4 prefetch** of the other phase gets the Post-16 set from the server.
- **The name (a call, after parity):**
  - the chooser calls it **"10 nearest with a sixth form or 16+ provision"** (hub row, Nearest screen, stepper), and a set picked there keeps that name;
  - the column's own pill and titles for the default keep **"10 nearest schools"**, still true at Post-16.

  **Why:** the grid sizes columns to their content. The longer name in Comparisons' non-wrapping pills widened Column 3 at 1280 (Columns 1 and 2 lost 6 px). When Context's sortable table forces Column 2 wide, it moved Columns 1 and 2 by up to 25 px. Two truncation fixes were tried, and parity caught each:
  - a zero-width box squeezed the "vs:" pill off its row at GCSE;
  - both changed the grid's split, at GCSE too.

  Both were reverted; the pills are main's. If you'd rather see the new name on the pill, it's one constant, at the cost of that shift.
- **Comparators sharing the focus qualification, 2024/25:**

  | School and focus | Before | After |
  |---|---|---|
  | King's 117037, A level Maths | 3 | **7** |
  | The Chase 137625, A level History | 5 | **10** |
  | Croydon 130432, Business (BTEC Extended Diploma) | 4 | 4 (FE: unchanged) |
  | Croydon 130432, AS Law | 0 | 0 (FE: unchanged) |
  | Sevenoaks 118952, IB Maths HL | 1 | 1 (boarding recipe; IB is rare) |

### S5 — The ranking headline for a school with no A levels
On a national or regional ranking, a Post-16 school with no A-level entries sees *"[School] has no A-level entries. Post-16 rankings use A-level points per entry."* on the ranking tiles and the panel's summary, in place of empty tiles. Both paths draw it (the series builder's `numberTiles` gained an optional `note`). A per-family headline is logged as a later option.

### S6 — Notes
- **Croydon's T Levels** (no per-pathway grades or points): Results' three columns show *"DfE publishes this college's T Level results only for all pathways together."*, and Grade counts shows it too. Candidates is unaffected.
- **AS in Context:** the existing family note already says only that family's subjects are compared. Logged and left.
- **IB Diploma:** no change.
- **Every ✗ / ~ cell re-checked:** see [`post16_vs_gcse_matrix_v2.md`](post16_vs_gcse_matrix_v2.md).

## Screenshots (`docs/v0.6/v065_screenshots/`, `*-before.png` = main, `*-after.png` = branch)

| Shot | Shows |
|---|---|
| `s1-kings-maths-bands-default` | King's A level Maths on Grade bands: "Pick a grade range" → A* to A, 40% (14 of 35) against England 43% |
| `s1-kings-maths-bands-comparisons-map` | Comparisons on bands: points fallback → the A* to A share by school |
| `s3-kings-maths-comparisons-map-phone` | Comparisons map at 390, on the exact A level and the Post-16 set |
| `s2-croydon-btec-results-menu` (+ `-after-light`) | the Results switch with "A*–E rate" greyed |
| `s2-croydon-btec-a-e-shows-points` | a saved A*–E on BTEC: the note → Average points |
| `s3-croydon-btec-comparisons-map`, `…-ranking` | Croydon BTEC Extended Certificate: the exact size; Croydon 21.9 as in Column 1 |
| `btec-croydon-points-trend` | the points trend 2021/22 onward (the ingest fix; the same on both trees' post-rebuild fixtures) |
| `s3-croydon-as-law-comparisons` | AS Law: "Law (AS level)…" and "No school in this set has AS level Law entries." |
| `s3-sevenoaks-ib-hl-comparisons-ranking` | Sevenoaks IB HL Mathematical Studies: exact HL (no SL blend) |
| `s5-sevenoaks-ranking` (+ `-after-light`) | a national ranking: empty tiles → the no-A-level note |
| `s1-christ-the-king-tlevel-health-bands`, `s3-…-comparisons` | T Level Health: D* to Merit; exact T Level in Comparisons |
| `s6-croydon-tlevel-note` | Croydon T Level (MIR): the all-pathways note in place of empty charts |

## Speed (routes this round touches; the 0.6.4 replay method, read-only, medians of 3)
This Mac's network was variable, so treat these as relative.

| Route | Before (main) | After (branch) |
|---|---|---|
| chooser-set (default nearest), King's 117037 Post-16 | 1.8 s | 1.2 s |
| … Croydon 130432 Post-16 | 1.0 s | 0.76 s |
| … The Chase 137625 Post-16, first build in the hour | 0.8 s | **1.8 s** (see below) |
| … any school, later in the hour | 0.8–1.8 s | **~0 (server cache)** |
| comparator-qualifications (new), alongside academic-schools | — | 60–100 ms; academic-schools ‖ it = academic-schools alone (≈1.1 s King's, 0.36 s Croydon) |

- **The Chase's first build is slower:** fewer of its nearest neighbours have a sixth form, so the build widens past the 100 precomputed neighbours. It went from 10 upstream calls to 23.
- **Three mitigations,** all returning identical answers (5 schools checked):
  - **the census read only for schools that pass the KS5 check** (`filterBeforeFacts`, opt-in, Post-16 only; the Data View's path is untouched): 23 → 17 calls;
  - **the latest KS5 period** read once an hour;
  - **the resolved default set cached an hour** per instance (school-level public data, keyed by school and phase).
- **The 0.6.4 idle prefetch** also warms the Post-16 set from the GCSE page.
- **Remaining:** a cold first Post-16 visit for a school like The Chase costs up to about +1 s on Column 3, once an hour per instance.
- **Proposed (not built; a database change for the ingest repo):** a precomputed Post-16 neighbour pool in `school_nearest_neighbours` (`pool = 'post16'`), so the build needs no widening.

## Parity (S7)
Main against the branch, the members' Teacher page on fixtures built from production after the BTEC rebuild by **each tree's own fetchers** (main: the GCSE nearest set; branch: the Post-16 set).
- **Cases:** the 0.6.3 matrix (137625, 100053 GCSE; 117037, 130432, 118952 Post-16), plus 130416 T Level Health and Post-16 focus cases (Croydon AS Law, BTEC, T Level MIR; Sevenoaks IB HL Mathematical Studies).
- **Coverage:** every Results measure and Candidates, 1280 and 390, both themes, every panel and rail view. 116 cases, **2,172 view pairs. 0 unexpected.**

| | Identical | Noise | Expected |
|---|---|---|---|
| **GCSE** (580) | 579 | 1 (anti-aliasing, words equal) | 0 |
| **Post-16, must be identical** (C1 / C2 on Candidates, points, counts: 642) | 613 | 11 (9 anti-aliasing; 2 donut-arc edge pixels, words equal) | 18 (E6, the T Level note: 6; E3, Column 1's Trend map on exact figures: 12) |
| **Post-16, other** (950) | 136 | — | E1 bands 334; E2 A*–E → points 150; E3/4 Comparisons 318; E3 maps 4; E6 T Level 8 |

- **One-sided views** (144 main, 134 branch) are all in expected cases:
  - Grade bands, where Context's donut is now enabled;
  - A*–E switched to points: the panels and maps that the 0.6.3 note had replaced;
  - Croydon's T Level: charts became the note.
- **Must-be-identical groups:** every Post-16 Column 1 Candidates and points figure is identical. So is every Context figure on Candidates, points and counts.
- **The Data View:**
  - Of the 29 changed source files, two are in the Data View pages' module graph. `subject-grades.ts`: the Data View never calls `presetsFor`, and the new presets need a phase it never passes. `surrounding-schools.ts`: called with no option, it runs the unchanged branch line for line.
  - The shared routes (`default-lists`, `expand-nearest`, `boarding-quintile-list`) take the new path only with `post16=1`, which only the Teacher chooser sends.
  - The Data View's own pages weren't re-shot this round.
- **Scripts and output:** `docs/v0.6/audit_scripts/v065/`.

## Logged calls (OPEN_QUESTIONS.md, 0.6.5)
- S1: Post-16 presets are Post-16 only; unlisted A*–E qualifications and Pre-U stay custom; menu labels are in full words.
- S2: embeds keep the 0.6.3 note; Core Maths and EPQ keep A*–E.
- S3: a failed exact-qualification request shows no figures, not the bucket's; Comparisons' Candidates counts the exact qualification's entries.
- S4: Post-16 provision is read from KS5 results, not the statutory age; FE colleges aren't added for a school; the boarding recipe is filtered; the pill keeps "10 nearest schools" (the chooser names it in full); the speed mitigations.
- S5: the rank chip stays empty; the summary carries the note. A per-family headline is a later option.
- S6: AS in Context is left as is.

## Click-through for Guy (after Render's "Deploy live", hard-refresh)
1. **King's Worcester Post-16, Mathematics, Results → Grade bands:** "Grades: A* to A" in the top bar; Column 1 40% of 35 against England 43%; Context and Comparisons on A* to A, not points. Grades ▾ offers "Grades A* to A" and Custom…
2. **Croydon College Post-16, Business Studies (a BTEC size), Results ▾:** "A*–E rate" greyed, with the reason on hover. If A*–E was saved, Average points shows; switch the focus to an A-level subject and A*–E comes back.
3. **Comparisons on that BTEC:** "Business Studies (BTEC …)" on the exact size; Croydon's dot and ranking read Column 1's figure. Focus AS Law: "No school in this set has AS level Law entries."
4. **Compared against ▾ → Choose schools…:** the hub's first row reads "10 nearest with a sixth form or 16+ provision". On King's, 7 of the 10 offer A level Maths (3 before).
5. **Sevenoaks on a national ranking** (Choose schools → Rankings → All of England): the tiles say Sevenoaks has no A-level entries.
6. **Croydon, a T Level focus on Results:** the all-pathways note in place of empty charts.
7. **GCSE:** nothing should look different.
