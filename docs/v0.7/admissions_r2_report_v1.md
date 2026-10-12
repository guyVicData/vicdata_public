# VicData 0.7 — Admissions round 2 (the screens) report

Branch `v0.7-admissions-r2`, from `main` (`bfb6820`). Prompt: `docs/v0.7/vicdata_0_7_admissions_round2_views_claude_code_prompt_v1.md`. D1 is written and tested, **not applied**. Calls are logged under "2026-10-12 — 0.7 admissions r2" in `docs/OPEN_QUESTIONS.md`.

**Parity: clean.**

- **Teacher:** 2,875 / 2,875 pairs identical against `main`.
- **The Data View:** none of its modules changed.
- **The public page:** its whole server render is byte-identical for 137625 and 117037.

Admissions is additive.

## 1. What was built

| Stage | Commit | What |
|---|---|---|
| D1 | `4283126` | `20261107090000_v07_admissions_r2_sync_roles_nullif.sql`: the `nullif` guard on `sync_membership_roles`' claims cast, its own migration. PGlite test `supabase/tests/v07_sync_roles_nullif_pglite.mjs`: 12/12, failing before and passing after, with the body otherwise identical (`.out` beside it). **Not applied.** |
| D2–D4 (data) | `6037e54` | Catalogue: 4 families, the `entry_point` focus, 2 hosts, 5 view kinds, 33 dataviews, 4 measures, 12 renderers and 17 R-ADM rules, all appended after Teacher's. Dashboards `vicdata.admissions.pipelines` and `vicdata.admissions.market-share` (span-2 large view), seeded to Admissions and SMT only. Round 1's routes are extended additively; `/api/admissions/candidates` is new. |
| D2–D6, D8 | `0392f84` | `/teacher/admissions`: the page, every view, setup, People and My team, sharing, the home tile, export and copy to slides. |
| D7 | `a896242` | Admissions in the existing view editor. |
| fixes | `d98440a` | Fit fixes from the real-data walk; the entry-point axis honoured on the page; timings; logged calls. |
| report | (this) | This report and its screenshots. |

### D2 — the dashboards in the config system
- **Two published dashboards, one group** (`vicdata.admissions`), linked by the **Pipelines | Market share** switch.
- **Layout from the config.** Row "now" is column 1 plus **one panel spanning columns 2–3**; row "trends" is three panels. The page reads the published config, with the code copy (`src/catalogue/dashboards/admissions.ts`) as the fallback.
- **Its own host.** The member renderer draws Teacher's configs column by column and ignores spans, so the Admissions host lays the panels out itself and reads each rail from the config.
- **Phone (`Phone.dc.html`):** the entry point now, then the large view full width with its views as tabs, then row 2 as tabs.
- **Entry-point chips:** the school's `admissions_entry_points`, else the entry points its age range takes, then ±. The entry point is a **page axis** (`variants.ts`), appended after Teacher's so no Teacher state key changes.
- **Top bar filters:**
  - Day + boarding / Day only / Boarding only (on Market share: rivals with boarders);
  - All pupils / Girls / Boys;
  - State + independent.
  
  All of them pass through to the routes, which narrow the sets on the server.
- **Access:**
  - Admissions (lead or not), SMT, the School-Admin, and platform admins through View as (read-only).
  - **Home tile** for the Admissions and SMT lenses, and for a School-Admin on the Teacher lens. A teacher's home is unchanged.
  - Someone a list is shared with sees **the list only** (`SharedListsOnly`).
  - Library links and `/dashboards/vicdata.admissions.*` go to the page.
- **Seed:** `scripts/dashboards-seed-sql.ts` assigns each dashboard to its own roles: Teacher's as before (the SQL for Teacher's rows is unchanged), Admissions' to `admissions` and `smt`.

