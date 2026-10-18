# VicData 0.8: SMT feedback round 1 (F-1 to F-8, Leighton Park)

The round for `docs/v0.8/vicdata_0_8_smt_feedback_round1_claude_code_prompt_v1.md`, on branch `v0.8-smt-fb1`, from `main` at `9af5743`.

- **Every call** is in `docs/OPEN_QUESTIONS.md`, under "2026-10-18 — SMT feedback round 1", items 1 to 18, each tagged with its F-number.
- **Nothing was written to any database.** The session read `feedback_for_triage` (F-1 to F-8) once. Everything else is read-only lib reads, or browser tests whose writes are answered locally.
- **There is no migration this round.**

**Screenshots** are in `docs/v0.8/smt_fb1_screenshots/`, each as `*_before.png` (main) and `*_after.png` (this branch):
- SMT Overview: `smt_overview_{desktop,phone}_{light,dark}_*`;
- the map: `smt_map_desktop_*`;
- Admissions' Entry point now at 16+: `admissions_entry_now_*`;
- the feedback window's "Move to" offer: `feedback_move_offer_after.png`.

The harness stores the theme, so both "light" and "dark" shots render dark. Locally, the map's basemap reads "API key required": there is no map key on this machine, and the dots and keys are drawn as live.

## F-3 and F-4: SMT Overview, Scorecard

**What changed** (`src/lib/smt/overview.ts`, `views/Scorecard.tsx`):

