# VicData 0.8 SMT round 2: Pupils, Context, and round 1's snags

Branch `v0.8-smt-r2`, from `main` (`ad9caa4`). Prompt: `docs/v0.8/vicdata_0_8_smt_round2_claude_code_prompt_v1.md`. Calls are logged under "2026-10-13 — 0.8 SMT r2" in `docs/OPEN_QUESTIONS.md`.

| Stage | Commit | What |
|---|---|---|
| S | `b95ea68` | Round 1's four snags. Parity on that tree: Teacher 2,875 / 2,875, Admissions 328 / 328, public SSR identical. |
| P + C | (this commit) | Pupils and Context: catalogue entries, views, routes, rules, the home card's live chips, the seed. Built together because they share the page, catalogue and dashboard files. |

**Database:** nothing new to apply. The re-seed (below) adds the two new dashboards to the `dashboards` table for the editor; the pages work without it, drawing the code copy.

## Checks

| Check | Result |
|---|---|
| tsc, eslint, build | clean (eslint: the same 2 warnings as `main`); new routes `/teacher/smt/{pupils,context}`, `/api/smt/{pupils,context}` |
| Unit tests | **407 / 407** (404 before; 3 new, and the SMT tests updated for four dashboards) |
| Rule tests | **82 PASS, 0 FAIL** (52 before round 1, 20 SMT round 1, 10 new); R-DOUBLE-AWARD-POINTS rerun after the last change: PASS |
| RLS test | **111 / 111** |
| Usage log test | **19 / 19** |
| Teacher parity | **2,875 / 2,875 identical** on both stages (S, and S + P + C), unmasked; negative control caught |
| Admissions parity | **328 / 328 identical** on both stages, pixels and DOM |
| Public page SSR | **identical** (137625, 117037) |
| Teacher and Admissions homes | **20 / 20 identical**, DOM and pixels |
| Server keys in client bundles | none |

**Deliberate parity differences:** none. S1 changes Teacher's figures for double-award subjects, but no pair in the Teacher matrix draws one. All 376 differences between the two trees' captured fixtures are double-award rows gaining an average (`avgPointScore` null → e.g. 4.89, coverage 0 → 100%); nothing else differs.

---

## S: round 1's snags

### S1: Science Double Award had no average and no rank

**Cause.** The ingest's subject rollup (`academic_subject_rollup`, ingest repo `ingest/academic_aggregates.py`) scores points for `GCSE (9-1) Full Course` single grades only. A double award is published as **pairs** ("98", "54" … "11") under `GCSE (9-1) Full Course (Double Award)`, so it never got points:

| School | Entries 2024/25 | Average, `main` | Rank, `main` | Average, branch | Set rank | England rank |
|---|---|---|---|---|---|---|
| The Chase 137625 | 170 | none | none | **4.89** | 1st of 11 | 758th of 3,711 |
| Acland Burghley 100053 | 134 | none | none | **4.37** | 5th of 11 | 1,472nd of 3,711 |
| Nunnery Wood 137051 | 229 | none | none | **4.80** | 2nd of 11 | 866th of 3,711 |

**Teacher's subject explorer had the same gap,** for the same reason, at all three schools. The `main` column above is Teacher's own subject ranking, run on `main`'s tree.

**Fix,** at the app's shared source (production is read-only for me):
- `doubleAwardPoints` (`src/lib/subject-grades.ts`) scores each pair on DfE's convention: two entries, each the average of its two grades (98 → 8.5; U → 0). A scale that mixes pairs with anything else is never scored.
- `fetchSubjectHeadlineForSchools` fills a double award's missing average from its own grade rows. This is the subject read Teacher's dashboard, the Data View and SMT share.
- `subjectRanking` scores the double award from its grade rows, and skips the database function, which reads the rollup's null.
- Teacher's Comparisons asks for GCSE points with **no** qualification type, so a request that ranks nobody at GCSE is asked again as a double award. Only those requests change; Biology and every other subject go through the database function exactly as before. This last piece came after the S commit and is in the P + C commit. R-DOUBLE-AWARD-POINTS checks Teacher's request shape too: The Chase 1st of 11, 4.89.

The rule R-DOUBLE-AWARD-POINTS recomputes all three schools' averages from the raw grade rows. It passes.

