# VicData 0.8 SMT round 4: projections from children already born, a catchment the school controls, and how every chart is calculated

Branch `v0.8-smt-r4`, from `main` (`ce7ec1d`), 15 Oct 2026. Prompt: `docs/v0.8/vicdata_0_8_smt_round4_area_projection_radius_claude_code_prompt_v1.md`. Calls are logged under "2026-10-15 — 0.8 SMT r4" in `docs/OPEN_QUESTIONS.md`.

**Not merged.** It needs your go-ahead, after you have read the (i) audit, the findings in it, and the parity result.

## Before the build

**The method notes differed** (the prompt's stop check):
- The app's copy was settings version 1's; the ingest's is version 2's (the band from every year's rates since 2013, your decision earlier that day).
- The app's copy is now the ingest's, byte for byte.
- The ingest report's P5 spot checks are now version 2's (branch `docs/area-projection-p5-v2` in `vicdata`, waiting to merge).

**Your catchment decisions replace the prompt's miles:**
- **Units and scope:** kilometres, one radius per school.
- **Default:** 5 km for a state school, 15 km for an independent school.
- **Cap, by the school's type (never the level):** 15 km for a state school without a sixth form, 30 km otherwise.
- **Admissions' default pools stay the nearest schools.** Its list editor's radius starts at the school's catchment, and a line says how many ticked feeders lie within it.

**An ingest change was needed** (`vicdata`, branch `feat/area-projection-age-range`, migration `20261016120000`):
- `area_projection` and `la_projection_lookup` take an optional age range.
- Whole school draws a school's own range (11–18, 4–11 …), and Pupils' row 2 draws 5–15. Adding up single ages' lows and highs would overstate those bands.
- Until it is applied, the app draws those ranges' middle lines (exact) without a band, and says so.
- On the real tables, SQL equals Python (Leighton Park, 5 miles, 11–18).

## Commits

| Stage | Commit | What |
|---|---|---|
| Inputs | `06c296a` | The prompt, the method note (the ingest's), your decisions |
| R, F | `a2bbe46` | The catchment in km; the forward view; the rules |
| R4 | `048d008` | Boundary reads past 1,000; one retry on a cold statement timeout |
| I | `6e106bb` | A method on every view; the (i) audit |
| Fixes | `e78d11d` | The (i) is never clipped; Teacher's default page gets its methods; the radius on the phone; screenshots |
| I | `b6e1522` | Two (i) texts the audit found wrong (SMT Pupils, Context) |
| Report | this commit | Report, logged calls |

## Checks

| Check | Result |
|---|---|
| tsc, eslint, build | Clean (eslint: the 2 warnings already on `main`) |
| Unit tests | **446 / 446** (12 new: the catchment rules and the mix line) |
| Rule tests | **91 pass, 0 fail from this round.** The full run gave 86 pass, 6 fail: <br>- 5 fail on `main` too, the same way: R-TREND-LINE-4YR, R-THRESHOLD-PERIODS, R-TREND-TABLE-YEARS, R-CURRENT-GRADES-FROM-2324 and R-SMT-FLAGS. Today's GCSE 2025/26 promote added a year after their expected values were written (logged). <br>- R-SMT-YEARS failed once, in its LSOA rehearsal subprocess, while both parity harnesses were running; alone it passes. |
| New app migration (PGlite with PostGIS) | `v08_smt_r4_catchment_pglite.mjs`: **28 / 28** (RLS: School-Admin and holder write, members read, pending members, another school and anon neither; 2–30 km; boundaries to 32 km; applies twice) |
| Ingest age-range migration (PGlite) | 17 new checks pass; the full-data run's 11–18 row equals Python's |
| R-SMT-FORWARD | **The app's figures equal the ingest's P5 spot checks, 9 / 9, exactly** |
| Teacher parity | 2,875 / 2,875 pairs match with the (i) closed (`cmp6_noinfo.py`): 2,873 identical, 1 render noise, 1 flake identical on two rechecks (`rk-137625-nat-threshold c2.current`). Rerun on the final code (sets c5_0 and sv): 660 / 660 identical. Public school page SSR identical (137625, 117037). Every (i) text differs by design (the methods), listed in the audit |
| Admissions parity | **328 / 328 identical**, pixels and DOM, 592 panel-views (branch bundle with every Admissions-side change: the (i) portal, the methods, the chart's new optional props) |
| Server keys in client bundles | None |

## R: the catchment

**The Area pill:**
- It reads "Area: within 5 km · local authority".
- Its menu picks the area (within the radius, or the local authority) and the radius: presets 2, 3, 5, 8, 10 and 15 km, plus 20 and 30 where the cap allows, and a slider in whole km to the cap.
- **On the phone** it sits under the level chips (Context only; the other SMT pills stay desktop-only, as before).
- **The radius stays with this view:** changing it without saving changes only this view. It is held in the address (`?km=`), so Copy this view… and Edit keep it.

**Saving the default** (`school_catchment`, app DB, migration `20261113090000`, not applied):
- **Who:** the school's School-Admin (or account holder) saves "Our usual catchment: N km". Its approved members read it; nobody else does (RLS).
- **The order:** the board draws this view's own radius, else the saved catchment, else the default by type.
- **A saved catchment over the cap** (the school's type changed) draws at the cap and says so.
- **Head office** reading a member school's SMT isn't a member, so it reads no saved catchment and draws the school's default (logged; see the questions below).

**The whole board follows the radius:**
- the map circle and the shaded ring (2 km beyond);
- children now, and the authority mix under them;
- the deprivation mix;
- population by age;
- children nearby over time;
- the forward view;
- schools nearby and the census line.

Every caption names the radius ("within 8 km"), and R-SMT-RADIUS checks that no caption names another. The board reads `area_context` and `area_projection` (the ingest's functions take miles; the app converts).

**The authority mix** is one line under the children tile:
- e.g. "Within 8 km: Wokingham 50%, Reading 46%, West Berkshire 4% (children aged 11–15)";
- at most five authorities of 1% or more; the rest fold into "other".

**Admissions:**
- The list editor's radius starts at the school's catchment (read with the member's own session).
- Under the ticked feeders it says "12 of the 15 ticked schools are within your 5 km catchment".
- Its pools are unchanged.

**Wide radii** (R4):
- Over 2,500 neighbourhoods, the map draws each as a dot at its population-weighted centre, in the same colour scale, and says so.
- Acland Burghley: 25 km gives 5,613 drawn (5,227 within, equal to the lookup); 30 km gives 6,137 (5,851 within). The payload is 519 and 569 kB gzipped.
- These figures used round 3's ONS stand-in for the boundary table: production's `lsoa_boundaries_near` stops at 20 km until the migration raises it to 32 km.
- **Two fixes found by timing:**
  - Boundary and school reads now page past PostgREST's 1,000-row cap. Acland at 10 km had drawn 1,000 of 2,347 neighbourhoods.
  - A cold wide-radius read that passes the anon role's statement timeout is retried once.

## F: the forward view

- **The line:** the projection's middle line for the level's ages, from `area_projection` at the radius or `la_projection_lookup` for the LA (a county's districts summed), up to the horizon (latest + 11).
- **Estimates and line always meet:** the estimates are solid to the latest count, and the projection starts from that count. Round 3's join note is retired (R-SMT-CONTEXT-PROJECTION-JOIN superseded).
- **The band** is shaded: the lowest and highest of whole single-year projections, taken over the ages' sum.
- **Unborn years:** years whose ages include children not yet born are drawn lighter and labelled at the change ("includes children not yet born"); for Primary, from 2030.
- **Two faint lines, off until switched on**, each with its key:
  - "Compare with ONS's projection": ONS 2022-based. Around the school, ONS's change by authority is applied to the area's children in each, because ONS projects authorities only.
  - "If migration returned to 2022–24 levels".
- **The tile:** "11–15 by 2030: ▼ 2.5% (range −5.1% to +8.0%) children living within 8 km, projected; not a forecast for the school".
- **Pupils, row 2:** the LA's line continues with the same projection's middle line, dashed, unborn years lighter.
- **Wording** (R-SMT-NOT-A-FORECAST):
  - The method note's sentence is on every view that draws the projection: "A projection of children living in the area, not a forecast for the school."
  - "What it is and isn't" is in `SMT_NOTES.whatItIs`.
  - Nothing says "forecast" except "not a forecast", and nothing says "your roll".

## I: every chart says how it was calculated

**A method for all 111 catalogue views** (Teacher 40, Admissions 33, SMT 38; groups' views are SMT's), in `src/catalogue/methods*.ts`. Each has:
- the sources (editions where the data carries them);
- the area;
- the years, and any left out with the reason;
- numbered plain-English steps;
- rounding and suppression.

**How it shows:**
- The footer's (i) shows the method under its source line, with the steps under a collapsible "How it is calculated".
- It is drawn above the panel (a portal), scrolls, and is never cut off, on the phone too.
- The text loads only when an (i) is opened (its own 210 kB chunk), so no page carries it and a closed (i) is unchanged.

**The forward view's method is generated** from the projection's settings (`projectionMethod`), in the method note's (i) shape. R-METHOD-SETTINGS checks:
- every setting value appears in the text;
- a changed fixture (one more exceptional year, weight 3, an 8-year horizon, a normal-years band) changes the text to match.

**Census years in the methods** come from `years.ts` (`CURRENT_CENSUS_PERIOD`), so they move with the data.

**How the methods were written:**
- **From the code:** three audits, one per product, kept in `docs/v0.8/smt_r4_method_audit/`. They trace each view's data path and say what its (i) said, what the code does, and what the (i) didn't say.
- **The audit in full**, view by view, with before and after and the code's unsaid steps (406 in all): **`docs/v0.8/smt_r4_method_audit_v1.md`**.
- **Every view's (i) changed,** since each now ends with its method.
- The generated catalogue docs (`docs/catalogue/`, stale since 0.6) are regenerated, with each view's method.

### What the audit found the code does differently from what a view says (for you: not changed here)

The methods now state what the code does. These are cases where the view's own label, a rule, or the old (i) said something else. **Fixing them would change figures or labels outside this round's allowed differences**, so each is listed for you to decide.

**Teacher:**
1. **IGCSE schools:** national and regional rankings keep them in the population. Only the listed sample drops them (R-IGCSE-EXCL).
2. **Ties:** headline rankings (no subject in focus) number by position, so tied schools don't share a place (R-RANK-TIES). Subject rankings do share ties.
3. **Column 1's Results map ignores a chosen ranking:** it draws the ranking's sample on Average points, and only the school on a rate (R-RANKING-SAMPLE).
4. **The map's own IGCSE check never fires:** the lean profiles carry no headline years.
5. **Double Award:** Column 1 gives it no points. Comparisons, the subject ranking and Context score it as two entries.
6. **"10 nearest"** can show fewer than 10 at GCSE: IGCSE schools are dropped, not replaced.
7. **The set average** in Comparisons leaves the school out, and the average-change line is the change in the yearly mean, not the mean of the schools' changes.
8. **Area figures** need 5 or more schools (England: 1; grade shares: 5 per grade). The (i) names only DfE, not VicData's area tables.
9. **The change map's 2021/22 note** shows on the default page but not under the config renderer.

**Admissions:**
1. **The wrong note in the (i):**
   - the pool note sits on views that have no pool (Now, Shape, Entry, Area population);
   - the group-share note sits on rivals'-results views it doesn't describe.
2. **4+ births are not scaled to the schools.** The pool is the LA blend's births, with the Reception/births ratio used only for the range. ADMISSIONS_NOTES.births says "scaled".
3. **The counted line is today's count, not moved;** drift moves only the range. At 16+ the primaries-to-secondaries step does move it.
4. **The births blend** is a weighted average by the youngest feeder set's Reception pupils.
5. **The funnel's "this September"** is September 2025's entrants, and it uses the whole LA or blend, not the feeder schools.
6. **Feeder flags compare one age only** (the age below entry). R-ADM-FLAG-FEEDER says "across the rung ages".
7. **"Indexed, 2019/20 = 100"** headers index to the first year all lines share, which may be later.
8. **Titles that don't match what is drawn:**
   - Share-change shows only the change in share;
   - Roll trends is the entry age band, not the whole roll;
   - Entry table has no change column;
   - at 16+ the local shape says "aged 4–15" but the set is primaries unless a list is saved.
9. **The girls/boys filter is applied unevenly:** not to the entry tiles, entry trends, the feeder table and map, or the momentum chart's pupils; and only to the feeders' line in Pool trends.

**SMT** (Overview and Academic are outside the allowed differences; the two Pupils and Context ones are fixed in `b6e1522`):
1. **Flags caption:** "{gap}" is filled with a phrase, so the sentence reads garbled.
2. **Shape and size highlighted ages:** GCSE lights Years 7–12 and Primary Reception–Year 7, but the caption says Years 7–11 and Reception–Year 6.
3. **Tables showing different figures from their labels:**
   - the roll tables show index values;
   - the births table shows actual births under a "2012 = 100" header;
   - indexed labels always name 2019/20 or 2012, whatever year the lines share.
4. **National GCSE ranks keep IGCSE schools** that aren't in the set.
5. **The Scorecard's set rank for the roll** ignores the Pupils and Day/boarding filters.
6. **Context with the Area pill on the LA:** the IDACI mix and children nearby over time still describe the radius (their captions say so).
7. **Subject areas:** a school needs 10 entries in an area to count, but a row shows with one set school, though the empty state says "at least two". The rank tile has no minimum.
8. **Results use each key stage's national latest year,** not the school's own.

## Rules

| Rule | Result |
|---|---|
| R-SMT-RADIUS (new) | Defaults 5 km (The Chase) / 15 km (Leighton Park); saved and view order; state 11–16 capped at 15 km; at 3 km every caption says 3 km; RLS 28 / 28 |
| R-SMT-FORWARD (new) | P5: 9 / 9 equal; the line starts at the count; the band contains it; Primary's unborn years from 2030, labelled; Leighton Park's mix names Reading and Wokingham |
| R-SMT-NOT-A-FORECAST (new) | No "forecast" but "not a forecast", no "your roll"; the sentences locked and on the views |
| R-METHOD-PRESENT (new) | 111 / 111 views have a complete method; none names a view the catalogue doesn't hold |
| R-METHOD-SETTINGS (new) | Every setting in the generated text; a changed fixture changes it |
| R-SMT-CONTEXT-RESIDENTS, -DEPRIVATION, -FSM, -WORDING, -GEOGRAPHY, -PLACE (updated) | Read through `area_context` at exactly 5 miles: **round 3's figures hold** (The Chase 3,354, 34 neighbourhoods = the lookup's) |
| R-SMT-VIEW-CONTEXT-NOW, R-SMT-VIEW-BIRTHS (updated) | The tile and horizon from `area_projection` (The Chase 11–15, 2025→2030, −0.9%) |
| R-SMT-YEARS (updated) | The LSOA-year rehearsal now also adds the year to `area_context`: Context moves to it with no code change |
| R-SMT-CONTEXT-PROJECTION-JOIN | Superseded by R-SMT-FORWARD |

## Timings

**The board** (`buildContext`, server; a cold first call also loads reference data later schools share; GCSE):

| School | 2 km | 8 km (≈ 5 miles) | 30 km |
|---|---|---|---|
| The Chase | 5.6 s cold, 0.22 s warm (11 neighbourhoods) | 1.1 s, 0.29 s (34) | 1.7 s, 0.30 s (476) |
| Leighton Park | 1.5 s, 0.21 s (29) | 1.2 s, 0.21 s (191) | 2.5 s, 0.48 s (1,124) |
| Acland Burghley | 2.4 s, 0.22 s (83) | 2.9 s, 0.44 s (1,112) | 5.8 s, 1.0 s (5,851) |

**The map's neighbourhoods** (`buildContextMap`):
- 0.5–0.7 s cold at 2–8 km;
- 1.7 s for Acland at 8 km (1,780 drawn);
- at 25–30 km, dots (above): 0.6 s warm with the stand-in. Its 18–21 s cold time is the ONS stand-in's own service; production reads its table (round 3: 0.2 s for this query).

**The lookups from the app** (anon key, warm): `area_context` and `area_projection` at 25–30 km around Acland about 0.6 s each. Production's own timing after the speed fix: about 0.5–0.6 s warm at 25 miles, 1.3–1.8 s for a cold first call.

## Screenshots

In `docs/v0.8/smt_r4_screenshots/`, drawn by the built components on real data from the routes' own functions:
- `leighton_context_{5,8,15}km_{dark,light}_{1440,390}.png`: Leighton Park's Context at 5, 8 and 15 km (its default). The prompt asked for 3, 5 and 10 miles; these are the km equivalents at the presets.
- `leighton_forward_ons_scenario_dark.png`: the forward view with ONS's line and the scenario on.
- `acland_forward_vs_ons_{dark,light}.png`: Camden (Acland Burghley) against ONS, which runs well above.
- `forward_info_open_dark.png`: the forward view's (i) open, "How it is calculated" expanded.
- `admissions_pool_info_open_dark.png`: an Admissions pool view's (i) open.
- `teacher_comparisons_info_open_dark.png`: a Teacher Comparisons view's (i) open.

## Apply commands

**1. The app migration** (catchment table, boundaries to 32 km; additive; the app works before and after):
```
cd ~/dev/vicdata_public && git fetch && git checkout v0.8-smt-r4 && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261113090000_v08_smt_r4_catchment.sql && supabase migration repair --status applied 20261113090000 --linked
```

**2. The ingest age-range migration** (`vicdata`; replaces the two lookups; old calls unchanged):
```
cd ~/dev/vicdata && git fetch && git checkout feat/area-projection-age-range && git pull && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && supabase db query --linked -f supabase/migrations/20261016120000_area_projection_age_range.sql && supabase migration repair --status applied 20261016120000 --linked
```

**3. The re-seed:** none. No dashboard's config changed.

## Questions for you

1. **Head office and the catchment:** should head office see a member school's saved catchment (as with Admissions, perhaps where the school shares)? Today it draws the school's default.
2. **The audit's findings** above: which to fix, and in which round.
3. **The five rule tests that fail on `main`** after today's GCSE promote: their expected values need moving on to 2025/26.
