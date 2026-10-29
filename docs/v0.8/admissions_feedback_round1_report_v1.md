# VicData 0.8: Admissions feedback round 1 (F-12 to F-21)

The round for `docs/v0.8/vicdata_0_8_admissions_feedback_round1_claude_code_prompt_v1.md`, on branch `v0.8-admissions-fb1`, from `main` at `030d546`. All ten items are Guy's, from 29 Oct, at Leighton Park (View as Admissions).

- **Every call** is in `docs/OPEN_QUESTIONS.md`, under "2026-10-29 — Admissions feedback round 1", items 1 to 28, each tagged.
- **Nothing was written to any database.** The session read `feedback_for_triage`, the live dashboard versions (to plan the republish), and the public reference data.
- **No migration this round.** The one database change is the **republish** of the two Admissions dashboards. It was written as SQL and tested in PGlite, and is **not applied**. It goes after the deploy (Guy's commands, below).
- **This was built on a second Mac** (`~/code/vicdata_public`). It had no Node, so Node 22 was installed with Homebrew and Chrome for Testing in the scratchpad. Its `.env` holds only the data project's keys. The app database's public URL and anon key were read from Supabase for the harness and the rule tests. **No service-role key was on this machine** (see Checks).

**Screenshots** are in `docs/v0.8/admissions_fb1_screenshots/`. They come from the Admissions preview harness, on fixtures from the branch's own route functions, at 1440 wide. Each is named `{leighton|chase}_{dark|light}_{item}.png`, and each item is shot at both schools in both themes. The map tiles read "API key required": the harness has no tile key. The dots are the app's.

## The items, as built

### F-13: "Why did our intake change?" (the Funnel, rebuilt)

**What it draws:** a waterfall from your entry cohort in 2019/20 to the latest year (2025/26), split into three parts, all in one area:
- **Births (cohort size):** how many children of the cohort live in the area.
- **Families moving:** the area's Year 6 against those births. More or fewer children of that age live in the area than were born there.
- **Your share:** your Year 7 against the area's Year 6.

At 16+ the area's Year 11 and your Year 12. No funnel at 4+.

**The method** (`src/lib/admissions/intake-change.ts`, pure; `intake.ts` reads the data):
- entry = births × (area Y6 ÷ births) × (your Y7 ÷ area Y6).
- The change is split by the log-mean (LMDI) method: each part = L × ln(factor now ÷ factor then), with L = (Y7 now − Y7 then) ÷ (ln now − ln then).
- The parts add up to the change exactly, whatever their order. They are rounded to whole pupils by largest remainders, so they still add up.
- An intake under 30 at either end makes each end a 3-year average, every figure alike.

**Which births source was used: ONS LSOA population (the ingest's `area_context`), with a stand-in age.**
- The LSOA single ages run from **mid-2011 to mid-2024**. They don't reach the 2019/20 cohorts' birth years (2008 at 11+, 2003 at 16+).
- As decided, the earliest age held stands in, at **both** ends: **age 3 at 11+** (mid-2011 and mid-2017) and **age 8 at 16+** (mid-2011 and mid-2017).
- The bar then reads "Cohort size", and the (i) says why.
- The LA-blend fallback wasn't needed.

**The area:** the school's catchment radius (below), never the feeder list.
- The view names it: "15 km around Leighton Park School (not your feeder list)".
- Its Area chip changes the radius for this view only.
- The (i) says how the radius was set, that boarding schools draw from beyond any radius (Leighton Park shows the note in the panel too), and that "families moving" includes children crossing the radius to go to school.

**The figures:**

| School, entry | Area | Your entry cohort | Births (cohort size) | Families moving | Your share |
|---|---|---|---|---|---|
| Leighton Park, 11+ | 15 km, 340 LSOAs | 47 → 57 (**+10**) | **−3** (aged 3: 7,112 → 6,754) | **+5** (Y6 per child aged 3: 1.03 → 1.14) | **+8** (0.6% → 0.7% of the area's Year 6) |
| Leighton Park, 16+ | 15 km | 82 → 90 (**+8**) | **+18** (aged 8) | **0** | **−10** |
| The Chase, 11+ | 12 km, 74 LSOAs | 208 → 236 (**+28**) | **−15** (aged 3: 1,213 → 1,132) | **+6** (1.09 → 1.12) | **+37** (15.8% → 18.7%) |
| The Chase, 16+ | 12 km | 130 → 136 (**+6**) | **+13** (aged 8) | **+8** | **−15** |

R-ADM-VIEW-INTAKE-CHANGE recomputes every row by hand from `area_context` and the census. It also checks that 4+ has none and that a saved feeder list changes nothing.

Screenshots: `*_f13_funnel.png`.

### F-13: Local births (new, next to the funnel)

The catchment's children aged 0 by mid-year (2011 to 2024), indexed against the school's region and England.
- The region and England come from ONS's LA estimates at age 0, summed.
- It is indexed to **2012**, the first year all three lines have.
- A second row of x-axis labels reads "Year 7 entry in" (16+: "Year 12 entry in"). Mid-2011's births reach Year 7 in 2022/23.

At Leighton Park (15 km), births fell from 6,928 in 2012 to 5,718 in 2024 (index 82.5). The South East fell to 83.3 and England to 83.0.

Screenshots: `*_f13_local_births.png`.

### The catchment (one rule for the funnel, local births and SMT Context)

- **Independent schools:** 15 km, as before.
- **State schools:** the density radius. This is the smallest whole-km radius holding the school's 5 nearest same-phase state schools (`nearest_schools`), from 2 km to the cap. **The Chase: the 5th nearest state secondary, Blessed Edward Oldcorne, is 11.07 km away → 12 km** (it was 5 km).
- **Unchanged:** the order (this view's own radius, else the School-Admin's saved catchment, else the default) and the caps.
- **Where it applies:** SMT Context, the routes behind it, the groups' projection table, Admissions' list editor and this round's two views. They all read the one rule (`src/lib/smt/catchment.ts`, `catchment-density.ts`).
- **The (i):** SMT's Area pill now says how the default was set, as does every funnel and births (i). For example: "12 km: the smallest radius holding the school's 5 nearest state secondaries (the 5th is 11.1 km away). The School-Admin can change it."
- **SMT round 4's catchment:** checked. Its 5 km state default is replaced by the density radius, so the funnel, local births and SMT Context draw one area. This changes every state school's SMT Context unless its School-Admin has saved a radius (OPEN_QUESTIONS 12).

R-ADM-CATCHMENT-RULE recomputes The Chase's 12 km from `nearest_schools` and checks that SMT and the funnel agree, at 12 km (The Chase) and 15 km (Leighton Park). R-SMT-RADIUS's expectation for The Chase moves from 5 to 12 km.

### F-12: tick marks and a middle label

Every Admissions line chart has a tick at every year, with the middle year labelled as well as the first and last (`LineChart`'s `ticks`, `yearTicks`). R-ADM-AXIS-TICKS checks every line view's SVG.

Screenshots: `*_f12_cohort_ticks.png`, and every line view.

### F-14: the school on the feeder map

The school is a solid Admissions-cyan dot, drawn last. It is sized by its entry cohort now (Leighton Park: 57 in Year 7), on the same scale as the feeders' pupils a year below entry, and the key reads "You, sized by your Year 7 now".

Screenshots: `*_f14_feeder_map.png`.

### F-15: Pipelines' Shape and size

- **The local shape** takes the left column, where "Your school" was.
- **Your feeders' shapes and sizes** replace the rivals. These are the current set a year below entry (Leighton Park: the 15 nearest primaries, aged 10), in the set's own order, each with its shape and XS–XL size.
- **Nothing moves to Market share,** which already has your school and rivals' shapes.

Screenshots: `*_f15_shape_feeders.png`.

### F-16: your cohort, girls and boys (new, last on the cohort rail)

The girls and boys at the entry age, year by year, with the girls' share under them against 50%. At Leighton Park the girls' share is 47% in 2025/26 (from 38% in 2019/20: 18 of 47).

Screenshots: `*_f16_girls_boys.png`.

### F-17: the featured row, in every product

- **The tokens:** one per product, in light and dark, in the three theme blocks of `globals.css`:

  | Token | Light | Dark |
  |---|---|---|
  | `--row-featured-admissions` | #d7f7fc | #163940 |
  | `--row-featured-gcse` | #daf7ed | #1a392f |
  | `--row-featured-post16` | #efeafe | #312b43 |
  | `--row-featured-smt` | #efeafe | #312b43 |
  | `--row-featured-groups` | #feebdc | #412c1d |

- **How each product picks its own:** each product's root sets `--row-featured` to its token.
- **Contrast:** text on the tint is 11:1 or better, and muted text is at least 6.3:1.
- **The tables tinted:**
  - Admissions' rivals table;
  - Teacher's ranking table, sort table and year table (the focus row, or the focus column);
  - groups' "against" table and the school picked on the map.
- **SMT:** its tables are by year, measure or subject, with no school rows to tint (OPEN_QUESTIONS 22 to 26 list the rest).

Screenshots: `*_f17_rivals_table.png`.

### F-18: Rivals' momentum

A line under the title reads "Schools submitting GCSE results only" (A level at 16+, KS2 at 4+).

Screenshots: `*_f18_momentum.png`.

### F-19: rivals' shapes, a row per age

Each small multiple has a row per age over the school's own ages (Leighton Park: 11 to 17). An age a rival doesn't teach is an empty row, so the rows line up with the school's bars. The scrolling is longer. Pipelines' feeder cards do the same over the local shape's ages (4 to 10).

Screenshots: `*_f19_rival_shapes.png`, `*_f15_shape_feeders.png`.

### F-20: entry age band roll, indexed

**In the panel:** you against the rivals' average, indexed to 2019/20 = 100. At Leighton Park, ages 11–15: you 109, the rivals' average 114.8. The average is over the rivals with a figure in every year.

**In full screen:**
- You and each rival, each in its own colour, with a key and labelled y gridlines.
- A rival under 30 pupils in the band at its base isn't drawn: an index on so few reads as a surge. It is named under the chart (Leighton Park: Red Balloon Learner Centre).

Screenshots: `*_f20_roll_indexed.png`, `*_f20_roll_fullscreen.png`.

### F-21: your share of Years 7–11 (new, last on the Trends rail)

Your share of the whole band (11+: ages 11–15; 16+: 16–18), year by year, as a share of the same group as the rest of Market share. Leighton Park in 2025/26: 6.1%.

Screenshots: `*_f21_share_years7_11.png`.

### The republish

The live Funnel shows the new waterfall once the code is deployed. The republish adds the new views to the published rails (Local births, girls and boys, the share of Years 7–11) and carries the new specs.

**Only the two Admissions dashboards:**
- Live GCSE Results (version 16), Post-16 Results, SMT Overview and SMT Pupils already differ from the code copy (compared by `jsonb` hash). The full seed would publish over them.
- A new `--only` option on `scripts/dashboards-seed-sql.ts` publishes the named dashboards and nothing else.
- Live Market share was still the 12 Oct seed, so it also picks up two titles corrected in code since then.

PGlite (`supabase/tests/v08_admissions_fb1_republish_pglite.mjs`) passes **11/11**:
- only the two Admissions dashboards move, one version each, equal to the code copy;
- an editor-published GCSE Results stays published;
- a second run publishes nothing;
- assignments and groups are unchanged;
- an unknown slug is refused.

The existing re-seed test (`v061_s2_reseed_pglite.mjs`) still passes 16/16.

## Checks

| Check | Result |
|---|---|
| tsc | clean (after the build has generated Next's route types) |
| eslint | 0 errors (main's 2 old warnings) |
| `next build` | clean |
| Server keys in client bundles | none (`.next/static` searched) |
| Unit (`src/**/*.test.ts`, `--env-file=.env`) | **535 / 535** over 65 files, each file run on its own. New: `intake-change.test.ts` (9), 5 density tests in `catchment.test.ts`, `featured-row.test.ts` (4). **`view-as-pages.test.ts` not counted:** on this machine it hangs after its first test, and it does the same on `main` (`030d546`, same exit), so it is this machine (no service-role key for View as), not the round. Please run it on `~/dev`. |
| Catalogue unit tests | **77 / 77** |
| Rule tests (real data, read-only) | **127 PASS, 0 FAIL**, MANUAL 15, NONE 19, SUPERSEDED 6 |
| PGlite | `v08_admissions_fb1_republish_pglite.mjs` **11 / 11** (new); `v061_s2_reseed_pglite.mjs` **16 / 16**. The other suites are untouched by this round (no migration) and weren't rerun. |
| Browser | 57 screenshots from the preview harness on the branch's fixtures, no page errors; phone width checked for the funnel |

**Rules:**
- **New:**
  - R-ADM-VIEW-INTAKE-CHANGE, R-ADM-VIEW-LOCAL-BIRTHS and R-ADM-CATCHMENT-RULE;
  - R-ADM-AXIS-TICKS, R-ADM-MAP-SELF, R-ADM-FEEDER-SHAPES, R-ADM-ENTRY-SEX, R-ADM-SHAPE-ROWS, R-ADM-MOMENTUM-SCOPE, R-ADM-ROLL-INDEXED and R-ADM-BAND-SHARE;
  - R-TABLE-FEATURED-ROW.
- **Superseded:** R-ADM-VIEW-FUNNEL and R-ADM-FUNNEL-SAME-AREA, by R-ADM-VIEW-INTAKE-CHANGE.
- **Updated:** R-SMT-RADIUS (The Chase's default is 12 km).
- `docs/catalogue/*.md` and the preset table (`docs/v0.6/views_preset_table.md`) are regenerated.

**One fix found by the full run:** R-ADM-BOARDING-ONLY-WHERE-BOARDERS expects a boarding school's funnel to keep the ISC note (international boarders aren't in the census). The new funnel had dropped it. It is back, beside the new boarding note.

## Parity

**Parity against `main` (`030d546`): nothing unexpected on screen.** Every difference is an allowed one, listed by item. The run used the branch at `453b44f`. The commits after it touch only the funnel's layout, its boarding note, one class on the x-label row (below), docs and screenshots. All reads went through each tree's own code, read-only. Harness copies, logs and Chrome profiles are in the session scratchpad (`…/scratchpad/parity/`).

| Harness | Pairs | Identical | Allowed | Noise | Unexpected | Failed |
|---|---|---|---|---|---|---|
| Admissions, per view (DOM) | 910 | 458 | 452 | 0 | 0 | 0 (128 page loads, 0 errors) |
| Teacher walker, all 7 case sets | 2,875 | 1,940 | 702 (F-17) | 233 | 0 | 0 (286 / 286 runs) |
| Teacher public-page SSR (137625, 117037) | 2 | 2 | — | — | 0 | 0 |
| SMT pages (PNG) | 152 | 136 | 16 (The Chase's Context, 12 km) | 0 | 0 | 0 |
| SMT pages (DOM) | 152 | 8 | 16 + 128 markup-only (fixed since) | 0 | 0 | 0 |
| Groups dashboards (DOM and PNG) | 192 | 77 | 114 | 1 PNG (identical on 2 rechecks) | 0 | 0 |

**Admissions:** compared view by view, because each rail's step numbers shift where a view was added.
- The rails differ only by additions: Local births; girls and boys; the share of Years 7–11.
- A line view counts as F-12 only if it equals main exactly once the ticks and the middle label are stripped.
- Every word difference is the round's own: F-12's middle labels, F-14's key, F-15's feeders, F-18's scope line, F-19's rows, F-20's index and average, and F-17's markup.

**Teacher:** the fixtures were byte-identical between the trees.
- All 702 differing pairs are in the Change, Ranking, Sortable and Trend tables, with equal words and size.
- 611 are one row band and 62 one narrow column (YearTable's focus column). The other 29 are under 8/255.
- That is F-17's tint.

**SMT:**
- **Fixtures:** they differ only in The Chase's Context (5 km → 12 km) and the catchment answer. Leighton Park's Context is unchanged at 15 km.
- **The 128 markup-only differences:** SMT draws with the Admissions line chart, and F-12 had added a `relative` class to its x-label row even where no middle label draws. The pixels were identical. It is now added only when a middle label draws (`charts.tsx`). With that class stripped, all 128 are identical.
- **Not in the walk:** the Area pill's new "how" line, because the walk keeps the menu closed.

**Groups:**
- **The projection table:** Harris's 58 state schools move off 5 km to their density radius, from 2 to 19 km; 26 land on the 2 km floor (dense London). Dukes' 25 stay at 15 km.
- **On screen:** F-17's tint on the group's own row.
- **The noise:** `harris_schools_dark_1440_s2` flaked once, as it did in the last parity run.

**Not covered:** the import graph puts three changed files in the Data View's client graph: `src/catalogue/admissions.ts`, `dashboards/admissions.ts` and `notes.ts`. These are catalogue data and wording the Data View doesn't draw. It has no harness among the four, so that is unverified here. The public page is identical.

## Guy's commands, in order

**1. Merge and push** (no migration this round). Run this from `~/dev/vicdata_public` on a clean `main`:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git fetch https://github.com/guyVicData/vicdata_public.git v0.8-admissions-fb1 && git merge --no-ff FETCH_HEAD -m "0.8 Admissions feedback round 1: why our intake changed, local births, one catchment rule, the featured row in every product" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**2. Render deploy.** It goes live with the deploy. Wait for "Deploy live" before step 3: the old code can't draw the new views, so republishing first would show them as "This view isn't drawn here yet".

**3. Republish the two Admissions dashboards** (it writes; project-ref check first). From the same checkout, now at the merge:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts --only vicdata.admissions.pipelines,vicdata.admissions.market-share > /tmp/adm_fb1_republish.sql && supabase db query --linked -f /tmp/adm_fb1_republish.sql && supabase db query --linked "select d.slug, v.version, v.label, jsonb_array_length(jsonb_path_query_array(v.config, '$.panels[*].dataviews[*]')) as views from dashboards d join dashboard_versions v on v.id = d.published_version_id where d.slug like 'vicdata.%' order by 1"
```

Expect:
- `vicdata.admissions.pipelines` on version 3, labelled "Republish (0.8 Admissions fb1)", with 16 views.
- `vicdata.admissions.market-share` on version 2, labelled the same, with 19 views.
- Every other dashboard on the version it had before: GCSE Results 16, GCSE Candidates 6, Post-16 Results 3, Post-16 Candidates 2, SMT Context 2, SMT Overview, Academic and Pupils 1.

**4. Mark F-12 to F-21 done** (it writes). Run it from the same checkout, where `HEAD` is still the merge commit from step 1:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && M=$(git rev-parse --short=7 HEAD) && supabase db query --linked "update public.feedback_items set status = 'done', resolved_commit = '$M', resolved_at = now() where number between 12 and 21 and status <> 'done'" && supabase db query --linked "select ref, status, resolved_commit, resolved_at::date from feedback_for_triage where number between 12 and 21 order by number"
```

**5. Check on the live site:** View as Leighton Park, Admissions:
- Pipelines: Why did our intake change?, Local births, the feeder map's blue dot, Shape and size, and the girls and boys view.
- Market share: the rivals table's tinted row, the momentum scope line, rivals' shapes, the roll (and its full screen) and the share of Years 7–11.
- Then View as The Chase, SMT Context: the Area pill reads 12 km and says why.
