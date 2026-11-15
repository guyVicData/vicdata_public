# D-c scope: groups compare subjects and subject areas (internal and external)

Read-only scoping, 15 Nov 2026. Checked against `~/dev/vicdata_public` (main, 4e53cfd), `~/dev/vicdata` (b03bb0f) and production `hrqrbvrrhlidpoybezhs` (read-only SELECTs). No files changed and no scripts left behind.

## 1. What exists today

**Only subject areas (families), never single subjects.** The group dashboards hold no subject-grain figure anywhere.

- **Production** (`ingest/group_aggregates.py:1612-1619`, `subject_stats` / `subject_areas_for` at 1691-1726):
  - Source: `academic_subject_family_rollup` (bucket `all`, from period 2021).
  - Figure: points per entry = Σpoints_weighted_sum / Σpoints_size_units over member schools. That is **entry-weighted** (size-unit-weighted at KS5), not pupil-weighted. It also gives entries and n_schools, and a `shown` flag.
  - Minimum: a school counts in an area only with 10 or more entries in it (`SUBJECT_MIN_ENTRIES`), and the area shows only where 2 or more schools count (`SUBJECT_MIN_SCHOOLS`). The app mirrors this as `SUBJECT_AREA_MIN`.
  - IGCSE: at KS4 an IGCSE school drops out only of the families it leaves incomplete (Sciences & Maths without Maths, Languages & Literature without English Language).
  - Non-mainstream: schools that are not counted (special, AP, PRU, nursery) are dropped.
- **Where it is stored**: `figures.subject_areas.{ks4,ks5}` on every `group_year_aggregate` row, for phase secondary (ks4), post16 (ks5) and all (both), in both readings and every period.
  - At_time rows with areas: ks4 for 1,223, 1,238 and 1,260 groups (periods 2023, 2024, 2025); ks5 for 972 and 998 groups (2023, 2024). Ks5 has none for 2025: Post-16 subject data ends at 2024.
  - Harris (3320): 5 KS4 years.
  - Also on `group_comparison_set` for `england:all`, `non_group:{state,independent}`, `sat:all` and every `peer:*` band (16 of 19 at_time secondary sets have them).
  - **Missing on**: `region:*` and `la:*` sets, and on every `group_comparison` kind (areas, areas_region, mix_matched, kind_areas, mainstream_line_*). The build feeds only england, non_group, sat and peer sets (`Xs`, line 1576).
- **App**:
  - Builder: `src/lib/groups/dash-r3.ts:146-164`. View: `SubjectAreasAcross` (`views-r3.tsx:172`), id GRP-A-AREAS, sharing the large slot with GRP-A-RANKED and GRP-A-VA.
  - It shows **the latest year only**: the gap to England in points per entry, with the compared set's figure available on hover only. It names the 2 strongest and 2 weakest areas against England, and labels the view "described, not ranked".
  - Phases: GCSE and Post-16 (Post-16 is a single "all" bucket, so A level, BTEC and the rest are blended); nothing at KS2.
  - It shows no grade measures, no trend, no ranking against peers and no subjects.
  - Walk: `group-academic`'s screen "Which subject areas lead?" (`walks.ts:336`).
- **The other groups' areas are already reachable.** `group_comparison_lookup` with `peer_named:<id>` returns another group's full `group_year_aggregate` figures, `subject_areas` included (migration 20261113120000, line 128). That makes nearest-in-size at family level a single call.

## 2. Internal comparison (rank the group's schools on a subject)

**This can be built in the app. Production isn't needed.**

- **Reads**:
  - `qualRows(urns, stage, from)` (`src/lib/smt/academic-data.ts`), which SMT Academic already uses: KS4 from `academic_subject_headline_lookup`, KS5 from `academic_subject_qualification_headline_lookup` (by exact qualification).
  - Merge with `subject-match.ts` (`sameSubject`, `mergeFigures`) so that "Art and Design (all titles)" works.
- **Cost for Harris (59 current schools; 34 with KS4 subjects in 2025 and 32 with KS5 in 2024)**:
  - From 2021 on: about 4,500 KS4 rows and 2,650 KS5 rows.
  - `inEntityChunks` runs 20 schools per chunk, sequentially, at 1,000 rows per page. That is 3 chunks × 1-3 pages, so about 5-8 RPC calls per stage. Passing only the phase's schools brings it to 2 chunks.
  - Hour cache. Same order of cost as an SMT set.