**Other scales:** a subject on its own scale (Additional Maths FSMQ's A–E, BTECs, Cambridge Nationals) now reads "different grading scale, not ranked" instead of "—".

**For the ingest round:** scoring double awards in the rollup itself would carry them into the subject-area (family) averages and the database rank function. Until then, a family average (e.g. Sciences & Maths 5.91 at The Chase) still leaves the double award out.

### S2: "Results by band" said "of pupils"

The caption is now "Arrives with the results-by-band round: the top 25%, middle 50% and bottom 25% of entries." It is locked in `SMT_NOTES` and checked word for word by R-SMT-VIEW-RESERVED.

### S3: The entries mix started in 2023/24

It now reads the subject rollup, which holds every year from 2021/22, so it runs alongside the results trend: 2021/22, 2022/23, 2023/24, 2024/25. R-SMT-VIEW-MIX checks the years and that each year adds up to 100%.

### S4: The column-1 tiles had a gap

With a subject area chosen, "Rank in {set}" is now its own fourth tile, as the Academic board draws it. This applies at GCSE and Post-16; R-SMT-VIEW-ACADEMIC-NOW checks the order. All areas and Whole school already had four tiles per phase.

**Found on the way:** round 1's set map gave Leaflet `var(--accent)` for the school's marker. Leaflet writes it as an SVG attribute, where CSS variables don't resolve, so it now takes the accent's hex.

---

## P: Pupils (`/teacher/smt/pupils`)

| Panel | Reads | Years | Coverage |
|---|---|---|---|
| Your pupils now | census (`buildRollTrend`, `cachedCensus`), the school page's XS–XL | 2019/20–2025/26 | every school with a census |
| Staying on at 16 | census: Year 12 now against Year 11 a year before | latest | schools with both |
| Shape and size | census by age; the shared shape classifier; the LA's same-age-range schools (Admissions' nearby pool); the set's shapes and sixth forms | latest; the shape since 2019/20 | described, never ranked |
| Entry points at a glance | Admissions' saved entry points (through RLS) and its pipeline (`pipelineView`) | latest cohort; next entry's pool | empty state with the reason where none are set |
| Leaving at 16 | census, Year 11 → Year 12 a year apart, with `ADMISSIONS_NOTES.leaving16` | 2020/21 on | schools with a sixth form |
| Market share | Admissions, as Overview (`marketAt11`) | 2019/20 on | empty state where no rivals are saved |
| Roll by phase, indexed | census by band; England pupils aged 5–15 (census aggregates) | 2019/20–2025/26 | as above |
| The pool | Admissions' ladder: counted, then from births | 2020 → 2036 | the lead's lists, else Admissions' nearby defaults |
| The area's school-age population | `age_profile_aggregates` (pupils 5–15 in the LA's schools) | 2019/20–2025/26 | every LA |

- **Admissions views are read-only** in SMT. They have no setup and no list editing, and each links "Open in Admissions" (R-SMT-ADMISSIONS-READ-ONLY).
- **The level chips pick the ages highlighted** (R-SMT-PUPILS-LEVEL): GCSE Years 7–11, Post-16 Years 12–13, Primary Reception to Year 6.
- **Filters:** gender for mixed schools and day/boarding for boarding schools, applied to the roll figures, as in round 1.

## C: Context (`/teacher/smt/context`)

### The map's geography

The prompt asks for LSOA, else MSOA, else district. What exists:

| Level | Population by single year of age? | Boundaries in VicData? |
|---|---|---|
| LSOA | no | no |
| MSOA | no | no |
| District | no (births only, summed to county) | no (counties and unitaries) |
| LA (county or unitary) | **pupils by single age 5–15 (school census)** | **yes** (`la_boundaries`) |

**So the map shades whole local authorities** ("shading by district", said on the map): the region's LAs, shaded by pupils of the school's ages in their schools. The school is drawn in the SMT accent and the schools of its phase within 5 miles in grey, on the shared Leaflet map. The map gained one optional `areas` layer; Admissions and the consortium page are unchanged. "Shade by" lists only what exists; the dashed note says deprivation and free school meals arrive later.

