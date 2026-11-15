# VicData 0.8: Guy's feedback of 15 Nov, build B (walks and homes), report

Branch `v0.8-feedback-b`, from `main` 295f551 (build A merged), in its own worktree. Not pushed or merged. Every call made without asking is logged under "2026-11-15: feedback build B" in `docs/OPEN_QUESTIONS.md`.

## The milestones and their commits

| | What | Commit |
|---|---|---|
| M1 | The subject families (Guy's grouping decision of 15 Nov), R-SUBJECT-MATCH extended | 59f3169 |
| M2 | B1 every walk ends on its answer (R-WALK-ENDS-ON-ANSWER), SMT Academic's subjects ranked; B2 the rail and the way home (R-WALK-RAIL); Admissions 8; D6 | 3625611 |
| M3 | B3 no build notes in the page (R-NO-BUILD-NOTES) | f3d059f |
| M4 | B4 the Admissions home; B5 the SMT home (loading graphic, phase pills, Our subjects); B6 the Teacher home | e54c8cc |
| M5 | The screenshots beside Guy's, the harness; two fixes the screenshots showed | 82601e3 |
| M6 | This report | (this commit) |

## Each note: fixed, not a bug, or left

Build B covers G1, SMT 7, Admissions 1, 2, 4, 5, 6, 7, 8 and 12, SMT 1, 2, 4 (its build notes), 9, 14 and 15, and Teacher 1. The other notes belong to builds A (merged) and C.

| Note | Result |
|---|---|
| **G1** (every walk ends on its answer) | **Fixed (M2).** "Here's what you found" opens on the answer: the walk's question, its sentence and a data view drawn large, then "How you got there", then the way on. Each walk names its answer view in `walks.ts` (`answer`): Teacher, the entries trend, the Results chart against England, the nearby ranking (or the nearby schools' points where too few have a figure to rank); SMT, the scorecard, the subjects ranked, roll by phase, children nearby over time; Admissions, the pipeline and the share bars against the rivals; head office, Against others, Who is growing, Schools ranked, Growing and shrinking. R-WALK-ENDS-ON-ANSWER: every walk names a ranking, chart or table that isn't a "now" summary, and every Teacher walk on every fixture ends on a drawn chart with its sentence. |
| **SMT 7** (Academic's last view ranks the subjects) | **Fixed (M2, M5).** Every subject, strongest to weakest by its place in the set (points aren't comparable across qualifications; the place is): "Strong" for the top quarter, "Needs attention" for the bottom quarter, HTML bars with the set's middle marked. Subjects the set can't place are listed after, one line per reason. A subject needs 3 schools with a figure to be placed (R-RANK-MIN). Leighton Park: Mathematics 3rd of 11 strong; Chemistry, Biology, History, English Literature, Government and Politics, Further Maths need attention. `src/lib/smt/subjects-ranked.ts`. |
| **Admissions 2** (the rail goes to the dashboard; holds views not in the walk) | **Fixed (M2, D4).** The rail lists the walk's own screens in order; a click steps the walk; "More on the dashboard →" at its foot is its one link out. A view shown twice is told apart ("Bars · whole school"). R-WALK-RAIL. |
| **Admissions 12** (no way home from the end) | **Fixed (M2).** "Back to your home" beside the heading of "Here's what you found", and again at its foot. |
| **Admissions 6** (the rail's "The same views, in the same order…") | **Fixed (M2, M3).** Gone with the old rail. |
| **Admissions 7** (captions that read like build notes) | **Fixed (M3).** "Past pools (same method, earlier censuses)" → "Earlier years, counted the same way"; "Rung 2 · ages …, widening range" → "Counted now: ages … (years), a wider range"; Shape and size's "as the school page's Shape card" and "the shared classifier"; the area lines' "when more years are synced". |
| **SMT 4**, its build notes (the footer's "an empty state with the reason…"; the rail note) | **Fixed (M3).** "Admissions' figures, read-only. Where the school has no Admissions rivals at 11+, the view says why." The chart itself (the 10 nearest, the y axis) is build C (C1, C2). |
| **B3 sweep** | **Fixed (M3).** R-NO-BUILD-NOTES scans every component's and page's strings and JSX text (the TypeScript parser, so comments never count), the walks' word files, the catalogue's names, titles and methods, the notes a page shows, and the walks' words on the fixtures. It found and fixed: rule IDs in an Admissions tooltip, head office's value-added caption and a method; four methods' "(empty state)"; a document path in a method; the Admissions editor's "(0.7 r3, F7)"; the Comparisons map's "no base map in the walk"; the dumbbell note's "dashboard's … rail". |
| **Admissions 1** (sets editors first) | **Fixed (M4).** The sets card ("18 feeders · 10 rivals at 11+ — Who feeds us? · Who do we compete with?") sits above the two questions. |
| **Admissions 4, 5** (the dashboard button: a tint of the blue; less prominent in Mid) | **Fixed (M4)**, read as one note about the button (logged). The button is the section's own tint with its accent text, on every home (one component), in every theme, both pairs already contrast-checked. The Mid dashboard pages' plates are unchanged (logged: if Guy meant those, it is build C). |
| **Admissions 8** (start with the school) | **Fixed (M2).** "Your Year 7 cohort, year by year" is second: "How many have joined us at 11+, year by year?", then the pool, the map and the pool's trend. The walk is marked school-first: the rhythm check runs from its third screen (logged). |
| **SMT 1** (a loading graphic) | **Fixed (M4).** A turning ring with words in every dashboard view still loading (the shared Skeleton was a bare pulsing box, white on white in Mid), the SMT page, every walk's loading screen and a home tile's figure on its way. |
| **SMT 2, SMT 14** (the pills do nothing; no way into GCSE or Post-16) | **Fixed (M4).** The pills are buttons and switch the home's phase, remembered under the dashboards' own key, so the dashboard opens on it: Academic's figure is the phase's headline, Pupils' the phase's roll, Context's figure and walk the phase's ages; the Academic, Pupils and Context walks open at the level (`?level=`). Overview stays the whole school, as its dashboard does. The Chase at Post-16: 36.5 A level points per entry, +44 Post-16 pupils on last year. |
| **SMT 9 / D6** (Entry points) | **Fixed (M2).** Off the secondary SMT walk; kept on the SMT Pupils dashboard and on a primary school's walk (logged). |
| **SMT 15** (Our subjects) | **Fixed (M4, M5).** Under the SMT questions, a block per phase (one when a pill picks a phase), a card per subject (largest first, nine then "Show all"), each with its Candidates, Results and Comparisons walks and "Dashboard →". The dashboard opens on the subject for that visit (`?subject=…&from=smt`: shown, not saved) and skips Teacher's setup for an SMT reader (logged). |
| **Teacher 1** ("Coming"; no subject set) | **Fixed (M4).** "Coming" meant the home's figures weren't in (loading, or a failed request): the tile had no link without them. It never meant "no subject": with none set the home took the school's first subject silently. The Chase's GCSE model builds in under 2 s through the loader (production, read-only), so on 15 Nov the request most likely failed live; no log I can read holds its code. Now every tile starts its walk at once, a failed load says so with its code and "Try again", and with no subject set the home asks "Which subject do you teach?" (remembered in the browser; "Set your subjects for good" opens setup). |
| **Grouping decision** (15 Nov) | **Done (M1).** See below. |

## The subject families (Guy's grouping decision, 15 Nov)

Added to `src/lib/subject-match.ts` (`SUBJECT_FAMILIES`), each "{subject} (all titles)" in comparisons, each school's own title kept in its tables, a test each:

- **Religious Studies with Religious Education**, Post-16 (A level, AS, IB) and GCSE;
- **the Design and Technology A level titles**: Product Design, Engineering, Textiles Technology, Three Dimensional Design (A level and AS; the IB's plain Design and Technology and a BTEC 3D Design stay apart);
- **Drama and Theatre Studies with Theatre Studies** (IB), Post-16;
- **GCSE Art and Design with GCSE Photography** (GCSE qualifications; no Fine Art at GCSE).

English, Mathematics, Music, Classics and Computing titles stay separate (a test).

**A call to confirm:** in the data, Religious Education and Theatre Studies exist at Post-16 only as IB components. Matched inside one qualification, as Art and Design is, those two groupings would join nothing. So in these two families an IB component counts as the GCE A level (the AS stays its own): the comparator route, the area rows and England's family figure read the IB rows too. To keep IB and A level apart, set `acrossIB: false` on the two families.

## Figures that changed, before and after

On purpose, from the families; read through the walks' own loader on production (read-only), base 295f551 against the branch. Latest year shown.

| School, subject | Where | Before | After |
|---|---|---|---|
| The Chase, GCSE Art and Design (2025/26) | its 10 nearest | each school's Art and Design only | Art and Design and Photography merged: Christopher Whitehead 5.4 → 5.2, Nunnery Wood 4.6 → 5.1, Tudor Grange 5.4 → 5.3 (John Masefield, Oldcorne, The Chantry unchanged to one decimal) |
| The Chase, A level D&T Product Design (2024/25) | England | 32.8 | 32.9 (the D&T titles) |
| The Chase, A level D&T Product Design | Cleeve | Product Design only | Product Design and Textiles Technology (21.4; Textiles publishes no points) |
| Leighton Park, A level Drama and Theatre Studies (2024/25) | England | 38.3 | 38.4 (with the IB's Theatre Studies) |
| Leighton Park, Drama | Wellington | Drama only | Drama and Theatre Studies with Theatre Studies (52.2; the IB rows publish no points) |
| The Chase, A level and GCSE Religious Studies | nearest, England, LA | — | no change (no school nearby publishes Religious Education) |
| Every grouped subject | the comparison's name | the title ("Religious Studies") | "Religious Studies (all titles)" |

No other figure moves: the walks' answers and the SMT home's figures are the same reads, re-scoped only when a pill picks a phase. The group payloads aren't touched.

## Tests and parity

| Check | Base (build A's final run) | M1 59f3169 | M2 3625611 | M3 f3d059f | M4 e54c8cc | M5 82601e3 |
|---|---|---|---|---|---|---|
| eslint | 0 errors, 3 warnings | the same | the same | the same | the same | the same |
| build | pass | pass | pass | pass | pass | pass |
| tsc | clean | clean | clean | clean | clean | clean |
| Unit tests, one file per process | 100 files, 758 pass | 101 files, 763 pass, 0 fail | 101, 769, 0 fail | 101, 771, 0 fail | 101, 776, 0 fail | 101, 776, 0 fail |
| Catalogue unit | 77 / 77 | 77 / 77 | 77 / 77 | 77 / 77 | 77 / 77 | 77 / 77 |
| Rule tests (production reads, read-only) | PASS 197 | PASS 197, FAIL 0, ERROR 0 | PASS 199, 0, 0 | PASS 200, 0, 0 | PASS 200, 0, 0 | PASS 200, 0, 0 |
| PGlite, every suite (PostGIS ones with PGlite 0.5.5) | 29 / 29 | 29 / 29 | 29 / 29 | 29 / 29 | 29 / 29 | 29 / 29 |

**New rules:** R-WALK-ENDS-ON-ANSWER, R-WALK-RAIL, R-NO-BUILD-NOTES. **Extended:** R-SUBJECT-MATCH (the families; its runner adds `feedback-b.test.tsx`). `docs/catalogue/*.md` is regenerated.

**Rewritten, and why:**
- R-WALK-RHYTHM's statement: head office's walk rail is the walk's own (R-WALK-RAIL); the school-first walk. `walks-check.ts` skips the rhythm for a school-first walk's second screen.
- R-FRONT-DOOR-MOBILE: its two exceptions for the removed rail links are gone (`mobile-scan.ts`).
- R-HOME-TILES ("the SMT Context tile and its walk ask one address"): both now ask at the pills' level.
- build A's `feedback-a.test.tsx`: two assertions said GCSE Art and Design and D&T Textiles were in no family; they now say neither is in the A level Art and Design family.

**Parity:** no figure moved beyond the table above. The dashboards' seed SQL (`scripts/dashboards-seed-sql.ts --force`, every dashboard) is byte-identical on base and branch.

## Screenshots

In `docs/v0.8/feedback_b_screenshots/`, from the app's own components (`docs/v0.8/audit_scripts/feedback_b_preview`, build A's harness extended to the homes' sections), at 1440 and 390 in Mid, with Dark at 1440 for the main ones, beside Guy's (`*_guy_sNN.png`). Every picture was read as an image; none scrolls sideways at 390.

- SMT 7 and G1: the last window of SMT Academic (Leighton Park), Overview, Pupils, Teacher Post-16 Comparisons (The Chase, Art and Design), GCSE Results, Admissions Market share and Pipelines (Admissions 12), head office Academic (Harris);
- SMT 4 (s04): the rail, "More on the dashboard", the rewritten note; Admissions 2 and 7: the market walk's rail, the pipeline's captions;
- Admissions 8: the Pipeline walk's second screen; SMT 9 (s08): the SMT Pupils walk without Entry points;
- Admissions 1, 4: the Admissions home; SMT 2 and 14 (s02): the SMT home on Whole school and on Post-16, with Our subjects (SMT 15); the Academic walk at Post-16;
- Teacher 1 (s13): the GCSE home asking for a subject, and its failed state;
- SMT 1: a walk and the homes waiting on their figures.

Harness limits: the SMT context fixture is the whole school's at any level, so Context's figure doesn't change with the pill there; the Admissions entry points are stubbed as 11+ and 16+. The real Teacher dashboard opened from Our subjects isn't drawn (the harness draws walks and homes): it is on the live list.

## Guy's commands

The branch `v0.8-feedback-b` is local and not pushed. Its worktree shares the repository with `~/dev/vicdata_public`, so the branch is already there.

**1. Migrations:** none this round.

**2. Merge and push:**

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-feedback-b -m "0.8 feedback B: walks end on their answer; the rail steps along the walk; no build notes; the Admissions, SMT and Teacher homes; subject families" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own.** If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge:**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** none this round. No dashboard config changed: the seed SQL for every dashboard is the same on base and branch (dry-run diff empty).

**6. Set fixed:** none this round. These notes aren't feedback items.

**7. Live check** on vicdata.co.uk:

- **Teacher, The Chase, GCSE** (View as… → Teacher): the home asks "Which subject do you teach?"; the tiles start their walks at once and never say "Coming". If the figures fail, the note gives the error code: note it.
- **Any walk:** the rail lists only the walk's screens and a click steps along it; "More on the dashboard →" at its foot; the end window opens on the answer chart or table, with "Back to your home".
- **SMT, Leighton Park** (View as… → SMT): the Academic walk's end ranks the subjects, Mathematics strong, Chemistry to Further Maths needing attention; the Overview walk's market-share note reads for a teacher.
- **SMT home, The Chase:** GCSE and Post-16 switch the tiles (Post-16: 36.5 A level points, +44 pupils) and the walks; the full dashboard opens on the same phase; Our subjects' "Dashboard →" opens the Teacher dashboard on that subject without setup; the ring while it loads.
- **Admissions, Leighton Park:** the sets card above the questions; the dashboard button light blue; the Pipeline walk's second screen is "How many have joined us at 11+, year by year?"; the pipeline's captions read "Earlier years, counted the same way".
- **The families:** The Chase GCSE Art and Design, Comparisons: "Art and Design (all titles)", Nunnery Wood 5.1; Leighton Park A level Drama: Wellington listed with "Theatre Studies".
