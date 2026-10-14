# VicData 0.8 — SMT round 3: Context with real data (small-area population, deprivation, free school meals)

Claude Code build prompt, written 14 Oct 2026, for the app repo (`~/dev/vicdata_public`, app database `lnhulykjlxmoneappnsp`). SMT round 2 built Context on stand-ins: census pupils instead of residents, whole local authorities on the map, 10-year-olds only in the projection, and a dashed "not yet in VicData" block. The ingest has now loaded the real data into production (`hrqrbvrrhlidpoybezhs`, merged as `08ab945` in the ingest repo). **This round replaces the stand-ins.** It's the board Leighton Park sees on 27 Nov, so it has to be right for an independent school as well as a state one.

**Timing:** Thursday's GCSE 2025/26 ingest runs in the ingest repo against production. This round only reads production through the lookups, so the two can run side by side. Don't load anything into production.

## Read first

- **In the ingest repo** (`~/dev/vicdata`), `docs/vicdata_context_data_ingest_report_v1.md`, in full and especially **"What the app can read"**. It lists the lookups, what they return, editions and vintages, and the wording rule. Read only through those lookups (all callable by anon): `school_context_lookup`, `lsoa_context_lookup` and `reference_data_lookup` (sources `ons_population_age`, `ons_snpp`, `dfe_school_fsm`, `dfe_fsm_geography`). The tables behind them have no anon access.
- `docs/v0.8/smt_r2_report_v1.md`, section C (what Context reads today, the map's geography table, "Differences from the wireframes"), plus its rules.
- **The wireframe:** `docs/wireframes/smt/Context.dc.html` and `Phone.dc.html`. It already draws what this round builds: the map titled "Where the school-age children live", with neighbourhoods shaded and "Shade by" gaining Deprivation and Free school meals, the "Social context" block, "11–15s by 2032", and population by single year of age to 17. **Pixel-perfect, both themes, from the shell** (`src/components/shell/`). Where the wireframe still shows the data gap, this round fills it (see K2).
- The spec, `docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md`, §2.3 (Context).

## Ground rules

- **Branch `v0.8-smt-r3` from `main`.** Commit per stage.
- **Clean before merge:** tsc, eslint, build, unit, rule, RLS (all current tests, including groups r1's), usage-log test, Teacher parity (2,875) and Admissions parity (328), the public page, and groups r1's head-office views.
- **Only SMT Context and SMT Pupils' row-2 population line may change.** List any other difference; it stops the merge.
- **Database changes are written and tested (PGlite), never applied by you.** This round needs one: the LSOA boundaries table (K0). Give apply commands as `&&` chains with the project-ref check and **no `exit`**. The app must work before the migration and before the boundaries are loaded (K0's fallback).
- **Years come from `src/catalogue/years.ts` and from the data itself.** Never hard-code 2024, 2025 or an edition. The LSOA estimates currently end at mid-2024 and the LA estimates at mid-2025; when ONS publishes mid-2025 for LSOAs, the board moves on its own.
- Never put a server key in client code. Stage files by name. Leave Guy's untracked and modified files alone. Log calls under "2026-10-xx — 0.8 SMT r3" in `docs/OPEN_QUESTIONS.md`.

## The wording rules (into `SMT_NOTES`, each locked with a rule)

1. **Deprivation describes the area, never the school's pupils.** Every deprivation figure carries "the area around the school, not its pupils". Never write "your pupils are deprived" or rank a school by its area's deprivation.
2. **Independent schools:** "Free school meals are not published for independent schools." Never 0%, never "—" alone. Add the line: "Independent schools often draw pupils from well beyond 5 miles." This is the line Leighton Park will read.
3. **Residents and pupils are different counts.** Children living within 5 miles (ONS estimates) are not pupils at schools within 5 miles (census). Label which is which and never divide one by the other.
4. **Deciles:** "1 = the most deprived 10% of neighbourhoods in England, 10 = the least." Say this wherever a decile appears.
5. **Projections:** "A projection, not a forecast for the school" (kept from round 2). Population projections are by local authority, which the caption also says.
6. **Sources and editions** in the footer's source (i): ONS mid-year estimates for LSOAs (latest year held), ONS 2022-based subnational projections, English Indices of Deprivation 2025 (MHCLG), DfE "Schools, pupils and their characteristics" (latest year held), with the editions read from the data where the lookups return them.

## K0 — LSOA boundaries (app DB; migration written and tested, load script for Guy)

The map needs neighbourhood outlines. Follow `la_boundaries` exactly: its migration, `scripts/ingest-la-boundaries.ts`, its ingest RPC and `la_boundaries_geojson`.

- **The table:** `lsoa_boundaries` (gss_code, name, geom, source_dataset, fetched_at), with a GiST index, RLS on, and select open to anyone (public geography, as with `la_boundaries`).
- **The data:** ONS "Lower layer Super Output Areas (December 2021) Boundaries EW", **England only** (E01…, 33,755). Use the **super-generalised (BSC)** version if it keeps the map readable at the 5-mile zoom; otherwise use the generalised one (BGC). Report the size of each and which you chose.
- **The RPC:** `lsoa_boundaries_geojson(p_gss_codes text[])`. It returns only the LSOAs asked for: the app asks for the LSOAs `school_context_lookup` counts within 5 miles, plus a ring around them so the shading doesn't stop at a hard edge. Log how you chose the ring. Inner London is the worst case (Acland Burghley: 1,121 LSOAs within 5 miles); time it and report payload size and render time.
- **The load script:** `scripts/ingest-lsoa-boundaries.ts`, run once by Guy. Static geography, re-run only when ONS changes the boundaries. Give the command chain: migration apply, then load, then a count check (33,755).
- **Fallback:** until the table has rows, the map does exactly what round 2 does (LA shading, "shading by district"). Test both states.

## K1 — Column 1, "The area now"

Keep the wireframe's four tiles, now on real data:

- **Children aged {the school's ages} within 5 miles:** residents, from `school_context_lookup` (latest year), with the change since the first year held (2011). The level chips pick the ages: GCSE 11–15, Post-16 16–17, Primary 4–10, Whole school the school's full age range. Caption: "living within 5 miles (ONS estimates, mid-{year})". Below it, one smaller line: "{n} pupils at schools within 5 miles (census {year})", from round 2's census figure. Both are labelled and neither is divided by the other (wording rule 3).
- **Births, last year:** unchanged.
- **{Ages} by {year}:** the ONS projection for the school's ages, summed over single years from `ons_snpp`, for the school's LA, at the wireframe's horizon (logged), with "ONS projection, by local authority". This replaces "10-year-olds by 2035". If the school's ages span two phases, follow the level chip.
- **Schools nearby:** unchanged.
- **The place line:** add the district. Round 2 couldn't tell a school's district; `postcode_geography.lad_code` now can, through an anon lookup if one exists. If none exists, log it and keep town · LA · region; don't add a lookup to production in this round.

## K2 — "Social context" (replaces the data-gap block)

The dashed block goes. In its place, the wireframe's "Social context" block, built from the shell's existing tile and caption patterns (log any styling the wireframe didn't draw):

- **The school's neighbourhood:** IMD decile and IDACI decile (income deprivation affecting children) of the school's own LSOA, each as "decile n of 10", with wording rules 1 and 4. If the school's postcode doesn't resolve to an LSOA (outside England, or a bad postcode such as URN 147460), say so; never show a blank.
- **Children within 5 miles, by deprivation:** the IDACI mix (`idaci_mix`, 10 shares) as one stacked bar, decile 1 to 10, with a one-line reading such as "{x}% of children within 5 miles live in the most deprived 20% of neighbourhoods" (deciles 1–2), against 20% for England by construction. Say "by construction" in the (i), not in the line.
- **Free school meals:**
  - **State schools:** the latest FSM % (`fsm_eligible_percent`), with the LA (through `la_gss_crosswalk`, as the ingest report says) and England, to 1 dp, and the change since the first year held (2019/20).
  - **Independent schools:** wording rule 2, in the same space, styled as information rather than an error.
- Keep the dashed style only for anything genuinely still missing (none expected; "FSM ever 6" isn't in this source; leave it out rather than flagging it as a gap).

## K3 — The map, "Where the school-age children live"

- **Neighbourhoods shaded** within 5 miles plus the ring, on the shared Leaflet map. Draw the 5-mile circle as a thin line. The school is in the SMT accent (hex, as round 2 found; CSS variables don't resolve in Leaflet's SVG); other schools are grey.
- **"Shade by"** (a pill, as now), listing only what exists:
  - **Children aged {the school's ages}** (default): count per LSOA in the latest year, from `lsoa_context_lookup`. LSOAs differ in size, so shade by **children per hectare** if the boundary area is available, otherwise by count with a caption saying so. Log which.
  - **Deprivation (IMD)** and **Children's deprivation (IDACI)**: deciles 1–10. Use **one sequential scale**, darkest for decile 1, with the legend "1 = most deprived 10%". Don't use red and green, and don't use a scale that reads as good and bad.
  - **Free school meals (state schools):** FSM isn't published by neighbourhood, so this option **colours the school markers** by their latest FSM %, leaving neighbourhoods unshaded. Independents are hollow grey markers labelled "not published". The legend says that this one shades schools, not areas.
- **Legend and caption** follow the wireframe ("Neighbourhoods are ONS LSOAs, joined through postcodes" in the (i)). The tooltip on an LSOA gives its name, its children of the school's ages, and its IMD and IDACI deciles.
- **Area pill:** "around the school" shows the LSOA map. "LA" shows round 2's LA map. If K1 found the district, "district" is offered too.
- **Phone:** the map keeps "Shade by", and the legend goes under the map.

## K4 — Large view rail and row 2

- **Population by age** ("Children by single year of age"): ages 0–18, residents within 5 miles (from `children[19]`), with the school's ages highlighted (the level chips choose). Switch to the LA (`ons_population_age`, 0–18) with the Area pill. Ages run to 18 now, beyond the wireframe's 17; log it.
- **Births and projections:** the projection is now for the school's ages (sum of single years), LA level, to the wireframe's 2036, with "a projection, not a forecast for the school".
- **Row 2:**
  - Births, indexed: unchanged.
  - **"Secondary-age population, projected"** (or primary, by the school's phase): the LA's estimates for the school's ages from `ons_population_age` up to the latest year, then `ons_snpp` to 2036 in a dashed line. The wireframe's "Estimates" and "ONS projection" legend applies.
  - **Population by age:** as in the rail.
- **New, in the rail:** **"Children nearby over time":** children of the school's ages within 5 miles, 2011 to the latest year, indexed (first year = 100), against the LA and England from `ons_population_age`. Caption: "residents, not pupils".

## K5 — Pupils, row 2

"The area's school-age population" now reads **residents**: the LA's ONS ages 5–15 (or the school's ages), from `ons_population_age`. Change the caption from "census pupils" to "ONS mid-year estimates, residents". This is the only change to Pupils.

## K6 — Rules and tests

New or updated R-* rules, each with a runner:
- **R-SMT-CONTEXT-RESIDENTS:** The Chase's GCSE children within 5 miles equals `school_context_lookup`'s sum of ages 11–15 for the latest year (3,354 for mid-2024).
- **R-SMT-CONTEXT-DEPRIVATION:** the deciles for the three check schools: The Chase IMD 8, IDACI 3; Leighton Park 6, 5; Acland Burghley 4, 5. The IDACI mix sums to 100%.
- **R-SMT-CONTEXT-FSM:**
  - The Chase is 17.7% against Worcestershire 20.8% and England 26.5% (2025/26), and Acland Burghley is 34.0% against Camden 46.1%;
  - Leighton Park shows wording rule 2 and no number.
- **R-SMT-CONTEXT-WORDING:** the six wording rules appear verbatim from `SMT_NOTES`; no "pupils" next to a deprivation figure.
- **R-SMT-CONTEXT-GEOGRAPHY:** both states, with and without boundaries loaded.
- **R-SMT-DATA-GAP:** retired. Say so in the rules table.
- **R-SMT-YEARS:** run the 2025/26 rehearsal. Add a rehearsal where the LSOA estimates gain a year, so the board moves without a code change.

The figures above are from the ingest's check on 14 Oct. If the lookups return different ones, stop and report rather than changing the test to match.

## K7 — The rest

- **Panel chrome, notes, flags, Edit, Copy this view…** and the usage-log scope, as rounds 1 and 2. Each new view is a catalogue entry plus a component.
- **The seed:** if the Context dashboard's config changes (new views, the new rail entry), extend `scripts/dashboards-seed-sql.ts` and give Guy the re-seed command.
- **Head office:** groups r1 lets head office open a member school's SMT read-only. Context has no private data, so it shows in full there; check that it does.

## Report

`docs/v0.8/smt_r3_report_v1.md`:
- K0: the boundary edition, size, ring and payload/render times, and the apply and load commands;
- each panel, its lookup and years;
- the wording rules, and where each appears;
- the rules table;
- differences from the wireframe;
- logged calls.

Screenshots go in `docs/v0.8/smt_r3_screenshots/`:
- The Chase, Leighton Park and Acland Burghley, Context, both themes, 1440 and 390;
- the map in each "Shade by" mode for The Chase;
- the IDACI shading for Acland Burghley;
- Leighton Park's Social context block;
- the map before the boundaries are loaded (fallback);
- Pupils row 2.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-smt-r3 -m "0.8 SMT round 3: Context with small-area population, deprivation and free school meals" && npm run build && git push
```

Stop before merging if Teacher, Admissions, the public page or groups r1 differ, if a figure in K6 doesn't match, or if the map can't render inner London in a reasonable time. Push the branch and report instead. If a push fails, give Guy the command; he pushes over HTTPS.