- **Family level**: `academic_subject_family_lookup` takes `p_entity_ids` unchunked; about 3,000 rows (3 pages).
- **Grades (4+/7+, A*-B)**: `academic_subject_grade_rollup_lookup`, chunked the same way, roughly ×5 the rows. Do it in a later milestone.
- **Ranking engine**: `academic_subject_rank_lookup` (`subject-ranking.ts`) takes any population of URNs, so it would rank within the group in 1 call. But it matches **single titles only**: subject-match isn't applied, and `appliesTo` in R-SUBJECT-MATCH leaves rankings out. Either rank in the app from `qualRows`, or extend the RPC.
- **Rules to carry**:
  - R-MIN-ENTRIES (5) to be ranked on points; entries ranked from 0.
  - Ties shared; R-POINTS-SAME-QUAL.
  - R-IGCSE-SUBJECT (IGCSE schools are ranked in subjects they entered as GCSE).
  - `memberOf` / reading, as in the schools ranking.

## 3. External comparison

| Against | Family level | Subject level |
|---|---|---|
| England | exists (`england:all`, every year) | exists: KS4 `academic_subject_geography_lookup` national (avg_point_score, 2021-2025); KS5 only by qualification via `academic_subject_qualification_geography_lookup` (2021-2024). The plain subject geography is **KS4 only**. `subjectAreaRows()` already merges titles |
| Region | **missing** (no subject_areas on `region:*` sets) | exists, same lookups (region rows, min 5 schools per title) |
| Peer band (e.g. Harris: `peer:mat:41+`, 16 groups) | exists as a pooled figure; **no place** among the band | **missing**. App-side would mean about 1,000 schools, about 50 sequential chunks: not viable |
| Nearest in size (5) / named set (≤8) | exists via `peer_named` (1 call) | app-side possible (5 × ~30-60 schools, about 15-25 chunks, several seconds cold) but fragile. Production is better |
| Grade measures | none | KS4 and KS5 region/England from `academic_subject_grade_geography_aggregate`; groups none |

**Missing in production**: a group subject aggregate and its lookup.
- **Table** `group_subject_year`, with columns group_id or set_id, reading, period, stage (ks4/ks5), and `figures jsonb` holding `[ {subject_key, qualification (ks5), entries, points_per_entry, n_schools, shown, place?: {rank, of}} ]`.
  - Rows: one per group×period×stage×reading. That is about 1,260 + 1,000 groups × 5 years × 2, roughly 22k rows, plus about 40 sets.
  - The payload inside covers about 25k KS4 and about 20k KS5 group×subject pairs per year (counted live for current members, 2025/2024).
- **Inputs**: `academic_subject_rollup` (758k bucket-`all` rows from 2021) for KS4, and `academic_subject_qualification_rollup` (386k) for KS5. Both have points_weighted_sum and size units, so the merge is exact.
- **RPC** `group_subject_lookup(p_group_id, p_reading, p_stage, p_peer_ids text[] default null)`, returning the group's rows, the sets it compares with (england, region of each of its schools' regions, peer band, sat, non_group) and any named peers' rows.
- **Build cost**:
  - Fetch: about 1.1M more rows, maybe 1-2 minutes on the 13.5-minute fetch.
  - Compute: the same merge and groupby as `subject_areas_for` on about 4× the rows, so seconds.
  - Peer places: one rank per (band, subject, period), cheap.
  - Promote: about 22k jsonb rows, about the size of `group_year_aggregate`, so a few minutes.
  - Gate: existing figures stay byte-identical (an additive table).
- **Family gaps, one line each**:
  - add `region:*:all` to `Xs` for subject areas;
  - add `places` (rank among the peer band) to each area.

## 4. Subject areas (families)

- **Families**: 8, from `subject_families`: sciences_maths, humanities_social, languages_literature, arts_media_design, business_law, technology_eng_construction, health_care, enterprise_applied. They match the ids in `subject-family-colours.ts`.
- **Internal**: per-school family figures through `academic_subject_family_lookup`, one call. The app has to apply the IGCSE incomplete-family rule (`igcseFamilyIncomplete`) and the counted rule itself, or production could add per-school areas to `group_school_year` (exact, and consistent with the group figure). Recommend production.
- **External**: England, peer band, sat and non_group exist for every year. Nearest/named works through `peer_named`. Region needs the one-line build change above.
- **Trends**: data exists from 2021 (KS4) and 2020/21 (KS5) on, yet the app shows the latest year only. Pure app work.
- **Caveat**: families are coarse (Geography and History are both humanities_social). Guy's "subject areas" might mean the wireframe chips (English · Maths · Sciences …), which r3's report says aren't built.

## 5. Edge cases

- **Non-mainstream groups**: their figures are over special/AP/PRU/nursery schools, which are not counted for areas. They get no areas, so the view should keep the "no results compared" state (`dash-nm.ts`). Their `mainstream_line` has no subject_areas today. Decision below.
- **Mixed phases**: the stage follows the phase chip (secondary → ks4, post16 → ks5; "all" carries both, and the view picks one). A primary-only group gets nothing (KS2 has no subjects). Post-16 should go **by qualification group** (A level / applied / IB), as SMT does: today's single ks5 "all" bucket mixes the A level and BTEC points scales.
- **IGCSE**:
  - Subjects: per R-IGCSE-SUBJECT, an IGCSE school counts in every GCSE subject it entered. Its English Language and Maths are absent, so say so ("n schools took it as IGCSE").
  - Families: the incomplete-family rule, as now.