### D3 — Pipelines (`Main`, `Pipeline16`, `ShapeView`)
- **The entry point now:** four tiles, size by phase (the school page's `BADGE_ORDER` and `comparisonCaption`), the shape line with its stability since 2019/20, and the mini profile. The bottom row reads "LA context: Larger than the Worcestershire average" (the school page's caption).
- **Pipeline:** past pools, counted years solid, births dashed with their range band, and the projection only on request (11+).
  - Rung captions sit under the axis.
  - "Pool ▼ x% by 2030 against 2026" comes from the route.
  - Feeder flags: focus in green, red flag in red, figures on hover.
  - The header carries the feeder-list and LA-blend chips (the lead edits them; everyone else sees them read-only).
  - At 16+ the rung cards show, each with "Edit list" for the lead (`Pipeline16`).
- **Funnel:** births → Year 6 / Year 11 pool → entry, each stage labelled with its own source. A boarding school also gets the ISC note.
- **Map of feeders:** `ConsortiumMap` through **new optional props only**.
- **Feeder table:** pupils at the age, trend, flag, km, sector, gender, XS–XL.
- **Shape and size:** your profile by gender, the local shape (ages 4 to E−1), and rivals' shapes, described and not ranked.
- **Row 2:**
  - your entry-cohort trend (line, bars, table);
  - pool trends indexed against the LA and England, with the area population trend (ages 5–15) on the rail;
  - the share needed to hold numbers steady, labelled "A requirement, not a forecast".

### D4 — Market share (`MarketShare`, `RivalMomentum`, `RivalSubjects`)
- **Row 1, column 1:** rank at the entry age, market share, change in share, whole-school rank by roll, and "this group" in words.
- **Large view rail:** Donut · Ranked bars (with the donut) · Map of rivals · Table · Rivals' momentum · Strengths and weaknesses · Shape.
  - **Ranked bars** show each school's regional and England results rank; an unranked school says "IGCSE" or "none".
- **Momentum:**
  - the scatter in four quadrants;
  - the flag list, every flag with its figures on hover;
  - with no thresholds it says "flags not available yet" and never guesses.
- **Strengths and weaknesses:**
  - rank among the rivals with that area, the diverging gap, and its direction since 2022/23;
  - the flags;
  - the overall rank and England rank above;
  - a link to the subject explorer.
- **Row 2:**
  - you against the rivals' average (indexed);
  - the academic panel by entry point (4+ → KS2, 11+ → GCSE, 16+ → Post-16): the overall rank, then where you lead and trail, and the rivals not ranked and why;
  - market share, numbers, ranks, change and age-band rolls.
- **FE colleges:**
  - the college's own ILR under-19 series, labelled as FE participation data;
  - no share or rank, because the figures can't be matched honestly with the census (R-ADM-FE-SOURCE);
  - the empty state says why.

