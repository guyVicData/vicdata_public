# VicData 0.8: Guy's feedback of 15 Nov, build C (charts), report

Branch `v0.8-feedback-c`, from `main` 49fb597 (builds A and B merged), in its own worktree. Not pushed or merged. Every call made without asking is logged under "2026-11-15: feedback build C" in `docs/OPEN_QUESTIONS.md`.

## The milestones and their commits

| | What | Commit |
|---|---|---|
| M1 | The charts: C1 value axes (R-CHART-AXES), C2/C17 market share, C3 every line, C4 shapes, C5 leaving at 16, C6 roll by phase, C7 births and children nearby, C8 size by phase, C9 flags, C10 the dumbbells, C11 the Results chart, C12 independent schools at 11+; the new rules and their tests; the fixtures | 270c53c |
| M2 | C13 the walk window, C14 the palette (and its board), C16 the Mid dashboards' tint (R-THEME-CONTRAST extended) | 352bab3 |
| M3 | The screenshots beside Guy's; the harness (the real SMT and Admissions dashboards now draw in it); the SMT dumbbell's panel key on one line | 368f782 |
| — | The calls in `docs/OPEN_QUESTIONS.md` | 5385601 |
| M4 | This report; the head office screenshot moved to its indexed chart | (this commit) |

## Each note: fixed, not a bug, or left

Build C covers SMT 3, 4 (the chart), 5, 6, 8, 10, 11, 12, 13; Teacher 2 and 4 (the chart); Admissions 5 (the pages), 9, 10 and 11; review item #11; D3, D5, D7 and D8. The other notes belong to builds A and B (merged).

