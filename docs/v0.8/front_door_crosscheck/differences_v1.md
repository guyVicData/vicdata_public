# Front door design cross-check: the differences, board by board (M2)

Every design board in `docs/v0.8/front_door_design/png/` against the built screen, drawn from the app's own
components and the built CSS by the screenshot harness with real data (The Chase 137625 and Leighton Park
110110 for Teacher, SMT and Admissions; Ash Green Primary Academy 142990 for a primary school's SMT; Harris
Federation 3320 for head office). The side-by-sides (design left, build right, same scale) are the PNGs beside
this file, named after the board. Written before any fix (M2); M3 fixes the misses.

**Classes.** **Miss** (the build doesn't do what the board and the prompt ask: fixed in M3) · **Decided** (the
build differs on purpose and a decision says so: kept) · **Data** (only illustrative figures, names, dates,
counts: counted, not listed) · **Guy's call** (a real difference with no decision behind it: not changed,
listed with a recommendation, numbered G1–G10 as in the report).

Decision sources: P1 = `front_door_1_report_v1.md` and OPEN_QUESTIONS "front door, part 1"; P2 = Part 2's;
2b = 2b's; the prompts by decision number (B8–B17, C18–C20, D21–D23, F26–F29, G).

## Across every board

| # | Region | Difference | Class | Why / resolution |
|---|---|---|---|---|
| A1 | type | The boards set Inter; the app draws `body` in Arial (`globals.css`; Geist is self-hosted but only a variable), so every heading reads heavier and wider | Guy's call (G1) | App-wide: a typeface change moves every page of VicData, not a front door fix |
| A2 | header | The boards' header: a "V" tile, "VicData", the school's name, the avatar's initials. Homes and walks draw `TeacherNav` (Home, the menu, the account icon, Dark · Mid · Light), with no school name. (The admin and membership pages' `AdminChrome` does draw the V tile and the school's name.) | Guy's call (G2) for the school name; the nav itself Decided | P1 follow-up: the homes draw `TeacherNav`, whose switch is the control. Adding the name moves every dashboard's header |
| A3 | header | "Illustrative data" chip | Decided | The boards' own marker that their figures are made up (README); real data needs none |
| A4 | header | "SMT ▾" / "School admin ▾" role switch | Decided | P1 M3: the switch shows only for people with more than one role |

## Homes (Mid, 1280)

### `home_teacher.png` → `home_teacher.png`