### D5 — Setup (`Onboard1`–`4`), the lead's
- **First visit:** a lead with no entry points is taken into setup. "Skip for now" holds for the session.
- **Everyone else** sees the defaults, with "The Admissions lead hasn't set these up yet".
- **The steps:**
  1. Entry points: 4+, 11+, 16+, another age; day and boarding, or day only.
  2. Day feeders: nearest 15, within x km, by LA, add by name; state and independent; same gender; a map, ticks, flags and XS–XL.
  3. Boarding feeders: independent preps with boarders, ages to 11 or 13, by LA; pick schools or keep a fuzzy set; the ISC note.
  4. Rivals: nearest 10/15, regional, my saved set (the comparison-set chooser's), or custom; narrowed by sector, boarding, gender and size S–L; the academic note.
- **Two more editors** open from the dashboard: the LA birth blend, and a 16+ rung's list.
- **Saving** goes through `/api/admissions/lists` and shows "Last changed by [name], [date]".
- **The School-Admin override needs an RLS change, so it is not built** (see §8, decision 1). A School-Admin sees setup read-only, with the reason.

### D6 — People, My team, sharing
- **People (School-Admin):**
  - an Admissions section with the lead badge, Make lead / Stop being lead, and how each Admissions role was granted;
  - the lead's grants;
  - the history from `platform_audit_log`;
  - Remove and Restore (the override, audited by round 1's triggers).
- **My team** (`/teacher/admissions/team`, the lead's): add to Admissions, or remove the people the lead added, through `admissions_set_member()`. Nothing else can be granted there.
- **Share the lists** (the lead and SMT): with a role, a team or a person. SMT removes only its own shares (round 1's RLS).
- **No RLS change** beyond round 1 and D1.

### D7 — the editor
The existing Data → View → Preview dialogue, with no new dialogue.
- **Step 1:**
  - the four families;
  - "Entry point: follows the dashboard's entry point";
  - compare options: Day feeders, Boarding feeders, Both, Rivals, Area (LA, region, England).
- **Step 2:**
  - each family's kinds of view, with look-only options for the five new kinds;
  - a fixed box listing what can't be edited: certainty styling, honesty wording, flag thresholds, shapes not ranked.
- **Step 3:** a live preview from the Admissions routes, and **Shows for: entry points**. Strengths is greyed at 4+ with the reason.
- **Rail menu:** its "Shows for" lists entry points through the same axis.
- **Edit bar:** an Entry point pill. The canvas previews Admissions panels live, and the span-2 panel uses the editor's existing span.
- **Rules:** every new view and family has an R-ADM rule with a real-data test (§3).

### D8 — export and meetings
- **Panel menu:**
  - **Print this view** prints the fullscreen view on its own.
  - **Copy to meeting slides…** uses Teacher's Copy this view dialog with a new optional `meetingOnly` prop. Absent, the dialog is exactly as before.
- **Slides** pin the school and the entry point, and draw live from the routes (`liveSlotRenderer` branch).
- **16:9 check** (`admissions_r2_screenshots/slides/`, The Chase 11+, each large view in a 2×2 span cell (750 × 696) and in one unit (327 × 300)):
  - Every large view fits a 16:9 slide in the **2×2 span** (the `2×2 + 1` layout).
  - At **one unit**, the pipeline, funnel, map and donut are readable.
  - **The feeder table, the rivals table, momentum, strengths and shape need the 2×2 span** (columns crush at 327 px). Recorded; no layout changed.

## 2. Screenshots

All are in `docs/v0.7/admissions_r2_screenshots/`. They are real data from the routes' own functions (`views-api.ts`), drawn by the built components in headless Chrome. The real Tailwind CSS is used, with a stubbed session. Lists are unsaved, so the defaults show.

- **`boards/`**: every wireframe board beside the build in dark and light (`pair_<Board>.png`): Main and MarketShare at 1440; Pipeline16, ShapeView, RivalMomentum and RivalSubjects as large-view crops; Phone and Onboard1–4 at 390. Also Market share at 390.
- **`clickthrough/`**: `c_<urn>_<entry>_<n>_<view>.png`, covering for each case the pipeline, the market-share large view, momentum, strengths, shape, and setup as the lead (day feeders). The cases:

  | Case | Entry points |
  |---|---|
  | The Chase 137625 | 11+, 16+ |
  | King's Worcester 117037 | 11+, 16+ |
  | Beaudesert Park 115786 (a 3–13 prep with boarders) | 4+, 11+ |
  | Nunnery Wood High 137051 (11–16) | 11+ |
  | Croydon College 130432 (FE) | 16+ |

- **`roles/`**: the roles walk (§4).
- **`slides/`**: the 16:9 check.

## 3. Checks

- **tsc:** clean.
- **eslint:** clean, apart from 2 warnings that exist on main.
- **next build:** clean.
- **Unit tests** (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`): **387 pass, 0 fail**. A new "Admissions in the catalogue" block covers:
  - the configs validate, with one span-2 large view;
  - Admissions dataviews come after Teacher's and no Teacher context offers them;
  - every family and view has a rule with a runner;
  - the entry-point axis comes last, and Teacher's state keys are unchanged;
  - the seed never gives Admissions to Teachers.
  
  Teacher-shaped tests are scoped to Teacher's dataviews and dashboards.
- **Rule tests** (`npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`): **PASS 49, FAIL 0**: round 1's 32 plus 17 new.
  - Families: R-ADM-FAMILY-PUPILS, -PIPELINE, -MARKET, -RIVALS.
  - Views: R-ADM-VIEW-NOW, -PIPELINE, -FUNNEL, -FEEDERS, -SHAPES, -TRENDS, -MARKET, -MOMENTUM, -STRENGTHS, -FLAGS, -ACADEMIC.
  - Others: R-ADM-FE-SOURCE, R-ADM-FILTERS.
  
  Each runs on real data. For example, The Chase's pool 2025 is 401, the funnel's births equal 8/12 of 2014 plus 4/12 of 2013 in the blend (5,424), and King's share is 6.60% of 1,531.
- **D1 PGlite:** 12/12. The round 1 RLS test is unchanged.

### Parity
The harness was rebuilt this round. Round 1's copy was deleted by a tmp cleanup on 12 Oct. Its scripts are now kept in `docs/v0.7/audit_scripts/parity_harness/`, so it can be re-run from there (`run_parity.sh`, README).

- **Run:** branch working tree against `main` `bfb6820`, 1,287 s. Fixtures from each tree's own fetchers, 10/10 byte-identical.
- **Teacher**, every panel × rail view × 1280/390 × both themes, over the 0.6.5 matrix, the 0.6.6 ranking cases and the saved-set cases. **No noise, nothing on only one side.**

  | Case set | Pairs | Identical |
  |---|---|---|
  | 0.6.5 matrix (`c5_0`–`c5_3`) | 2,306 | 2,306 |
  | Ranking cases (`rka`, `rkb`) | 497 | 497 |
  | Saved-set cases (`sv`) | 72 | 72 |
  | **Total** | **2,875** | **2,875** |

  - Three walker errors (`parameter 1 is not of type 'Element'`) hit Croydon cases in both trees, as in 0.6.7: a headless-Chrome flake.
  - The known flaky Comparisons map pair matched this time.
- **The Data View (pages and API routes):** 0 changed files in their import graphs.
- **The public school page:**
  - 2 changed files are in its graph: `ConsortiumMap.tsx` (new optional props, absent = as before) and `PhaseBreakdownCard.tsx` (two `export` keywords).
  - Its whole render (`renderToStaticMarkup`, live data recorded and replayed on main) is **byte-identical** for 137625 (64,747 bytes) and 117037 (73,399 bytes).
- **Negative control:** a planted label change was caught.
- **Existing pages that changed on purpose:**
  - the Teacher home (the Admissions tile, for Admissions and SMT and a School-Admin only);
  - People (the Admissions section, for the School-Admin);
  - the editor;
  - Library links for the two Admissions dashboards.
  
  The brief asks for each of these (D2, D6, D7). The Teacher dashboards themselves are unchanged (above).

### Speed (`docs/v0.7/audit_scripts/admissions_r2_timing.out`)
- **Warm server:** all four routes run in parallel, as the page calls them. They take **146–277 ms** (pipeline 136–277, shape 117–233, rivals 53–93, market 1–6), for The Chase 11+ and 16+ and King's 11+.
- **Client draw**, routes served instantly from fixtures, 3 runs:
  - first draw 50–67 ms;
  - entry-point switch under 10 ms;
  - large-view switch under 10 ms (routes cached for the visit).
- **Estimate:** warm first draw is about 0.3–0.5 s with the sign-in check, **under the 1.5 s target**. That is an estimate, not a live measurement: the gated localhost can't be browsed. Please time it live (§9).
- **Cold:** first calls take 2–12 s while the national populations load, as in round 1, once an hour per instance.

## 4. Roles walk (`admissions_r2_screenshots/roles/`)
| Role | Screen | What it shows |
|---|---|---|
| Lead | `r1_lead_dashboard`, `boards/pair_Onboard*`, `r1_lead_myteam` | Setup, My team and Share on the row head; editable chips; setup; My team (add, and remove the people the lead added) |
| Admissions member | `r2_member_readonly` | Everything, nothing editable (± disabled, chips read-only with the reason) |
| SMT | `r3_smt_share` | Everything, plus Share the lists |
| Teacher with a shared list | `r4_teacher_shared_list` | The list's schools only; `r4b`: no share means no Admissions |
| School-Admin | `r5_admin_people`, `r5b_admin_dashboard`, `r5c_admin_setup_readonly` | People: lead badge, Make lead, grants, history, Remove/Restore; the dashboard with the School-Admin note; setup read-only with the reason (§8, decision 1) |
| Platform admin, View as | `r6_viewas_readonly` | The View as banner, everything read-only |
| Home | `r7_home_admissions_lens`, `r7b_home_school_admin` | The Admissions tile |

The walk ran in the preview harness: real components, stubbed sessions. Saves are not exercised there; they are in your click-through (§9).

## 5. Deliberate differences from the wireframes
1. **Nav:** Teacher's own controls (View as, the account menu and the **theme toggle**) replace the board's single avatar.
2. **Lead / SMT tools** (Setup · My team · Share the lists) sit on the right of the "Now" row head. The board has no place for them.
3. **Size by phase** uses the school page's band names (Secondary, Sixth Form) and caption. The board's "Senior / 16+" were illustrative. Badge colours follow the board.
4. **Feeder flags** truncate to two names and "+n" on one line, with every school and figure on hover.
5. **Fullscreen** is on the large view only, as the boards show. Row 2 has none.
6. **16+ in the dashboard:** the chart is shorter so the rung cards fit 470 px, and the flags row moves to the feeder table (fullscreen has both). The Pipeline16 board is a taller large view.
7. **Projection:** 11+ only ("Projection: 11+ only" elsewhere). The board's 16+ "Projection to 2036" needs ONS projections at more ages (round 1 gap).
8. **Pool trends:** the LA and England lines show only the years `age_profile_aggregates` holds (2025/26 today), with a note. This is fixed by the backfill in §6.
9. **Ranked bars** keep the donut beside them, as the board does. "Donut" alone is its own rail view.
10. **Momentum:** dot colours follow the flags (amber rising, red falling, grey none), and a "not on the scatter: n" note appears.
11. **Strengths:** the "with these rivals" wording waits on §8, decision 2.
12. **Maps** use the CARTO light tiles in both themes (the existing component). Locally, tiles show "API key required"; Render has the key.
13. **Phone:** ranked bars drop the bar and results columns at 390.
14. **Setup:** the step is a screen tall with the list scrolling inside it, and "+ Add by name" is under the list.

## 6. Commands for you

**Apply D1** (app database):
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261107090000_v07_admissions_r2_sync_roles_nullif.sql && supabase migration repair --status applied 20261107090000 --linked
```

**Re-seed the dashboards** (adds the two Admissions dashboards, assigned to Admissions and SMT; Teacher's rows re-run unchanged):
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/vicdata_seed.sql && supabase db query --linked -f /tmp/vicdata_seed.sql
```

**Optional: fill the LA and England pool-trend lines.** This backfills `age_profile_aggregates` for 2019–2024. It is a service-role write to the app database. It logs each batch and stops at the first failure.
```
cd ~/dev/vicdata_public && for y in 2019 2020 2021 2022 2023 2024; do PERIOD=$y npx tsx --env-file=.env scripts/sync-age-profile-aggregates.ts || break; done
```

## 7. Logged calls
They are in full in `docs/OPEN_QUESTIONS.md` ("2026-10-12 — 0.7 admissions r2"). In short:
- **Page and catalogue:** its own host for the span; the entry-point axis; no figure computed in the browser (headline figures built on the server).
- **Filters:** what each means on each dashboard; empty states rather than substitutes.
- **FE colleges:** ILR, labelled, never shared into a group.
- **Flags:** feeder flags on the rung a year before entry.
- **Momentum:** its axes.
- **16+ layout:** rung cards under a shorter chart.
- **Projection:** 11+ only.
- **Size words and colours.**
- **Setup:** day only inferred; a fuzzy set saved as its matches; the blend kept on save.
- **Shares:** school-wide.
- **People:** reads its own rows.
- **Home tiles.**
- **Export:** meeting only, plus the slide fits.
- **Maps:** optional props.

## 8. Decisions for you
1. **School-Admin override on lists (decision 3).** It needs an RLS change, so it was **stopped and reported, not built**.
   - Round 1's list and entry-point write policies allow the lead only. Round 1's report said otherwise; that was true of grants.
   - Proposed: add `or public.is_school_admin_or_holder(school_account_id)` to both write policies, plus an audit trigger on list writes (`admissions_lists_override`) so the screen can say "changed by School-Admin".
   - Until then a School-Admin makes a lead in People (audited).
2. **Subject explorer "with these rivals."**
   - Either Teacher reads a `?set=urn,…` into its chooser (a small Teacher change),
   - or the rivals are saved as a shared comparator set.
   
   Today the link opens the Teacher subject dashboard for the stage.
3. **Backfill `age_profile_aggregates` 2019–2024?** It is the command in §6. Caveat: closed schools are left out of past years, a slight undercount.

## 9. Click-through for you
Wait for Render's "Deploy live". Then re-seed the dashboards and apply D1 (§6), and hard-refresh.
1. **Home** as an Admissions or SMT member: the **Admissions** tile. As a teacher: no tile.
2. **The Chase, Pipelines 11+:**
   - Year 7 now **236**, ▲13% since 2019/20;
   - the chart's past pools end at 382, with **Pool ▼ 10% by 2030 against 2026**;
   - Share needed: **58.9%** now, 68.4% of the 2030 pool;
   - hover a feeder flag for its figures;
   - the rail: Funnel (births 5,424 → Year 6 401 → 236), Map, Feeder table, Shape and size.
3. **Switch the entry point to 16+:** rung cards (secondaries, primaries, births), each with Edit list for the lead.
4. **Market share 11+:** 2 of 11, 17.9%; ranked bars with region and England ranks (Malvern St James shows "IGCSE"); then Momentum (hover a flag), Strengths ("2nd of 7 on Attainment 8 · 897th of 4,736 in England"), and Shape.
5. **The filters:**
   - Boarding only on Pipelines gives the "no boarding feeder list yet" state.
   - Independent only empties the default (state) sets.
   - Girls changes the figures.
6. **As the lead:**
   - Setup: change the day feeders and save, then see "Last changed by you".
   - Adjust the births blend.
   - My team: add someone, then remove them.
   - Share the lists with Teachers; as a teacher, open Admissions and see the list only.
7. **As the School-Admin:** People → Admissions: Make lead, see the history line, Remove then Restore.
8. **View as a platform admin, as Admissions at a school:** everything read-only.
9. **Editor** (Data → View → Preview on `vicdata.admissions.pipelines`): the Entry point pill; edit the Pipeline view (the families, the compare options, the fixed-rules box, Shows for entry points); save a draft and don't publish.
10. **Copy to meeting slides** from the Pipeline view, then open the meeting: the slide draws live.
11. **Croydon College 16+** (View as): the ILR series, labelled, with no share.
12. **Speed:** a warm reload of the page should draw in under 1.5 s. Switching entry point or view should be near-instant.