- **Small numbers**:
  - Per school: R-MIN-ENTRIES 5 to be ranked, versus 10 for areas; pick one.
  - Group figure: the area rule is 2 schools with 10+ entries.
  - Pools: R-MIN-SCHOOLS 5 for pools (band, sat, non_group, region); England, named groups and the group itself are exempt.
  - Geography: the region and LA rows enforce 5 schools **per title**, so a merged family can disappear even where the merged total passes.
- **Subject-match in production**: production has no subject codes and no equivalence list. The group subject aggregate needs `SUBJECT_FAMILIES` either as a production table both sides read, or ported to Python and kept in step by a test like the PGlite subject-latest-names check (which already drifted once: 31 vs 47). The alternative is to store per title with sums and merge in the app. Merging is exact for points, but n_schools and the minimum go wrong for a school offering two titles.
- **Latest years**: KS4 ends at 2025 and KS5 at 2024. A "both phases" view shows two different years, so label each.

## 6. Design

The question, as a new walk or extending `group-academic`: **"Which subjects lead in our group, and how do we compare?"**

1. **GRP-A-AREAS, extended**: switch between the gap to England and the gap to the chosen comparison (set, band, region). Add the peer-band place ("4th of 16 MATs 41+"). Reuse the existing gap bars.
2. **GRP-A-SUBJECTS (new, large slot)**: the group's subjects in the focused area as rows: group points per entry, England, the chosen comparison, the gap, entries and schools. Reuse SMT's `AreasView` / `AreaRows` dot rows, or the side-by-side `ChartTable`. Click a subject to open 3.
3. **GRP-A-SUBJECT-SCHOOLS (new)**: the group's schools ranked on one subject (points, entries, later grade 4+/7+), with the group, region and England marks. Reuse `RankChart` / `RankTable`, and the front-door `Ranking` for the walk. Small cohorts listed as "too few entries"; IGCSE noted.
4. **GRP-A-SUBJECT-PEERS**: the group against nearest-in-size or named groups on a subject or area. Use the `DumbbellChart` (group to comparison) or the ranked bars.
5. **Trends**: the area's or subject's points per entry over years, group against England and the set's band. Reuse `AcTrendChart` / `TrendBand` or the group trend lines.
6. **Focus**: add the second row of area chips under GCSE / Post-16 (spec §2.2, not built). Every Academic view follows it.

## 7. Plan, effort, decisions

**Milestones**

- **A1, app only (about 2-3 days)**:
  - area trends;
  - areas against the chosen set and nearest-in-size (through `peer_named`);
  - GRP-A-SUBJECT-SCHOOLS from `qualRows` + subject-match (internal ranking, points and entries);
  - subject vs region/England from `subjectAreaRows()`;
  - the walk screens.
- **P1, production (about 2-3 days with gate, PGlite, apply)**:
  - region sets for areas;
  - peer places for areas;
  - per-school areas in `group_school_year`;
  - `group_subject_year` + `group_subject_lookup` (KS4 subjects, KS5 subject×qualification);
  - subject-match equivalence as a table.
- **A2, app (about 2 days)**:
  - GRP-A-SUBJECTS against peer band, sat and named groups, with places;
  - Post-16 by qualification group;
  - the area chips.
- **P2/A3, optional (about 2-3 days)**: grade measures (4+/7+, A*-B) for groups from `academic_subject_grade_rollup`.

**Decisions for Guy**

1. **Measure.** Points per entry, entry-weighted (as now), not pupil-weighted. *Recommend*: keep it, and say so on the view.
2. **Ranking the schools within the group.** The areas are "described, not ranked" today. *Recommend*: rank schools within the group on a subject (it's what was asked); keep the group-vs-England view descriptive.
3. **Where peer and subject figures come from.** *Recommend*: production (`group_subject_year`), not app fan-out. Build A1 first, since it needs no production.
4. **Subject-match in production.** *Recommend*: a shared equivalence table that production writes and the app reads, with a test, rather than a Python copy.
5. **Small numbers.** *Recommend*: one per-school minimum for subjects (R-MIN-ENTRIES 5, as the rest of the app), keep 10 for areas, and R-MIN-SCHOOLS 5 for pools.
6. **Post-16.** *Recommend*: by qualification group (A level / applied / IB), not the blended bucket.
7. **Non-mainstream groups.** *Recommend*: none of their own; show their mainstream line's areas only where it has 5+ schools (as the build's KIND_LINE_MIN does for kind lines). This needs subject_areas on `mainstream_line`, a small P1 addition.
8. **Grades.** *Recommend*: later (P2), after points and entries.
9. **What "subject areas" means.** *Recommend*: VicData's 8 families, with the subjects inside them one click down. Leave the wireframe's English/Maths/Sciences chips.