| Note | Result |
|---|---|
| **Review #11, SMT 4, 11, 12, 13** (trend charts have no value axis; indexed charts don't mark 100) — **C1** | **Fixed (M1).** The shared `LineChart` draws a value axis by default: round values across its range, about one per 40 px and at least three (`axisValues`); an indexed chart always labels 100, bold, with nothing crowding it; a strip under 70 px labels its reference alone. That reaches every line chart in SMT, Admissions and Group (none turns it off; a test). SMT's results band and Admissions' pipeline, which draw their own SVG, got the same axis. The x labels shift right by the axis's width. |
| **SMT 4 / C17** (market share: the 10 nearest aren't drawn; squashed) — **C2** | **Fixed (M1).** The chart draws what its title names: the rivals' middle share each year (dashed) over their middle half (shaded), beside the school and its largest rival, on a value axis, 170 px in the walk (in a dashboard panel, the room left after the key). The title: "you, your largest rival (Farnborough Hill) and the middle of 10 nearest". The table gets a "Rivals' middle" column. Leighton Park 2025/26: 17.5% against the middle 8.8%. |
| **SMT 6** (every line: dots stretched to ovals; no zero, units, figures or entries) — **C3** | **Fixed (M1).** Drawn at its real width (the old row stretched a 260-wide drawing). One axis from 0 for every row (value added: 0 is England's average, labelled); ring last year, dot this year, both figures; the line's entries under its name; the change at the right. Leighton Park Post-16: A level 41.5 → 40.0 (219 entries), Applied general 37.0 → 42.5, Tech level 39.1 → 31.7. |
| **SMT 8** (Shapes around you incomprehensible; no axis values; what is a Funnel?) — **C4** | **Fixed (M1).** Two small charts drawn like the main one: the nearest school in the set (Crosfields, 0.9 km), then the set's middle school at each year group (10 schools), each with its shape's picture. Every bar carries its figure. The school's shape has its picture and meaning: "Funnel (larger towards the top: the year groups grow as pupils move up)". |
| **SMT 10** (leaving at 16 should be a graph; one signed column) — **C5** | **Fixed (M1).** A bar per year: up where more joined than left (the accent), down where more left (grey; two oranges couldn't be told apart in SMT), each with its signed figure, on a signed axis with 0. The set's middle rate is drawn on each bar as the change it would have meant for that Year 11. "As a table" switches in place; its last column is one signed figure, "Joined (+) or left (−)". |
| **SMT 11** (roll by phase: a meaningless England line) — **C6, D7** | **Fixed (M1).** Each phase against the LA's residents of that phase's ages, one line each: "Reading, ages 11–15" and "Reading, ages 16–17" (ONS mid-year estimates). Titled "Roll by phase against Reading's children of the same ages, indexed (2019/20 = 100)", with 100 marked (C1). Leighton Park 2025/26: Senior 109, 16+ 142, Reading 11–15 109, Reading 16–17 123. |
| **SMT 12** (births and projections share one unlabelled scale) — **C7** | **Fixed (M1).** Two charts on their own axes. First the children aged 11–18 within 15 km, counted (solid) running on into the projection (dashed). Then births in Reading, each birth year also labelled with the year those children reach 11. The turn is said: "The children born since births peaked in 2012 reach 11 from 2023". **No births year is missing:** 2012–2025 for Reading and for Worcestershire. |
| **SMT 13** (children nearby rises; ends a year early; no axis; 100 unlabelled) — **C7** | **Fixed (M1).** The axis and 100 (C1). "Within 15 km" now reaches 2025 with Reading and England: the small-area estimates are published a year behind the LA's, and the area projection's first row is a count for that year (its base). The year the peak's children reach 11 is marked, and the note explains why today's 11–18s are still rising. |
| **SMT 3** (a wide gap between the figure and "5th largest of 11") — **C8** | **Fixed (M1).** "Senior 386 · 2nd largest of 10 · median 75": no spring between them. |
| **SMT 5** (flags empty) — **C9, D5** | **Fixed (M1).** The ±3 threshold stays. With no flag, "Closest to a flag" lists each figure nearest first, with what a flag needs. The Chase: "GCSE results: +1.0 from 2023/24 to 2025/26, against the set's middle −0.6 (10 schools): a gap of +1.6; a flag needs ±2"; "Roll: fell in 1 of the last 3 years …; a flag needs three falls in a row"; Post-16 −0.5 against ±3. The walk's answer names the closest. |
| **Teacher 2** (the whole-school dumbbell for SMT; its key) — **C10** | **Fixed (M1, M3).** On SMT Academic it is a new view, "Entries by subject" (DV-SMT-A-DUMBBELL), in the Every line panel at both levels. It draws the page's own subject-by-qualification rows, first year (2021/22) to latest, largest first, coloured by family; the qualification is tagged only where the level has more than one ("EPQ"). In a panel the rows scroll under a one-line key. Teacher's key: the focus is "Art and Design (highlighted)" with the row's tint, not a ninth family; one entry reads "○ 2020/21 (first year) → ● 2024/25 (latest)"; "School average" labels its own dashed row and isn't keyed; "(GCE A level)" is gone wherever it didn't tell two rows apart. Kept on Teacher. |
| **Teacher 4** (dotted bridge; small cohorts only in the sentence) — **C11** | **Fixed (M1).** No bridge: 2023/24 is a gap, labelled "3 entries, too few to publish" (build A's reason). Each point with fewer than 10 entries is ringed with its entries ("7 entries", "8 entries", "9 entries") and keyed. |
| **Admissions 9, 10** (independent schools at 11+ ranked on GCSE) — **C12, D3** | **Fixed (M1).** Where the school sits IGCSE and has a Post-16 figure, its 11+ rivals view is built on Post-16 (A-level points per entry): the ranking, numbers, change and subject areas. The view says why: "Ranked on Post-16 (A-level points per entry): Leighton Park School sits IGCSE, so it has no ranked GCSE headline." Leighton Park: "7th of 10 on A-level points per entry, 424th of 2,536 in England". The momentum keeps its own 11+ rule (unchanged: Post-16, switched). The Chase stays on GCSE. |
| **Admissions 11** (the window's clumsy top shadow; the stray "–") — **C13** | **Fixed (M2, M1).** The "shadow" was the 3 px accent stripe, clipped by the rounded corners. It's gone. The header carries a 6% tint of the part, the window a hairline edge, a 16 px radius and a soft two-layer shadow, in Light, Mid and Dark; "Here's what you found" uses the same window. The "–" was the steady arrow on an area whose gap hadn't moved since 2022/23; a steady gap now prints nothing (the change is on hover). |
| **D8** (the palette) — **C14** | **Fixed (M2).** Languages & Literature: khaki gold #605024 (Dark #c4aa64). Health & Care: cocoa #4c3324 (Dark #c0957c). Each is 29+ (CIEDE2000) from Sciences, the Post-16 violet and the GCSE green in both themes; the old ones were 18.5 / 14.9 and 13.4 / 12.9. R-SUBJECT-COLOUR's floors still hold: families 15+ apart, 12+ from every accent and fixed line, 4:1 on the plate. **To confirm:** keeping six left room only for warm browns. Their closest neighbours are each other (15.3) and the group bronze (12.8). Guy may prefer to re-pick all eight. Board: `docs/v0.8/feedback_c_screenshots/palette_board.png`. |
| **Admissions 5** (the Mid dashboard pages less prominent) — **C16** | **Fixed (M2).** In Mid each part's columns take a clear tint of the part, and its wells and shut bars a paler one, so the pages no longer glare white: SMT cream, Admissions pale sky, GCSE mint, Post-16 lilac, head office sand. The tints are as strong as the ladder allows (the shut bar's border 1.4:1 from the column, the column 1.4:1 from the field). Light's text, muted and muted2 pass AA on every tint (R-THEME-CONTRAST, 157 pairs). Dark and Light are unchanged; homes and walks keep white. |

## The new and rewritten rules

**New:** R-CHART-AXES (C1, C2, C3, C5, C8), R-SMT-SHAPE-PICTURES (C4), R-ROLL-BY-PHASE-LA (C6), R-BIRTHS-STORY (C7), R-SMT-FLAGS-CLOSEST (C9), R-DUMBBELL-KEY (C10), R-RESULTS-GAPS (C11), R-IGCSE-POST16-AT-11 (C12; with a live read through `buildRivals`), all in `src/lib/front-door/feedback-c.test.tsx` on fixtures captured read-only through the routes' own handlers (`docs/v0.8/feedback_15nov/fixtures/*_c.json`). **Extended:** R-THEME-CONTRAST (C16: the tinted plates' pairs), R-PANEL-LADDER (Mid tints its plates). `docs/catalogue/*.md` and the views preset table are regenerated.

**Rewritten, and why:**
- R-ADM-VS-EACH's check asserted the panel had *no* gridlines; C1 asks for them, so it now asserts it has them.
- R-MARKET-FOLLOWS-SET's check looked for "against {set}" in the title; the title now says "the middle of {set}" (C2).
- R-PANEL-LADDER (unit test and runner): "no Mid rule overrides a ladder token" became "Mid overrides only the three plate tokens", the steps measured on the tinted column (C16).
- R-WALK-KEYS' checker (`keyProblems`): the dumbbell's ring-to-dot entry counts for the ring and the dot, and the school average row labels itself (C10); an unpublished year no longer needs a "dotted" key entry (C11 removed the bridge), and a ringed small cohort needs its entry.

## Figures that changed, before and after

On purpose. Read through the routes' own handlers on production (read-only): the 14 Nov fixtures (base) against the branch's.

| School, view | Before | After |
|---|---|---|
| Leighton Park, Admissions at 11+, academic ranking | "No ranked GCSE headline … Not ranked in England"; 9 rivals not ranked (IGCSE) | 7th of 10 on A-level points per entry; 424th of 2,536 in England; 1 rival without a figure (Crosfields, no sixth form) |
| Leighton Park, 11+ where you lead / trail | GCSE areas (Humanities 9th −0.81, Enterprise 8th −0.77) | Post-16 areas (Languages & Literature 8th of 9 −7.43, Arts, Media & Design 7th of 8 −4.42) |
| Roll by phase, Leighton Park | England 5–15: 91 | Reading 11–15: 109; Reading 16–17: 123 |
| Roll by phase, The Chase | England 5–15: 91 | Worcestershire 11–15: 106; Worcestershire 16–17: 113 |
| Children nearby, within 15 km, last year | Leighton Park 2024: 125.3; The Chase 2024: 104.1 | 2025: 127.0 (64,276 children); 2025: 103.0 (11,557) |
| Market share, the rivals' middle (new line) | — | Leighton Park 8.8% (2025/26); The Chase 9.3% |
| Flags' nearest figures (new) | — | The Chase GCSE gap +1.6 (needs ±2), Post-16 −0.5 (±3); roll 1 fall of 3 (both schools) |
| SMT Academic, entries by subject (new view) | — | Leighton Park Post-16: 20 subjects, 2021/22 → 2024/25, Mathematics 20 → 33 |

Every other figure is the same read: the axes, keys, layouts and colours don't move a number. The momentum at 11+ is unchanged (Leighton Park: Post-16, switched, before and after).

## Tests and parity

| Check | Base (build B's final run) | Final (5385601, the head before this report; the report adds docs only) |
|---|---|---|
| eslint | 0 errors, 3 warnings | 0 errors, the same 3 warnings |
| build | pass | pass |
| tsc | clean | clean |
| Unit tests, one file per process | 101 files, 776 pass | 102 files, 789 pass, 0 fail |
| Catalogue unit | 77 / 77 | 77 / 77 |
| Rule tests (production reads, read-only) | PASS 200 | PASS 208, FAIL 0, ERROR 0 |
| PGlite, every suite (PostGIS ones with PGlite 0.5.5) | 29 / 29 | 29 / 29 |

Along the way (the run before the final, on the working tree): eslint, build, tsc and catalogue unit clean; PGlite 29/29; rules PASS 202, FAIL 5, ERROR 1; unit 787 pass, 2 fail. Each failure was a check that asserted the old drawing (the ones rewritten above), the preset table not yet listing the new view, the 11+ momentum (fixed: it now reads each rival's GCSE standing itself when the ranking switches), and the first palette pick, which broke R-SUBJECT-COLOUR's 15 floor (re-picked under it). All pass in the final run.

**Parity:** the dashboards' seed SQL (`scripts/dashboards-seed-sql.ts --force`, every dashboard), base 49fb597 against the branch: one dashboard differs, `vicdata.smt.academic`, whose "Every line" panel gains DV-SMT-A-DUMBBELL between DV-SMT-A-LINES and DV-SMT-A-MOVES. Nothing else.

## Screenshots

In `docs/v0.8/feedback_c_screenshots/`, from the app's own components (`docs/v0.8/audit_scripts/feedback_c_preview`: build B's harness plus the real `SmtDashboard` and `AdmissionsDashboard`), at 1440 and 390 in Mid, with Dark (or Light) at 1440, beside Guy's (`*_guy_sNN.png`). Every picture was read as an image; none scrolls sideways at 390.

- Admissions 9–11 (s01): the 11+ academic ranking on Post-16 and the new window (Light too);
- SMT 3 (s03): the SMT Overview dashboard (size by phase; the tint);
- SMT 4 (s04): the market share walk screen;
- SMT 5 (s05): the flags' nearest figures (The Chase);
- SMT 6 (s06): every Post-16 line;
- SMT 8 (s07): shape and size;
- SMT 10 (s09): leaving at 16, the chart and "As a table";
- SMT 11 (s10): roll by phase against Reading;
- SMT 12, 13 (s11, s12): births, children nearby;
- Teacher 2 (s14): the Teacher dumbbell; C10: SMT Academic at Post-16 with "Entries by subject";
- Teacher 4 (s16): the Results chart;
- C16: the SMT Pupils and Context dashboards and the Admissions dashboard in Mid (Dark or Light beside), whose pipeline shows C1's new axis;
- C13: a window in Light; C1: a head office walk's indexed roll and Admissions' pipeline walk screen;
- the palette board.

**Harness limits:**
- The SMT fixtures' set is the chooser's 10 nearest, not the live page's remembered set. So Leighton Park's "Year 12 against Year 11" middle is 41% (5 schools) here, where Guy's screen showed 97% (10 schools).
- On the phone, SMT Academic's trends are tabs, so the 390 shot shows Every line, not the dumbbell.
- The live Teacher dashboard isn't drawn.

## Guy's commands

The branch `v0.8-feedback-c` is local and not pushed. Its worktree shares the repository with `~/dev/vicdata_public`, so the branch is already there.

**1. Migrations:** none this round.

**2. Merge and push:**

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-feedback-c -m "0.8 feedback C: value axes; SMT's charts redrawn (market share, every line, shapes, leaving at 16, roll by phase, births); flags' nearest figures; the entries dumbbell on SMT; the Results chart's gaps; independent schools at 11+ on Post-16; the walk window; the palette; Mid dashboards tinted" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own.** If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge:**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** one dashboard, `vicdata.smt.academic` (its Every line panel gains "Entries by subject"). The dry run (`--force --only vicdata.smt.academic`) printed 17 KB of SQL, not run; its only change from main's is that view. The script refuses until step 4 holds:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts --live https://vicdata.co.uk --only vicdata.smt.academic > /tmp/feedback_c_republish.sql && supabase db query --remote --yes -f /tmp/feedback_c_republish.sql && supabase db query --remote --read-only "select d.slug, v.version, v.label from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug = 'vicdata.smt.academic'"
```

**6. Set fixed:** none this round. These notes aren't feedback items.

**7. Live check** on vicdata.co.uk:

- **Any SMT, Admissions or head office line chart:** values up the side; an indexed chart labels 100.
- **SMT, Leighton Park** (View as… → SMT):
  - Overview walk, Market share: the dashed middle of 10 nearest over its shaded middle half;
  - Flags (try The Chase): "Closest to a flag" with each figure and what a flag needs;
  - Academic at Post-16: Every line with both years' figures and 0; on the dashboard, Every line's rail has "Entries by subject";
  - Pupils: Shape and size's two small charts with their shape pictures; Leaving at 16 as bars, with "As a table"; Roll by phase against "Reading, ages 11–15" and "Reading, ages 16–17";
  - Context: Births and projections as two charts with "reach 11 from 2023"; Children nearby ending 2025 with Reading and England.
- **Mid on the dashboards:** the columns and panels tinted (SMT cream, Admissions pale sky), not white; Dark and Light unchanged.
- **Admissions, Leighton Park at 11+:** Market share walk, the last screen: "Ranked on Post-16 … sits IGCSE", 7th of 10, no "–" after a gap.
- **Teacher, The Chase, Post-16 Art and Design:** Results walk, the chart has a gap at 2023/24 and rings at 7, 8 and 9 entries; Candidates walk, the dumbbell's key reads "Art and Design (highlighted)" and "○ 2020/21 (first year) → ● 2024/25 (latest)", with no "(GCE A level)".
- **Subject colours:** Languages & Literature khaki gold, Health & Care cocoa, on the Teacher and SMT dumbbells. If either reads wrong beside its neighbours, say so (see C14).
- **Any walk:** the window has no dark band along its top.