**Rows by school type** (R-SCORECARD-ROWS-BY-TYPE):
- An IGCSE school has no Attainment 8 or grade 5+ row.
- The boarders row shows for a boarding school only. It is ranked among boarding schools:
  - in the set;
  - in the region, by name;
  - in England (`boarderPlaces`, from every GIAS boarding school's census boarders: `boardersByUrn`).
- A state school with published Progress 8 has a Progress 8 row.

**The set column** reads the set's short name (`setShortName`, `src/lib/set-short-name.ts`): "10 nearest". The full name is its tooltip and the first line of the (i). At 1440 the table no longer scrolls.

**"Since 2022/23" is now "Trends"** (R-TREND-PERIOD-PER-CELL). Each cell carries its own period:

| Row | Period |
|---|---|
| Roll, boarders | since 2019/20 |
| Attainment 8, grade 5+, A-level points | since 2022/23 |
| A-level value added | 2023/24 → 2024/25 |
| Progress 8 | 2022/23 → 2023/24 |
| Market share at 11+ | since its first entry year |

- **The (i) note:** one note says why the years differ (`SMT_NOTES.trendYears`). Its years come from `years.ts`: two new rules there, `SIXTH_FORM_VA_FROM` and `PROGRESS8_LAST_PERIOD`, the latter moved out of `overview.ts`.
- **Value added's later years:** its last year is read from the data. A synthetic 2025/26 gives "2023/24 → 2025/26" with no code change (`src/lib/smt-fb1.test.ts`).
- **F-4 is answered by the cell:** value added has two years and a trend now (The Chase +0.05; Leighton Park +0.07).

**Leighton Park's Scorecard** (on the default set):

| Measure | You | 10 nearest | South East | England | Trends |
|---|---|---|---|---|---|
| Roll | 581 | 6 of 11 | 597 of 1,631 | 3,514 of 9,138 | ▲ 18% since 2019/20 |
| Boarders | 136 | 3 of 8 | 59 of 196 | 133 of 514 | ▲ 36% since 2019/20 |
| A level: points per entry | 39.95 | 7 of 10 | 110 of 460 | 424 of 2,536 | +2.9 pts since 2022/23 |
| A-level value added | +0.09 | 7 of 10 | 171 of 462 | 813 of 2,553 | +0.07, 2023/24 → 2024/25 |
| Market share at 11+ | 4.9% | 8 of 11 | — | — | +1.0 pp since 2019/20 |

The two GCSE rows Leighton Park isn't ranked on are gone. The Chase's table gains a Progress 8 row: +0.08, 5 of 11, West Midlands 144 of 433, England 1,408 of 3,663, +0.02 2022/23 → 2023/24.

This also closes the to-do snag "Scorecard's 'Since 2022/23' heading over rows measured since 2019/20".

## F-8: SMT Overview, The school now

**What changed** (`src/lib/smt/entry-net.ts`, `views/Now.tsx`; R-INDEP-ENTRY-TILES):
- **Which tiles give way:** for an independent school, the "No comparable GCSE results" and "Progress 8, not published for independent schools" tiles give way to its entry tiles.
- **The tiles:** "Joining at 11" (the first year is Year 7), or "Net change at 11" (Year 7 minus last census's Year 6), and "Net change at 16" (Year 12 minus last census's Year 11).
- **What each tile shows:** the label, this year's number and one change since 2019/20. The arithmetic and the caveats are in the (i).
- **One calculation with Leaving at 16:** Pupils' "Leaving at 16" now calls the same function (`yearOnYear`). The test pins them: Net change at 16 equals minus Leaving at 16, for the same year.
- **State schools** keep today's tiles (The Chase unchanged).

**Leighton Park's new tiles** (January 2026 census, 2025/26):

| Tile | Shown | Arithmetic (the (i)) |
|---|---|---|
| Joining at 11 | **57**, +21% since 2019/20 | Year 7 57; the first year is Year 7 (GIAS 11–18), so every Year 7 pupil joined. Year 7 in 2019/20: 47. |
| Net change at 16 | **+3**, +10% since 2019/20 | Year 12 90 minus Year 11 last census 87. Year 12 in 2019/20: 82. Pupils' Leaving at 16 for 2025/26: −3 ("3 more joined"). |

King's Worcester (ages 2 to 19, with a Year 6): Net change at 11 **+27**, Net change at 16 **−18**.

**The % definition is a call for Guy** (OPEN_QUESTIONS 6): it is the change in that year group's roll since 2019/20. The alternatives are logged there.

## F-2: SMT Overview, Map

**What changed** (`views/SetMap.tsx`, `src/lib/map-radius.ts`, `Overview.rolls`):
- **Size:** every dot, the focus school's too, is sized by its whole-school roll, on the maps' shared square-root scale.
- **Colour:** dot and label are coloured on the roll trend:
  - green for Growing, amber for Steady, red for Shrinking;
  - by the shared 3-year rule (`rollDirection`: `ROLL_DIRECTION_SPAN`, the flat band), worked out on the server;
  - no new thresholds.
- **Labels:** each school's label gives its name, the whole-school roll with its year, and the trend word and % over 3 years, in the trend's colour.
- **The focus school** is ringed in SMT's purple.
- **Keys:** a colour key and a size key (the smallest and largest roll drawn) sit under the map.

## F-6 (and F-5, its duplicate): empty views leave the rail

**What changed** (R-RAIL-HIDES-EMPTY):
- **One rule** (`src/lib/rail-content.ts`): `visibleRail`, plus `activeWithContent`. A panel that would open on an empty view opens on the next one.
- **Each product's own `hasContent`:**
  - SMT: `src/components/smt/content.ts`;
  - Admissions: `src/components/admissions/content.ts`;
  - Groups: `groupHasContent` in `GroupDashboard.tsx`.
- **Teacher's hosts** already offer a view's button only when it has data.
- **What counts as empty:** a view is hidden only when the school has no data for it. A view that explains something (rivals not chosen, a level it isn't for, the IGCSE note, a reserved view) keeps its icon, as does one still loading (OPEN_QUESTIONS 12).

**Hidden today** (`docs/v0.8/audit_scripts/smt_fb1/rail-hidden.ts`):

| School | Hidden |
|---|---|
| Leighton Park | SMT Overview → Scorecard panel → **Flags** (no flags). Its phone tabs read Scorecard, Map. |
| The Chase | SMT Overview → **Flags** (no flags in 2025/26) |
| King's Worcester | Admissions Pipelines at 4+ → Trends → **Pool, indexed** (fewer than two past pools) |
| Beaudesert Park (115786), from parity | Admissions Market share at 11+ → **Strengths and weaknesses** (no area with rivals to compare); Pipelines at 4+ → **Pool, indexed** |

## F-7: SMT Overview, From Admissions → Market share

**What changed** (R-MARKET-DEFAULT-RIVALS):
- **The default:** where Admissions hasn't chosen rivals at 11+, market share is drawn against Admissions' own default (`defaultRivals`: the 10 nearest schools teaching Year 7). Admissions' Market share draws the same schools before rivals are chosen.
- **Where it says so:**
  - the tag: "read-only · rivals: the 10 nearest (default)";
  - the title: "against the 10 nearest schools (default rivals)";
  - the (i): `SMT_NOTES.marketDefault`.
- **Also affected:** Pupils' Market share, and the Scorecard's "Market share at 11+" row.

Leighton Park: 10 rivals, share 4.9%, the largest rival Maiden Erlegh School.

## F-1: Admissions Pipelines, Entry point now

**What changed** (`PairTile`, `src/components/admissions/ui.tsx`):
- **Each figure is boxed with its own label:** Day, Boarding; Girls, Boys.
- **The boarding tile** reads "in whole school". "in Year 12" is kept.

**The same boxing on every similar tile:**
- Admissions: Entry point now (Girls/Boys, Day/Boarding);
- SMT Overview: The school now (Day/Boarding, or Girls/Boys);
- SMT Pupils: now (Girls/Boys, Day/Boarding);
- Groups Overview: The group now (Day/Boarding);
- Groups Pupils: now (Day/Boarding, or Growing/Shrinking).

Groups' three-figure "By phase" tile is unchanged.

## The feedback system's two fixes

**F-5, "Move to <view>"** (R-FEEDBACK-FOLLOWS-VIEW):
- Each panel says which view it shows (`setPanelView`, from `CardBox`).
- When the rail moves while the window is open, the window shows "The panel now shows Flags. This feedback is still on Map." with a **Move to Flags** button.
- Moving keeps the draft. The window never silently keeps the old view.
- Browser test: open on Scorecard, the rail to Map, "Move to Map", the window on Map.

**F-1's `app_version` "dev":**
- Render does expose the deployed commit. `RENDER_GIT_COMMIT` is read on the server when an item is sent, and F-2 to F-8 carry `9af574369ae6`.
- F-1 was most likely sent from a local server.
- `appVersion` now gives "unknown" anywhere without the variable, and "dev" only under `next dev`.

## Checks

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors (the 2 old warnings, `PeerTrendChart.tsx` and `SchoolMap.tsx`). Main's `notes-feedback.test.ts` had 4 `react/no-children-prop` errors; that file now turns the rule off, with the reason (`next build`'s type check needs the render-function children as a prop). |
| `next build` | clean |
| Unit (`src/**/*.test.ts`, `--env-file=.env`) | **514 / 514** (508 + 6 new in `src/lib/smt-fb1.test.ts`; rerun after the short-name change) |
| Catalogue unit tests | **77 / 77** |
| Rule tests (real data, read-only) | **113 PASS, 0 FAIL** (107 + the 6 new; MANUAL 15, NONE 19, SUPERSEDED 4) |
| PGlite, all 21 suites (RLS, usage log) | all pass (PostGIS ones with `PGLITE_DIR`; `v08_view_as_editing` 44/44 through tsx) |
| Browser (`docs/v0.8/audit_scripts/smt_fb1/screens.mjs`) | **8 / 8**: Flags not on the rail, the Scorecard's rows and header, the entry tiles, the map's keys, Move to Map, F-1's boxes, no page errors, no writes |

**The new rules**, each with a runner in `scripts/catalogue-rule-tests.ts`; `docs/catalogue/*.md` regenerated:
- R-SCORECARD-ROWS-BY-TYPE;
- R-TREND-PERIOD-PER-CELL;
- R-INDEP-ENTRY-TILES (Leighton Park, King's Worcester with a Year 6, The Chase unchanged);
- R-RAIL-HIDES-EMPTY;
- R-MARKET-DEFAULT-RIVALS;
- R-FEEDBACK-FOLLOWS-VIEW.

**Runners updated for the new behaviour:**
- R-SMT-IGCSE-WORDING: no GCSE rows now;
- R-SMT-NOTES: the entry tiles in place of the two notes;
- R-SMT-VIEW-PUPILS-NOW and R-ADM-BOARDING-ONLY-WHERE-BOARDERS: the boxed tiles.

**Rule wording updated:** R-SMT-IGCSE-WORDING and R-SMT-P8-REASON.

## Parity

**Parity against `main` (`9af5743`), branch `49d8978`: no unexpected difference.** Every difference is one of this round's allowed changes: F-1, F-2, F-3/F-4, F-6, F-7 and F-8. Teacher, the Data View, the public page SSR and SMT subjects are unchanged. Nothing was written to any database: every read went through the read-only proxy.

**How it was run:** last round's pipeline, on a fresh base worktree at `9af5743`. On SMT and Admissions, F-6 removes rail icons, so every later shot in a walk shifts by one. Those shots were re-paired by the state each one shows.

| Harness | Pairs | Identical | Allowed changes only | Noise | Unexpected |
|---|---|---|---|---|---|
| Teacher (panel views) | 2,875 | 2,873 | 0 | 2 | 0 |
| Public page SSR (137625, 117037) | 2 | 2 | — | 0 | 0 |
| SMT dashboards and homes (re-paired by state) | 112 main / 108 branch states, 96 paired | 60 (Academic, Context, homes) | 36 paired, plus 16 main-only / 12 branch-only Flags states (F-6) | 0 | 0 |
| SMT group sets | 56 states | 28 | 28 | 0 | 0 |
| SMT subjects | 16 cells | 16 | — | 0 | 0 |
| Admissions (paired by shown state) | 318 paired | 240 text, 226 PNG | the rest; 10 unpaired states (F-6) | 0 | 0 |
| Groups dashboards | 68 states | 36 text, 34 PNG | 32 | 2 | 0 |
| Data View | 60 files | 60 | — | 0 | 0 |

**Notes:**
- **Teacher noise:** the walker scored one change map as unexpected: 137625, ranking pending. Its text is identical. The branch picture is byte-identical to last round's capture of the same case, and that code is now main. Main's picture this run differs from all 7 earlier runs, so the map draws a little differently each run. The other Teacher difference is one render-noise picture.
- **Two more views hidden at Beaudesert Park** (115786, boarding prep), both right under F-6:
  - the 11+ Market share rail loses Strengths and weaknesses (no subject area has rivals to compare with);
  - the 4+ Pipelines trend panel loses Pool, indexed, so it opens on its table.
- **Short names:** parity showed 16 characters cut group sets too hard ("All Dukes schools" became "All Dukes…"). After the parity run, `setShortName` was loosened: up to 22 characters, dropping a trailing " schools" first, so "All Harris Federation schools" reads "All Harris Federation". This changes only the set column's header text on those group sets.


## Closing the loop

Merged to main as `41c4d26` (`--no-ff`; tree identical to the branch). When it is deployed, mark F-1 to F-8 done in one statement, after the project-ref check. It writes: Guy runs it.

```sql
update public.feedback_items
set status = 'done', resolved_commit = '41c4d26', resolved_at = now()
where number between 1 and 8 and status <> 'done';
```

The trigger allows it from SQL, and keeps `resolved_at` if it is given. Then, read-only:

```sql
select ref, status, resolved_commit, resolved_at from feedback_for_triage where number between 1 and 8 order by number;
```

Then check each item on the live site through its Open link (`/platform/feedback`).