| Panel | Reads | Years | Coverage |
|---|---|---|---|
| The area now | schools within 5 miles (Admissions' nearby pool) and their census; ONS births (LA); ONS 10-year-old projection (county or unitary); town · LA · region | latest; births since 2012 | England |
| The data gap | `SMT_NOTES.dataGap` and `dataGapPlanned` | — | always shown, on the phone too |
| Map | `la_boundaries` (via `fetchLaChoropleth`) + `age_profile_aggregates` | latest census | the region's LAs |
| Population by age | `age_profile_aggregates`, the LA, ages 5–15 | latest | every LA |
| Births and projections | ONS births (LA); ONS projection, 10-year-olds, 2022-based | 2012–2025; 2022–2035 | every LA |
| Births, indexed | the LA against England (the sum of all 296 English districts and unitaries), 2012 = 100 | 2012–2025 | as above |

- **The Area pill** offers "around the school" (every school within 5 miles, all sectors; no radius existed, so this is logged) and the LA. A district isn't offered, because the app can't tell a school's district.
- **Context compares with England** and has no set ("Compared against: England", as the board shows).

---

## Rules

| Rule | Runner | Result |
|---|---|---|
| R-DOUBLE-AWARD-POINTS | doubleAwardPoints | three schools recomputed from raw grade rows; ranked; FSMQ "different scale" |
| R-SMT-VIEW-RESERVED (S2) | smtReserved | the caption, word for word |
| R-SMT-VIEW-MIX (S3) | smtMix | 2021/22–2024/25, each year 100% |
| R-SMT-VIEW-ACADEMIC-NOW (S4) | smtAcademicNow | four tiles, rank last, GCSE and Post-16 |
| R-SMT-PUPILS-LEVEL | smtPupilsLevel | GCSE, Post-16, Whole school highlights |
| R-SMT-VIEW-PUPILS-NOW | smtPupilsNow | roll and staying on recomputed; boarding tile only at Leighton Park |
| R-SMT-VIEW-SHAPE | smtShape | year groups equal the census; nothing ranked |
| R-SMT-ADMISSIONS-READ-ONLY | smtAdmissionsReadOnly | the empty state, the link, no edit control |
| R-SMT-VIEW-LEAVING | smtLeaving | Year 11 and Year 12 equal the census |
| R-SMT-CONTEXT-GEOGRAPHY | smtContextGeography | every LA has a boundary and its census figure; the district note |
| R-SMT-DATA-GAP | smtDataGap | the gap, the planned sources, "Shade by" later |
| R-SMT-VIEW-CONTEXT-NOW | smtContextNow | births equal ONS's; place line |
| R-SMT-VIEW-BIRTHS | smtBirths | both lines 100 in 2012; projections to 2036 |

The other round 1 rules still apply to the new views: R-SMT-YEARS (no year literal, with the 2025/26 rehearsal), R-SMT-BOARDING-ONLY and R-SMT-NOTES.

## Differences from the wireframes, and why

- **The map shades local authorities,** not neighbourhoods (see the geography table above). At the 5-mile zoom it mostly shows the school's own LA, outlined in violet.
- **The Area pill has no district,** and the place line reads town · LA · region, because no district is held for a school.
- **"Children aged 11–15"** counts pupils in schools within 5 miles, not residents. The tile says "within 5 miles" and the caption says it in full.
- **The projection tile reads "10-year-olds by 2035":** ONS projections are held for age 10 only, in five-year steps. The wireframe drew "11–15s by 2032".
- **Population by age runs 5–15,** the ages the census aggregates hold; the wireframe drew 5–17.
- **The area's school-age population (Pupils, row 2)** is census pupils, not ONS's population by age, which VicData doesn't hold. The caption says so.
- **Five tiles at a boarding school** (Leighton Park): the odd one spans both columns.

## Screenshots

In `docs/v0.8/smt_r2_screenshots/`, drawn by the built components on real data from the routes' own functions (map tiles blocked, as in the parity harnesses):
- `{chase,leighton}_{pupils,context}_{dark,light}_{1440,390}.png`;
- `chase_academic_gcse_sciences_{dark,light}_1440.png`, the fixed Sciences table: Science Double Award 4.89, 1 of 11, 758th of 3,711; FSMQ "different grading scale, not ranked"; the rank tile; the mix from 2021/22; "of entries";
- `chase_pupils_gcse_dark_1440.png`, Pupils at GCSE with Years 7–11 highlighted;
- `context_area_pill_dark_1440.png`, the Area pill;
- `smt_home_dark_390.png`, the home card with all four chips live.

## The re-seed (Guy)

This adds the Pupils and Context dashboards and gives them to SMT. Overview and Academic, and Teacher's and Admissions' dashboards, get no new versions, because their configs are unchanged:

```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/vicdata_seed.sql && supabase db query --linked -f /tmp/vicdata_seed.sql
```

If round 1's seed hasn't been run yet, this one covers all four dashboards.

## Click-through for Guy

1. **Academic → GCSE → Sciences & Maths** (The Chase):
   - Science Double Award reads 4.89, 1 of 11, 758th of 3,711;
   - Additional Maths (FSMQ) reads "different grading scale, not ranked";
   - the fourth tile is "Rank in 10 nearest schools: 2nd";
   - the entries mix runs from 21/22;
   - the band panel says "of entries".
2. **Teacher → GCSE → tick Science Double Award:** it now has an average and a rank in Comparisons.
3. **Pupils:**
   - Your pupils now reads 1,449, ▲ 16%, 50% · 50%, staying on 57%;
   - Shape and size shows Pyramid since 2021/22, with the shapes around;
   - Entry points, or its empty state;
   - Leaving at 16;
   - choose GCSE and Years 7–11 light up.
4. **Context:**
   - The area now shows 3,147 children aged 11–15 within 5 miles, 5,210 births (▼ 17% since 2012), 10-year-olds ▼ 9% by 2035, and 6 secondary schools nearby;
   - the dashed data-gap block;
   - the map;
   - switch the Area pill to Worcestershire.
5. **Leighton Park:** the Day + boarding pill and tile on Pupils, five tiles with the last spanning both columns, and staying on 103% ("more joined than left").
6. **Home, SMT lens:** all four chips live.
