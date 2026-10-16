# VicData 0.8 — Group round 2: Overview and Schools — report

Report for `docs/v0.8/vicdata_0_8_groups_round2_overview_schools_claude_code_prompt_v1.md`. Built overnight, 15–16 Oct 2026, in the worktree `~/dev/vicdata_public_groups`, on branch **`v0.8-groups-r2`**. **Its base is `v0.8-audit-fixes` (4bfe5ec), not `main`.** The audit fixes stopped without merging (their report: one IGCSE question for Guy), and the overnight rule bases this round on their branch. Rebase onto `main` once they merge. **Not merged:** overnight, rounds push and wait for the morning.

**The figures are fixture data.** The prompt says to stop if the group lookups don't answer in production. Overnight they can't: the ingest round (`~/dev/vicdata` `feat/group-aggregates`) is dry-run only, and Guy promotes it in the morning. So everything here reads the ingest's dry run through a guarded test-and-preview switch, and every screenshot is marked `fixture-data`. The R-GROUP tests read through the same module and are written to rerun on production unchanged. That rerun is the morning step.

## What was built

- **Routes:** `/teacher/group/overview` and `/teacher/group/schools`. `/teacher/group` stays the head-office home. The switch reads Overview · Schools · Academic · Pupils, with Academic and Pupils shown as coming (disabled, "Coming in the next group rounds").
- **Who (A):** `src/lib/groups/dash-access.ts` decides, and `/api/group/dash` checks it on every request (`src/lib/groups/dash-server.ts`):
  - the group's head office (an active account);
  - a member school's SMT or School-Admin, only while the school holds a live grant (round 1's `liveGrant`: current member, grant open, made during this membership);
  - a platform admin through View as (read-only, never logged).
  
  Everyone else reads "Not found." The route tests cover another group's head office, a non-member school, a revoked grant, a school that left, a left-and-rejoined school, a grant on another group's account, a suspended account, and View as without that account.
- **The data layer:** `src/lib/groups/aggregates.ts` is the one module that reads the three ingest lookups (`group_aggregate_lookup`, `group_comparison_lookup`, `group_schools_year_lookup`), cached for an hour. `src/lib/groups/dash.ts` selects and words their figures (pure). No figure, n or exclusion is recomputed in the app. The one ordering made here is the rank within the group, over the lookup's school figures, ties shared, IGCSE schools out at GCSE.
- **The fixture switch:** `src/lib/groups/fixture-switch.ts`.
  - **On** only when `NODE_ENV` isn't `production`, `RENDER` isn't set, `VICDATA_GROUP_FIXTURES` is exactly `true`, and `VICDATA_GROUP_FIXTURES_DIR` names a directory.
  - **Never in a production build:** `next build` and `next start` set `NODE_ENV=production`, and Render sets both.
  - **Tests** (`fixture-switch.test.ts`) prove it fails closed, that only the data module reads it, and that it has no `NEXT_PUBLIC_` name.
  - **The fixtures** are in `docs/v0.8/groups_fixtures/`, copied from the ingest repo's `docs/group_aggregates_fixtures/`: dry run at ingest commit 7c4b423, lookups' SQL as of a4d9e49.
