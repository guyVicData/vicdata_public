# VicData 0.8 SMT round 3: Context on real data

Branch `v0.8-smt-r3`, from `main` (`0946489`), 14 Oct 2026. Prompt: `docs/v0.8/vicdata_0_8_smt_round3_context_data_claude_code_prompt_v1.md`. Calls are logged under "2026-10-14 — 0.8 SMT r3" in `docs/OPEN_QUESTIONS.md`.

**SMT Context now reads the ingest's real data, through its anon lookups only:**
- residents within 5 miles and by local authority;
- deprivation of the school's neighbourhood and of the children around it;
- free school meals for the school, its LA and England.

**The map** shades neighbourhoods once the LSOA boundaries are loaded. Until then it draws round 2's LA map. Pupils' row-2 population line now reads ONS residents.

**Every K6 figure matched the lookups**, as listed below; nothing was adjusted to fit.

| Stage | Commit | What |
|---|---|---|
| K0 | `a6370b1` | `lsoa_boundaries`: migration (tested in PGlite with PostGIS, **not applied**), load script |
| K1–K6 | `b20489c` | Context's server reads, views, map, rules; Pupils' row 2 |
| Report | (this commit) | report, logged calls, screenshots |

## Checks

| Check | Result |
|---|---|
| tsc, eslint, build | Clean (eslint: the 2 warnings already on `main`); new route `/api/smt/context/map` |
| Unit tests | **424 / 424** (`main`: 423; 2 new, 1 replaced) |
| Rule tests | **86 pass, 0 fail, 0 error** (3 superseded, including R-SMT-DATA-GAP) |
| RLS (PGlite) | Admissions RLS **111 / 111**; groups r1 **102 / 102**; the other suites all pass. The re-seed test fails 5 of 16 **on `main` too**: it still expects the original four Teacher dashboards (logged) |
| K0 (new, `v08_smt_r3_lsoa_boundaries_pglite.mjs`) | **21 / 21** |
| Usage-log test | **19 / 19** |
| Teacher parity | **2,875 / 2,875 identical**: full run 2,874 plus one map pair in the ranking set (a Teacher map, which doesn't use the changed component; same circles, fitted a few pixels apart); that set rerun **229 / 229**. Fixtures 10/10 byte-identical; the negative control was caught. (A first run drew nothing: another session's web server held the harness's port; rerun on a free one.) |
| Admissions parity | **328 / 328 identical**, pixels and DOM (592 panel-views) |
| Public page SSR | **Identical** (137625, 117037) |
| Groups r1's views | **36 / 36 identical** (group home, Access, head office's SMT Overview and Pupils, Platform, the school's home; both themes, 1440 and 390). One pair first differed by render noise, then matched twice |
| SMT Overview, Academic, Pupils | **24 pairs, main vs branch, same fixtures:** Overview and Academic identical (16/16); Pupils identical except row 2's Area panel at 1440 (the residents line, K5): the only allowed change. On the phone that panel is behind a tab and identical |
| Server keys in client bundles | None |

**Changes outside SMT Context and Pupils' row 2 (none visible):**
- `ConsortiumMap` gained four optional props (`circle`, `fitCircle`, `markerOf`, `redrawKey`). With none passed it draws exactly as before; only Context passes them.
- `MenuChip` gained an optional `menuWidth` (210 by default, as before).
- Admissions' and groups' views, which use both, are identical above.

## K0: LSOA boundaries

- **Edition:** ONS "Lower layer Super Output Areas (December 2021) Boundaries EW **BGC (V5)**". It is generalised to 20 m and covers England only: 33,755 LSOAs, all read by the load script's own paging (checked).
- **Why BGC and not BSC:**

  | | BSC (super-generalised) | BGC (generalised) |
  |---|---|---|
  | All England, GeoJSON at 5 dp | 7.8 MB | 38.8 MB |
  | Points per LSOA (median) | 8 | 41 |
  | Acland Burghley's 6-mile area | 0.23 MB | 0.96 MB |

  At the 5-mile zoom an inner-London LSOA is a few hundred metres across, and BSC's 8-point shapes overlap and leave gaps. BGC keeps them readable.
- **The table:** `lsoa_boundaries` (gss_code, name, geom MultiPolygon 4326, source_dataset, fetched_at). It has a GiST index and RLS on, and anyone may select (public geography, as `la_boundaries`).
- **Writes:** only through `ingest_lsoa_boundary()`, for the service role and English codes only.
- **Reads:**
  - **`lsoa_boundaries_geojson(p_gss_codes)`**, as asked: only the codes given (up to 5,000), GeoJSON at 5 dp, area in hectares.
  - **`lsoa_boundaries_near(easting, northing, metres)`** (capped at 20 km) is added and logged. `school_context_lookup` returns how many LSOAs it counts within 5 miles, but not which. The app asks this RPC which LSOAs lie near the school, then reads their figures and population-weighted centroids from `lsoa_context_lookup`.
- **Within 5 miles** uses the ingest's own rule: an LSOA's population-weighted centroid within 5 miles. The count equals `lsoa_count` for all three check schools: The Chase 34, Leighton Park 192, Acland Burghley 1,121.
- **The ring:** every LSOA whose boundary comes within 6 miles, a mile beyond the circle. The map is fitted to the 5-mile circle, which is drawn as a thin dashed line, so the shading runs on into the frame's corners with no hard edge.
- **Inner London (Acland Burghley), the worst case:**

  | | |
  |---|---|
  | LSOAs drawn | 1,671 (1,121 counted within 5 miles) |
  | Payload | 1.32 MB raw, **262 kB gzipped** (The Chase 28 kB, Leighton Park 58 kB) |
  | SQL on all 33,755 boundaries | `lsoa_boundaries_near` 153 ms, `lsoa_boundaries_geojson` 54 ms (PGlite with PostGIS, slower than Postgres; The Chase under 10 ms) |
  | Render (headless Chrome) | **~0.39 s** from the payload arriving to the neighbourhoods drawn |

  Over 200 neighbourhoods draw on one canvas layer; fewer stay SVG.
- **Fallback:** until the table has rows, or before the migration, the RPC answers "no such function" or nothing. The map then draws round 2's LA shading with "shading by district", and "Shade by" offers only children and free school meals. Both states are tested (R-SMT-CONTEXT-GEOGRAPHY), and both are in the screenshots.

**Apply, load, check** (Guy; app project). The load takes a minute to read ONS's pages, then writes 33,755 rows:
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261111090000_v08_smt_r3_lsoa_boundaries.sql && supabase migration repair --status applied 20261111090000 --linked && npx tsx --env-file=.env scripts/ingest-lsoa-boundaries.ts && echo "select count(*) as lsoas, count(*) = 33755 as all_england from public.lsoa_boundaries;" > /tmp/lsoa_count.sql && supabase db query --linked -f /tmp/lsoa_count.sql
```

**The re-seed** (the Context rail gained "Children nearby over time"). Only Context gets a new version; the others' configs are unchanged:
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/vicdata_seed.sql && supabase db query --linked -f /tmp/vicdata_seed.sql
```

## The panels

| Panel | Reads | Years |
|---|---|---|
| **The area now**: children of the level's ages within 5 miles | `school_context_lookup` (children[19], ages summed) | mid-2011 → latest held (mid-2024), change since the first |
| …the census line beside it | census, schools within 5 miles teaching the ages (round 2) | latest census (2025/26) |
| …births | ONS births by LA (round 2) | 2012 → latest |
| …"{ages}s by {year}" | `ons_snpp`, the LA's districts summed over the ages | latest LA estimate → +7 (2025 → 2032) |
| …schools nearby, place line | round 2 | — |
| **Social context**: the neighbourhood's IMD and IDACI deciles | `school_context_lookup` (IoD2025) | the edition the lookup names |
| …children within 5 miles by IDACI decile | `school_context_lookup` (`idaci_mix`) | as above |
| …free school meals | `dfe_school_fsm` (the school); `dfe_fsm_geography` (LA via `la_gss_crosswalk`, and England) | 2019/20 → latest (2025/26) |
| **Map**: neighbourhoods | `lsoa_boundaries_near`/`_geojson` (app) + `lsoa_context_lookup` | latest LSOA year |
| …schools coloured by FSM | `dfe_school_fsm`, schools within 5 miles | latest |
| …the LA (Area pill) and the fallback | round 2 (`la_boundaries`, census) | latest census |
| **Population by age** (rail and row 2) | within 5 miles: `school_context_lookup`; LA: `ons_population_age` | latest mid-year, ages 0–18 |
| **Births and projections** (rail) | ONS births; `ons_snpp` over the ages | births 2012 →; projection to +11 (2036) |
| **Children nearby over time** (rail, new) | `school_context_lookup`; `ons_population_age` for the LA and England (all E06–E09 summed) | 2011 → latest, indexed to 2012 |
| **Births, indexed** (row 2) | unchanged | 2012 = 100 |
| **"Secondary-age population, projected"** (row 2; primary or sixth-form by the ages) | `ons_population_age` to the latest mid-year, then `ons_snpp`, dashed | 2012 → 2036 |
| **Pupils, row 2: "The area's school-age population"** | `ons_population_age`, the LA's residents aged 5–15 (or the level's ages); caption "ONS mid-year estimates, residents" | mid-2019 → latest |