| Region | Difference | Class | Resolution |
|---|---|---|---|
| section buttons | "Open the full GCSE dashboard": the board's glass (white 28% over the field) vs a solid white pill | Decided | P1 M2 (Mid's fields): small text on a field sits on white pills; Post-16's dark stop can't carry small text |
| Comparisons tile | "3rd of the 10 nearest" vs "4th of 4: us and the 3 nearest" | Decided | P1 M3: the count is honest (only those publishing the subject's points) |
| Post-16 Results tile | "B average grade" vs "45.8 average points" | Decided | P1 M3: DfE's points per entry, as the dashboard shows it |
| Also here | Board: Dashboards, Meetings, **My subjects** ("Geography, History · change"); build: Dashboards, Recruitment, Meetings | Guy's call (G3) | The prompt says "as today's homes have them"; today's have no My subjects |
| below the sections | "Show fewer questions" | Decided | B10 |
| Data | subject, figures, school name, next meeting | Data (6) | |

### `home_smt.png` → `home_smt.png`

| Region | Difference | Class | Resolution |
|---|---|---|---|
| Pupils tile badge | Board: the year-groups stack; build: the roll line (`AdmRollIcon`) | **Miss** | Fixed: the Pupils badge is `AdmShapeIcon` (SMT, primary SMT and head office) |
| Context tile | "+4% children nearby" vs "▼ 0.5% …" with the dashboard's arrow | Decided | 2b M1: ContextNow's own wording, word for word |
| Academic tile | "5.6 average points per GCSE" vs "40.0 A level: points per entry" | Data | Leighton Park is an IGCSE school: the shared IGCSE rule switches to post-16 |
| icon rows | order and glyphs of some screens differ (Overview's 3rd/4th, Pupils' last) | Decided | B12: walks are configuration; each icon is that screen's view's own rail icon (R-HOME-TILES) |
| under the tiles | the sets card ("2 comparison sets — Who do we measure ourselves against?") | Decided | D21 |
| Data | figures, roll change, meeting | Data (5) | |

### `home_primary_smt.png` → `home_primary_smt.png` (Ash Green Primary Academy, 142990)

| Region | Difference | Class | Resolution |
|---|---|---|---|
| line under the heading | the secondary SMT line ("The whole school first, then down to subjects…") vs the board's own ("How the school is doing, who is joining, and how many young children live nearby…") | **Miss** | Fixed: `PRIMARY_SMT_SUBLINE` when the school is primary only |
| note under the tiles | no (i) before "KS2 tests did not run…" | **Miss** | Fixed: the home's note carries the (i), as a panel's note line does |
| Academic tile | no figure; the card says why | Decided | P1 M5 (no KS2 views in SMT Academic) |
| Pupils tile | "−5 pupils on last year" vs "56 of 60 Reception places filled"; 5 screens, not 6 | Decided | P1 M5 (no view holds places; no "leaving at 16" at a primary) |
| Context tile | "▼ 13.8% children nearby, next 5 years" under "How many children are being born near us?" vs "−6% births nearby since 2019" | Guy's call (G4) | 2b M1 decided the projection for SMT's Context tile; the primary card's question is about births |
| Also here | board: Admissions ("Reception applications and offers"); build: Recruitment | Guy's call (G3) | as the teacher home's |
| sets card | present | Decided | D21 |
| Data | figures | Data (4) | |

### `home_group.png` → `home_group.png` (Harris)

| Region | Difference | Class | Resolution |
|---|---|---|---|
| chips | Board: "Head office · All schools · GCSE · Post-16"; build: "Head office · Harris Federation" | Guy's call (G5) | No decision either way; SMT's home draws its scope chips |
| Our schools | the line "Each opens its own SMT home" vs "Open any member school's SMT dashboards"; each card "Public page" (no SMT access granted in the fixtures) vs "Secondary · 1,120 pupils" | Guy's call (G5) for the line; the card's subline Data (access) | |
| Overview tile | "6 schools · 5,080 pupils" vs "59 schools in the group" | Decided | P1 M3: the group home route's summary |
| Pupils tile | "+1% on last year" vs "+6.2% combined roll over 3 years" | Decided | P1 M3 |
| Academic tile | "5.3 average points" vs "51.0 Attainment 8, group · England 47.6" | Decided | 2b M1 |
| Pupils badge | as SMT's | **Miss** | Fixed with SMT's |
| Data | 59 schools, names, figures | Data (8) | |

### `home_admissions.png` → `home_admissions.png`

| Region | Difference | Class | Resolution |
|---|---|---|---|
| icon rows | "#" first vs the Number tiles glyph; Market share's 4th a scatter | Decided | B14: the screens' own rail icons |
| entry point | "11+" vs "11+ (Year 7)" | Decided | B14: the dashboard's own entry names |
| Market share tile | "of the pool joined us" vs "of the intake: you and your rivals" | Decided | P1 M5 (Market share's own measure) |
| sets card | present | Decided | D21 |
| Data | figures | Data (4) | |

## The GCSE walks (Dark, 1280 × 900, The Chase, Geography)

Common to every screen (`walk_many_*`, `walk_well_*`, `walk_nearby_*`):

| Region | Difference | Class | Resolution |
|---|---|---|---|
| header | step dots sit beside the chip, not centred | **Miss** | Fixed: left group, centred dots, chip and step right |
| layout | the screen 1160 px wide vs the boards' 1060 | **Miss** | Fixed: 1060 (the homes keep 1160) |
| mini-map | names the column ("GCSE Context", "GCSE Comparisons") vs the dashboard ("GCSE Candidates", "GCSE Results") | **Miss** | Fixed: the dashboard the screen lives on, its column icons |
| rail | the catalogue's views for the host (Results' "Chart" on a Candidates screen), table views dropped and "As a table" added; no ↗ on views that open the dashboard | **Miss** | Fixed: the dashboard panel's own rail from its config, in order, its table view switching in place, ↗ on the others |
| panel header | Results "How well do they do in Geography?", Comparisons "How do we compare with schools nearby?" vs vocabulary §1's "How well do pupils do in Geography?", "How does Geography compare with other schools?" | **Miss** | Fixed (students at Post-16) |
| pill | "Compared against: Subject category" as one muted string vs the dashboard's pill (label, then the setting in bold) | **Miss** | Fixed: label and setting; no chevron (vocabulary §2: the pill is read-only in the walk) |
| footer | Back a filled tile vs an outlined button | **Miss** | Fixed |
| header question | well and nearby: the walk's question ("How well did they do?") vs the board's subject question ("How well do pupils do in Geography?") | Decided | B8/B13: the header carries the walk's question |
| header | "Illustrative data" | Decided | A3 |
| Data | figures, year, category name ("Humanities & Social Sciences"), number of subjects | Data (≈60 across the 17 screens) | |

Per screen:

| Board | Difference | Class | Resolution |
|---|---|---|---|
| `walk_many_1`, `walk_well_1` | the tiles: the lead figure 56 px in the text colour, icon above each tile's figure vs a large hero in the accent on its own plate, the icon beside the figure, a rise in the accent | **Miss** | Fixed (`Tiles`) |
| `walk_many_3`, `walk_well_4` | more than 10 subjects draw as horizontal bars (27 and 22 here) vs the board's upright bars | Guy's call (G6) | |
| `walk_many_5` | the dumbbell: no axis, no value at the dot, no "Change since" head, no square beside each name | **Miss** | Fixed (dumbbell.png's walk size) |
| `walk_many_5` | its note still calls it "a proposed view for the dashboard's Context › Trends rail" (it's on the dashboard since 2b) | **Miss** | Fixed |
| `walk_many_5`, `walk_many_6`, `walk_well_6` | "Proposed addition" chip | Decided | 2b put the dumbbell on the dashboard; the 10 nearest on the Area chart stays a proposal (P1 M5), said in the note |
| `walk_many_6`, `walk_well_6` | the key says "This school", "LA"; the line ends say "The Chase", "Worcestershire" | **Miss** | Fixed: the key names each line as its end does |
| `walk_well_6` | the lowest end label ("Worcestershire 4.6") sits on the year labels | **Miss** | Fixed: the stack of end labels stays inside the plot |
| `walk_many_6`, `walk_well_6`, `walk_nearby_5` | the last step's button "NEXT · Here's what you found" vs "FINISH · See what you found" | **Miss** | Fixed (every walk, the role walks too) |
| `walk_well_2` | grades "9" and "9 · 6%" vs "Grade 9" and "9 pupils · 6%"; no % axis | **Miss** | Fixed |
| `walk_well_2` | the pill reads Average points on the grades screen (board: Grade bands) | Decided | B12: Results walks use Average points throughout |
| `walk_well_5` | Geography against England vs the board's Humanities peers | Guy's call (G7) | |
| `walk_nearby_1` | no distance rings, the school not centred; distances not given | **Miss** | Fixed: centred, dashed km rings, each school's distance in the list |
| `walk_nearby_1` | no base map; numbered dots and a list | Decided | P1 M5 |
| `walk_nearby_2`, `_3` | ordered by value, no "average of the 10 nearest" line (board: by distance, with the average) | Guy's call (G8) | |
| `walk_nearby_2`, `_3` | long school names cut ("Christopher Whitehead Langua…") | **Miss** | Fixed: a wider name column |
| `walk_nearby_4` | ranks "1", "2" vs "1st", "2nd"; row rules in the text colour (bright white lines) | **Miss** | Fixed |
| `walk_nearby_5` | the place axis "1, 2, 3" and "Our place 5" vs "1st, 3rd" and "Rank 4th" | **Miss** | Fixed: places read as places |

## `other_roles.png` (the Post-16, Admissions and SMT walk outlines)

| Difference | Class | Resolution |
|---|---|---|
| Admissions: three walks on the board, two on the home (Pipelines, Market share) | Decided | `home_admissions.png` (later) and B12: one walk per home card |
| SMT and Admissions screen lists and wording differ from this "draft for discussion" | Decided | B12: the cards' icon rows (`home_smt.png`, `home_admissions.png`) set the screens; screens with no view left out (P1 M5) |
| SMT drawn violet | Decided | C20: SMT is orange |
| Post-16: the same three walks on Post-16 views | matches | |

## `vocabulary.png`

| Difference | Class | Resolution |
|---|---|---|
| §1 column questions in the walk's panel header | **Miss** | Fixed (with the walks) |
| §2 pill styling | **Miss** | Fixed (with the walks) |
| §3 the rail: same order, names, table views | **Miss** | Fixed (with the walks) |
| §4 colours | matches | |
| §5 labelling: the dumbbell's axis, the grades' % axis | **Miss** | Fixed (with the walks) |
| §6 proposed dashboard changes 1–6 (column questions on the dashboard, Area chart's 10 nearest, Context bars by category, full screen rail names, "Walk me through this", Grade distribution keyed) | Decided | Proposals, in no prompt; dashboards unchanged (dashboard parity) |

## `dumbbell.png`

| Difference | Class | Resolution |
|---|---|---|
| Walk size: axis, values, change head, squares | **Miss** | Fixed (`walk_many_5`) |
| Dashboard size: the "Average" row is the Context panel's group line, a per-year mean over every subject the group holds that year, so it takes in subjects the dumbbell leaves out. The Chase, English Language: all four Languages & Literature subjects drawn rose (+18, +16, +2, +16), the row read **▼ 14** | **Miss** (Guy's reviewer, item 1) | Fixed: the plain average of the rows drawn, the same subjects at both ends (now **▲ 13**); the board's "school average … the plain average of the 14 subjects". Full name "[group] average: the 4 subjects drawn, both years"; the card's note says "average of the 4 drawn" |
| Dashboard size: placed after Ranked change (board: after Actual) | Decided | 2b M2 (the prompt's order) |

## `themes_ladder.png` (dashboards, Dark and Light; Mid against the homes' Mid)

| Difference | Class | Resolution |
|---|---|---|
| Mid-tone section (Mint 80% over dark) | Decided | Superseded: 2b M3's Mid on dashboards |
| GCSE Results' Current panel in **Mid**: the third tile ("+0.4 above the England average") wraps to a second row and the panel's fixed height cuts it off. Dark and Light draw three across | **Miss** (Guy's reviewer, item 2) | Fixed: the tiles' minimum 5rem (was 5.5rem); Mid's field padding leaves the card ~265 px |
| a shut Trends bar shows a direction word ("→ Broadly stable") in the trend palette, not a figure in the accent | Decided | P1 M2: a shut bar's figure takes the accent (Context's "Current 236" does); the Trends bars carry a direction, coloured by direction |
| the boards' simplified columns (Candidates/Results/Context on one page, shut "Whole school" bars) | Decided | illustrative layout; the dashboards' panels are unchanged |

## Sets (`sets_library.png`, `sets_editor_feeders.png`, `sets_editor_rivals.png`)

| Difference | Class | Resolution |
|---|---|---|
| library: Sort menu, Folders, "⋯" row menus, the footer hint | Decided | P2 M1: round 1's library kept, recoloured |
| library sidebar: no Head office / Admissions sections | Decided | P2 M1 (round 1's sections; makers in the key) |
| editors: the map's base layer missing (light plate) | harness | CARTO tiles need the production key: live check |
| rivals: the line names no profile ("…a similar profile to yours" vs "…: independent, day and boarding, a similar size") | Guy's call (G9) | |
| editors: "This set now" reads Attainment 8 / A-level points, not "avg GCSE points" | Decided | P2 M1 |
| Data | sets, counts, schools, distances | Data (≈30) | |

## School admin (`admin_account.png`, `membership.png`)

| Difference | Class | Resolution |
|---|---|---|
| no Sign-ins and devices row | Decided | P2 M2 (Part 3) |
| Head office sharing only with a group account | Decided | P2 M2 |
| Mid draws the admin pages Dark | Decided | R-THEME-MID-SCOPE |
| membership: "seats" not shown; payments disabled ("Coming before the pilot ends") | Decided | P2 M2 |
| membership: "Other states of this page" column | Decided | the board's annotations, not UI |
| Data | counts, badges, dates, billing | Data (≈15) | |

## Screens with no board (against the prompts' words)

| Screen | Finding | Class |
|---|---|---|
| Welcome (A5) | one page: what VicData is for, the private beta, where feedback lives; then setup | matches |
| Setup (A6) | one screen, qualifications as headings, the live count, both phases at a two-phase school | matches |
| "New since your last visit" (A7) | one line, links to the changelog, gone once seen; an entry dated later than today is held back | matches |
| Changelog page | matches; but the seeded entry says "Mid gives the homes and walkthroughs their own colour", which 2b changed (dashboards too) | Guy's call (G10) |
| Phone (G), 36 screens at 390 | no sideways scroll on any; controls 44 px; the shell's nav under 44 px | matches; the nav Decided (P2 M3) |

## Totals

| Class | Count |
|---|---|
| Miss | **23** distinct (30 rows above: the vocabulary's four, the second Pupils badge and the dumbbell's walk size repeat walk rows): the walk header, width, mini-map, rail, column questions, pill and Back; the tiles; the dumbbell at walk size; its stale note; the dashboard dumbbell's average; key and end labels; end labels on the axis; Finish; the grades' labels and axis; the map's rings; cut names; ranks and row rules; places as ordinals; the Pupils badge; the primary SMT line; the home note's (i); Mid's clipped tile |
| Decided | 41 rows |
| Guy's call | 10 (G1–G10) |
| Data | ≈ 135 (not listed) |