- **The control bar (B):**
  - the focus chips (All phases · Primary · Secondary · Post-16, only the phases the group has);
  - "Highlight a school" (it highlights the school across the table, the map, the scatter, the growing lines and the shapes; × Clear);
  - "Compared against" (peer groups, the default; non-group schools; the group's areas; England; mix-matched, labelled; up to three named groups), each with its set and n in the menu and its (i);
  - the reading pill: "Members at the time" (default) or "All schools listed now", each with its `GROUP_NOTES` line. For an undated source it says every listed school counts every year.
- **Overview (C):** column 1 "The group now"; the large view's rail (Against others, the default; Map; Joined and left); row 2 (the combined roll indexed, like for like, against the chosen set; results by phase, pupil-weighted with an "Average school" toggle; share of places by LA, with the regions beneath).
- **Schools (D):** column 1 (schools, combined roll, day · boarding, outside England, membership with confirmed and likely, joined and left); the schools table (sortable: roll, name, headline, national rank, trend), with the Map in its rail; row 2 (who is growing, size against results, shapes as small multiples).
  - **Each row opens:** for head office, the school's SMT read-only (`/teacher/smt?headOffice=`) where the school has its own VicData membership; otherwise, and for a member school's SMT, its public page.
  - **A row without results shows the reason,** never a blank: "IGCSE: not ranked at GCSE", "prep: no KS2 published", "outside England: no DfE data", "not yet open" or "no results published".
- **The home (round 1's):** the group card's Overview and Schools chips are live links. A member school's group card shows the same live chips when its SMT has the group view.
- **Usage:** product `groups`, with the dashboard, the focus and reading (`level` = `focus/reading`) and the comparison kind. Logged only for a member school's SMT (head office has no school). View as is never logged. Migration `20261114090000_v08_groups_r2_usage.sql` widens the product check (not applied; tested on PGlite).

## Each panel: its lookup, years and n

| Panel | Lookup | Years | n shown |
|---|---|---|---|
| The group now | `group_aggregate_lookup` (G2 `all` row, focus row) | latest census (2025/26); change from 2024/25, 2022/23, 2020/21 | schools, schools growing "of" (with both years), LAs, regions; outside England listed |
| Against others | `group_aggregate_lookup` + `group_comparison_lookup` (peer_band, non_group, areas, england, mix_matched, peer_named) | roll: 5-year like for like to 2025/26; each result its own latest year (Attainment 8 2025/26, A level 2024/25, KS2 2024/25) | schools behind each row, and the schools with each result in brackets; place in the peer band, ties shared |
| Map | `group_schools_year_lookup` | 2025/26 roll, 1-year trend | every current member; outside England listed beside it |
| Joined and left | round 1's `group_schools_lookup` | as dated | dated (GIAS) or "listed · last seen" |
| Combined roll, indexed | G2 rows + the chosen set's rows | 2019/20 to 2025/26; base named by the audit-fixes helper (`indexTo`) | like for like |
| Results by phase | G2 phase rows + the chosen set's | each measure's published years | n per point (hover) |
| Share of places | G2 `share` (LA and region) | 2025/26, trend from 2019/20 | pupils / area pupils per LA |
| Schools table | `group_schools_year_lookup` + G2 excluded lists | roll 2025/26; each headline's latest year | "Showing x of y · n with a headline, m with the reason" |
| Who is growing | `group_schools_year_lookup` | 2019/20 to 2025/26 | growing "of" |
| Size and results | `group_schools_year_lookup` | 2025/26 | schools with both figures |
| Shapes | `group_schools_year_lookup` (`roll_by_age`) with the app's own shape classifier | 2025/26 | each school |

## Dukes, as shown (G0)

Dukes Education: **26 schools, 25 in England, combined roll 6,392 in 2025/26.**
- **Change, combined and like for like:**
  - 1 year: ▼ 8.9% both ways (23 of 25 schools shrank);
  - 3 years: ▼ 5.9% combined, ▼ 8.6% like for like;
  - 5 years: ▼ 6.5% combined, ▼ 10.7% like for like.
- **Since 2019/20:** ▼ 10.5% (7,144 → 6,392).
- **Cardiff Sixth Form College** is counted in the 26 and listed as "outside England: no DfE data", in Current, in the Schools table and beside the map.

G0's explanation (the ingest report): the 8.9% is real, a fall across almost every school, not a membership artefact. Independent schools nationally fell 3.7% over the same year. The one artefact is in the multi-year figures, and the ingest corrects it: Orchard House (Ealing) was amalgamated into Orchard House (Hounslow) in August 2024, and its history now counts with it.

## Differences from the wireframes

- **Not built:**
  - the "Open schools" pill (Main);
  - the "Confirmed + likely" filter (Schools);
  - the "Sponsor record 3319: same body, shown once" chip;
  - "Other independents nearby" in the scatter.
  
  No lookup holds the last two. The reading pill and "Highlight a school" are built instead of the first two (they're in the prompt).
- **The roll column is "Roll, 5 years", like for like,** not "since 19/20". The lookups store 1-, 3- and 5-year change, and a set's combined change moves as schools join groups.
- **Size spread:** each school against its own phase nationally (the app's size badges), not "in its LA" (the wireframe's note).
- **Against others: five rows by default.** Mix-matched rows appear with the "Mix-matched" toggle; named groups appear when added, from "Add to the comparison" or the pill.
- **The fixture banner** ("Fixture data: the ingest's dry run, not yet promoted") shows only on fixture data, never in production.
- **At 1440 the focus chips wrap to a second line in the bar** (the group's name and type are longer than SMT's).

## Rules

| Rule | Test | Result (fixtures) |
|---|---|---|
| R-GROUP-COUNTS: every figure shows its n, equal to the lookup's | `src/lib/groups/rules.test.ts` | pass |
| R-GROUP-MISSING: every member school in the table, with a figure or a reason | same | pass |
| R-GROUP-READING: both readings give the lookup's figures; the default is at the time | same | pass |
| R-GROUP-PEERS: no self-declared group in a peer set; the band is the ingest's (MATs 41+, 16 trusts; independent companies 21–40) | same | pass |
| R-GROUP-HARRIS-ROLL: Harris' combined roll = the sum of its schools' census rolls (42,940 at the time; 48,960 listed now; the ingest's G5) | same | pass |
| R-GROUP-DUKES: Dukes' roll and change = G0's corrected figures; Cardiff outside England | same | pass |
| R-METHOD-PRESENT (group views): every view's method, filled from the lookups' metadata | `src/lib/groups/methods.test.ts` | pass |
| R-GROUP-NOTES: the four honesty lines, locked, used by the dashboard | same | pass |
| The fixture switch can't be reached in production | `src/lib/groups/fixture-switch.test.ts` | pass |
| Route access, every path | `src/lib/groups/dash-access.test.ts` | pass (9) |

**On production in the morning:**
```
cd ~/dev/vicdata_public_groups && npx -y tsx --env-file=.env --test src/lib/groups/rules.test.ts
```
It says which source it read ("[R-GROUP] reading the production"). If a figure differs from the fixtures, don't merge.

## Checks

| Check | Result |
|---|---|
| tsc | clean, apart from `LayoutProps`, which `next build` generates (as on the base) |
| eslint (changed files) | clean |
| next build | clean |
| Unit tests (every `src/**/*.test.ts` + `scripts/catalogue-unit-tests.ts`) | **478 / 478** |
| Rule tests (`scripts/catalogue-rule-tests.ts`, production reads) | **96 pass, 0 fail** (MANUAL 15, NONE 19, SUPERSEDED 4). The full run gave 95: R-SMT-YEARS' LSOA rehearsal hit a production statement timeout; it passes alone |
| RLS (PGlite), every test in `supabase/tests` | groups r1 **102 / 102**; usage log **19 / 19**; this round's usage migration **10 / 10**; admissions 111/111; v06 51/51 and the rest pass; SMT r3 21/21 and r4 31/31 (PostGIS PGlite 0.5.5). **1 fail, not this round's:** `v08_subject_latest_names` (the migration's inlined map has 31 names, the app's now 47; neither is touched here) |
| Teacher parity (`run_parity.sh`: every case set, both trees on the same fixtures; branch vs 048206f, its first base, and the `src/` and `supabase/` diff is byte-identical on the final base) | **2,875 pairs: 2,874 identical, 1 render noise, 0 unexpected**; fixtures 10/10 byte-identical. The import graph shows the changed files in Teacher's graph: `notes.ts` (new `GROUP_NOTES` keys), `GroupHome.tsx` and `SchoolGroupTile.tsx` (live chips, which only a group account or a granted school draws), and `data-view-cards.ts` (`SHAPE_LABELS` exported). One error file (130416 points, a fixture gap) is on both sides |
| Admissions parity (every view of both dashboards, 3 schools × entries × themes × widths) | **328 / 328 identical**, pixels and DOM, 592 panel-views |
| SMT parity (Overview, Academic, Pupils, Context and the Teacher home; The Chase and Leighton Park; both themes; 1440 and 390; every rail view) | **312 pairs: 301 identical, 11 render noise.** DOM identical in all 156; max channel difference 1–2 of 255 |
| Public page (SSR, live data recorded, then replayed) | **identical** (137625, 117037) |

## Screenshots (`docs/v0.8/groups_r2_screenshots/`, all fixture data)

- Harris Overview with each "Compared against" choice: `harris_overview_compared_{peer_band,non_group,areas,england,mix_matched,peer_named}_fixture-data.png`.
- Dukes Schools in light: `dukes_schools_light_1440_fixture-data.png`.
- Both dashboards for both groups, both themes, 1440 and 390: `{harris,dukes}_{overview,schools}_{dark,light}_{1440,390}_fixture-data.png`.
- The head-office home with live chips: `harris_home_live_chips_dark_fixture-data.png`.
- The negative route ("Not found."): `negative_route_not_found_fixture-data.png`.
- **Not taken overnight:**
  - **A member school's SMT and a non-member's public page, opened from the Schools table:** the pages themselves are round 1's and the public page's (unchanged here; round 1's screenshots show head office's read-only SMT). The table's links are tested by the builder: head office plus the school's VicData membership opens `/teacher/smt?headOffice=`, everything else `/schools/{urn}`. Take both live after the promote.

The harness is in `docs/v0.8/audit_scripts/groups_r2_preview/` (files end `.txt`): `cap.mts` captures the route's own builders on the fixtures, `recap.sh` rebuilds, `snap.sh` shoots.

## Not applied

- **The usage migration** (app database). After the merge:
  ```
  cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261114090000_v08_groups_r2_usage.sql && supabase migration repair --status applied 20261114090000 --linked
  ```

## Logged calls

Under "2026-10-16 — 0.8 groups r2" in `docs/OPEN_QUESTIONS.md`. All are "decided overnight, for Guy to confirm".