**The level picks the ages:** GCSE 11–15, Post-16 16–17, Primary 4–10, Whole school the school's statutory range (The Chase and Leighton Park 11–18).

**Counties are summed from their districts:** ONS population and projections have no county rows, so a shire county is its districts summed, as births already were.

**Years** are the data's own, so mid-2025 LSOA estimates will move the board with no code change (rehearsed). The projection horizons are offsets in `years.ts` (`SMT_PROJECTION_TILE_AHEAD` 7, `SMT_PROJECTION_CHART_AHEAD` 11).

## The wording rules (`SMT_NOTES`), and where each appears

| Rule | Note | Where |
|---|---|---|
| 1. Deprivation is the area's | `wDeprivation`: "the area around the school, not its pupils" | Social context (under the deciles and the mix); the map's IMD and IDACI legends |
| 2. Independent schools | `wIndependentFsm` "Free school meals are not published for independent schools." and `wIndependentDraw` "Independent schools often draw pupils from well beyond 5 miles." | Social context's FSM space (information style, never 0% or a dash); the FSM map marks independents hollow, "not published" |
| 3. Residents ≠ pupils | `wResidents` | The area now's (i), population by age's and children nearby's (i); the census line is labelled beside the residents tile and never divided by it |
| 4. Deciles | `wDeciles`: "1 = the most deprived 10% of neighbourhoods in England, 10 = the least." | Under every decile (Social context, map legends, the map's (i)); the legend's "1 = most deprived 10%" |
| 5. Projections | `wProjection`: "A projection, not a forecast for the school"; `projection` adds "by local authority" | The projection chart's caption, the projection tile ("ONS projection, by local authority"), the (i) |
| 6. Sources and editions | `wSources`, filled from the data, e.g. "ONS mid-year population estimates for LSOAs (mid-2024); ONS 2022-based subnational population projections, by local authority; English Indices of Deprivation 2025 (MHCLG); DfE "Schools, pupils and their characteristics" (2025/26)." | Every Context panel's source (i) |

## Rules

| Rule | Runner | Result |
|---|---|---|
| R-SMT-CONTEXT-RESIDENTS (new) | smtContextResidents | The Chase, GCSE: **3,354** (mid-2024) = the lookup's ages 11–15; census line 3,147 beside it |
| R-SMT-CONTEXT-DEPRIVATION (new) | smtContextDeprivation | The Chase **IMD 8, IDACI 3**; Leighton Park **6, 5**; Acland Burghley **4, 5**; mixes 100.01%, 100.00%, 99.99% (rounding) |
| R-SMT-CONTEXT-FSM (new) | smtContextFsm | The Chase **17.7%** vs Worcestershire **20.8%**, England **26.5%** (2025/26); Acland Burghley **34.0%** vs Camden **46.1%**; Leighton Park: rule 2, no number |
| R-SMT-CONTEXT-WORDING (new) | smtContextWording | all six verbatim; no "pupils" beside a deprivation figure |
| R-SMT-CONTEXT-GEOGRAPHY (updated) | smtContextGeography | without boundaries: LA fallback, district note, Shade by children/FSM; with boundaries: 34 = 34, every LSOA has a boundary, Shade by adds IMD/IDACI |
| R-SMT-VIEW-CONTEXT-NOW (updated) | smtContextNow | births = ONS; projection = `ons_snpp` recomputed (11–15, 2025 → 2032, ▼ 5.0%) |
| R-SMT-VIEW-BIRTHS (updated) | smtBirths | 2012 = 100; projection mid-2025 → 2036 |
| R-SMT-YEARS (updated) | smtYears | no year literal; GCSE 2025/26 rehearsal; **new LSOA-year rehearsal**: children, by age, sources and the nearby line all move to mid-2025 |
| R-SMT-DATA-GAP | — | **Retired** (superseded by R-SMT-CONTEXT-DEPRIVATION) |
| R-SMT-NOTES | smtNotes | no SMT component copies a note |

**The two rehearsal preloads:**
- `scripts/year-rehearsal/install-lsoa-next.ts` adds a synthetic LSOA year;
- `scripts/context-preview/install-lsoa-boundaries.ts` serves the boundary RPCs from ONS's own service, so the "loaded" state can be tested before the load.

## Differences from the wireframe

- **Social context** fills the wireframe's dashed gap (K2):
  - the deciles on one line, each with its colour;
  - the IDACI mix as one bar with its line;
  - FSM in a bordered row (state) or an information row (independent).

  The wireframe drew no styling for these; they use the shell's tile border, caption sizes and the decile scale.
- **Column 1 is tighter** (6 px gaps, not 8) to hold the block in the 530 px row. Everything fits at 1440 for all three schools.
- **"Shade by"** sits in the map panel's header, as drawn. Its menu is wider than other pills (300 px) to show the full option names.
- **Ages run to 18** in population by age (the wireframe drew 5–17; ONS's small-area figures run 0–18).
- **The legend** reads "More/Fewer children" with the per-hectare thresholds, plus the 5-mile circle.
- **The projection's dashed line starts at ONS's own 2025 figure,** so where the 2022-based projection and the mid-2025 estimate disagree (Camden, Wandsworth at 11–18) it starts a step away from the estimates line. The wireframe drew them joined (logged).
- **The place line has no district,** and the Area pill offers none: no anon lookup returns a school's `lad_code` (logged; the LSOA name carries it).

## Screenshots

In `docs/v0.8/smt_r3_screenshots/`, drawn by the built components on real data from the routes' own functions, with the boundaries served as the loaded table would serve them:
- `{chase,leighton,acland}_context_{dark,light}_{1440,390}.png`;
- `chase_map_{children,imd,idaci,fsm}_dark.png`, each "Shade by" mode;
- `acland_map_idaci_dark.png`, inner London by IDACI;
- `leighton_social_context_{dark,light}.png`;
- `chase_map_fallback_dark.png`, before the boundaries are loaded;
- `chase_pupils_dark_1440.png`, Pupils with row 2's residents line;
- `head_office_harris_battersea_context_dark_1440.png`, head office reading a member school's Context in full (K7).

## Click-through for Guy

1. **The Chase, Context, GCSE:**
   - 3,354 children aged 11–15 within 5 miles (▲ 3% since 2011), with 3,147 pupils at schools within 5 miles beside it;
   - IMD decile 8, IDACI decile 3;
   - 13% of children in the most deprived 20%;
   - free school meals 17.7% (Worcestershire 20.8% · England 26.5%).
2. **"Shade by"** through all four modes. Deprivation is darkest for decile 1; free school meals colours the schools.
3. **Leighton Park:** "Free school meals are not published for independent schools. Independent schools often draw pupils from well beyond 5 miles."
4. **Acland Burghley,** the map by IDACI (inner London).
5. **Before the load,** the map shows the LA shading and "shading by district".
6. **Pupils, row 2:** the area's residents (mid-2019 to mid-2025).
