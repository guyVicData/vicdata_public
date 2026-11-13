# 0.8 Non-mainstream groups: production report (milestones 1–4, v1, 13 Nov 2026)

**This report covers the production half only.** The prompt is `docs/v0.8/vicdata_0_8_non_mainstream_groups_claude_code_prompt_v1.md`, with Guy's NM1–NM12. The app half (milestones 5–9) runs later as a separate build.

**Outcome:**
- **The gate passed: every mainstream figure is identical.**
- **Promoted** as group aggregates **build 7**.
- **Verify: every lookup matches the fixtures.**
- One migration was applied live.
- The branch `feat/non-mainstream-groups` (in `~/dev/vicdata`) is **pushed, not merged**. Guy merges.

| | |
|---|---|
| Worktree | `/Users/guy/dev/vicdata_non_mainstream` (branch `feat/non-mainstream-groups`, from `origin/main` 437a211) |
| Commits | `4d7a20d` M1–M3 code and tests · `aab2744` M3 migration, promote, extract/PGlite/verify, gate script · `847e02e` independent special schools out of the pools · `50e3ec2` M4 gate passed, fixtures · `dd1e85d` M4 apply/check/rollback scripts |
| Migration applied live | `20261113120000_non_mainstream_groups.sql`, through `supabase/ops/non_mainstream_groups/apply.sql`: the migration and its `supabase_migrations.schema_migrations` row in one transaction (`supabase db query --remote --yes -f`; no `db push`) |
| Build | 7 (computed 23:34:50 UTC, commit `dd1e85d`'s code; build 6 was 8 Nov) |
| Calls logged | `~/dev/vicdata` `docs/OPEN_QUESTIONS.md`, "2026-11-13 — Non-mainstream groups" (10 calls) |

## 1. The counting rule and the kinds, as built

- **The line (NM1, R-NM-LINE).** A group is non-mainstream when **more than half** of its current schools are special, AP, PRU or nursery. The test is the same as before (`non_mainstream_groups`), and the build fails if the two ever disagree.
- **The family (NM3).** A non-mainstream group's family is the majority kind among its special, AP, PRU and nursery schools:
  - **`nursery`** when its nursery schools outnumber its special, AP and PRU schools;
  - otherwise **`special_ap`**.
  - **One tie:** The Orchards Federation (1768: 1 nursery, 1 special, 1 mainstream) goes to `special_ap`. This call is logged.
- **Stored** in three places:
  - on each group, in the new table `group_kind` (kind, plus current schools by kind);
  - in every aggregate row (`figures.group_kind`);
  - in the build meta (`group_kinds`, and `non_mainstream` with the rule, families, bands, pools and the tie).
- **Counts in build 7:**
  - All aggregated groups with 2+ schools (records): 2,420 mainstream, 156 special/AP, 34 nursery.
  - **Listed** (each body once): **1,642 mainstream, 106 special/AP trusts, 34 nursery federations**. That is the scoping report's 105 + 34 + 1 mixed.
  - 57 of the 140 non-mainstream groups have two schools.
- **The counting (NM2, R-NM-COUNTING).** `counted` is now worked out per group:
  - **A mainstream group:** exactly as before. Special, AP, PRU and nursery schools are listed but not counted.
  - **A non-mainstream group:** the other way round. Its special, AP, PRU and nursery schools make its own figures.
  - **Its mainstream schools** are its **mainstream line**, `figures.mainstream_line`, on each of the group's rows: every phase, results included, finalised like any group figure. It has its own comparisons: kinds `mainstream_line_areas`, `_areas_region`, `_non_group_areas` and `_mix_matched_non_group`.
  - The line is compared against England, non-group and single-academy trusts through the existing set-level kinds.
  - **20 listed groups have a mainstream line, holding 63 schools** (matching the scoping report).
  - In those groups' own exclusion lists, a mainstream school carries the new reason `mainstream_line` ("mainstream school: in the group's mainstream line").
  - A year in which a group had only mainstream schools gets a row flagged `no_own_figures`, so its line isn't lost. There are 46 such group-year-phases.
  - A non-mainstream group's own comparisons over mainstream LA cells (`areas`, `non_group_areas`, `mix_matched`) are **no longer computed**: they would set special schools against mainstream cells.
  - Its own schools get **`kind_areas_region`** instead: the state-funded pools of their own kinds in its regions, weighted to its mix of kinds and regions. This covers roll change and FSM.
- **Share of places** for a non-mainstream group is now measured against its **family's** state-funded pupils in the region (`share.sector` = `special_ap` or `nursery`).

## 2. FSM (NM5)

- **The new input.** `fetch_inputs` now reads `dfe_school_fsm`: `fsm_eligible` and `fsm_eligible_percent`, 154,226 school-years from 2019/20 to 2025/26.
- **The headcount.** DfE doesn't publish the headcount behind the %. (`fsm_pt_pupils` is the performance tables' base, which is different: it matches only 57% of schools.) So the headcount is **implied**, as eligible ÷ %. A school at 0% takes that year's census roll as its headcount.
  - **Checked:** for the Birmingham nursery federation's 9 schools, the implied headcount equals the census roll to within rounding.
  - So a pooled figure reproduces each school's own published % exactly.
- **Pupil-weighted:** a pool's or group's FSM is Σ eligible ÷ Σ headcount. It covers the "all phases" rows only (whole school).
- **Stored** as `figures.fsm` = `{pct, eligible, headcount, n_with_figure}` on every group row, every comparison set, and every reweighted comparison (`fsm: {pct, n_with_figure}`, weighted by the group's FSM headcount in each cell).
  - On each school (`group_school_year`): `fsm: {pct, eligible}` (DfE's own %, 1 dp), plus `pool_kind` and `state_funded` for special, AP, PRU and nursery schools.
- **Mainstream groups get FSM too**, everywhere: as additions only (§4).
- **Peer places** gain `roll_same_schools_1` and `fsm`. They are ranked highest first, as every place is, so **rank 1 = the highest FSM**.
- **R-NM-FSM-NURSERY.** Nursery schools are pooled only with nursery schools (`england:nursery`, `region:nursery:*`, `peer:nursery:all`). A nursery federation's index card carries only the nursery England figure.
  - The one cross-family case: The Orchards' nursery school counts in its own `special_ap` figure, as NM2 is written (logged).

## 3. The pools and the peer sets, with R-MIN-SCHOOLS

**State-funded only (NM6, NM12).** The pools hold:
- GIAS special schools, less non-maintained special schools, special post-16 institutions and **independent special schools**;
- the special and AP academies and free schools;
- PRUs;
- LA nursery schools.

GIAS types 874 "Other independent special school" rows in its *Special schools* type group, so they are excluded by type name. This was caught on the first real dry run: `england:special` held 1,941 schools before the fix and holds 1,068 after it. There is a unit test for it.

R-MIN-SCHOOLS (5 schools) is applied by the app, as for every group pool. Production writes `n_schools` and `n_with_figure`. Members at the time, 2025/26:

| Pool | Schools | With FSM | FSM % | Same-schools 1-yr roll change |
|---|---|---|---|---|
| `england:special` | 1,068 | 1,068 | 50.91 | +4.50% |
| `england:ap` (AP and PRUs) | 297 | 300 | 65.36 | −0.57% |
| `england:nursery` | 375 | 375 | 10.08 | −3.43% |
| *(for reference) `england:state`* | 20,151 | 20,165 | 25.97 | −1.17% |

(Where "With FSM" is higher than "Schools", it's because predecessor schools fold into one unit.)

| Pools by area | Pools | Pass R-MIN-SCHOOLS (5+) | Smallest | Largest |
|---|---|---|---|---|
| `region:special:{code}` | 9 | **9** | 63 (North East) | 168 |
| `region:ap:{code}` | 9 | **9** | 16 (North East) | 48 |
| `region:nursery:{code}` | 9 | **9** | 18 | 74 |
| `la:special:{code}` (special only, NM6) | 150 | **97** (53 fail) | 2 | 29 |

There are no `la:ap:*` or `la:nursery:*` pools.

**Peer sets (NM4).**
- One set per family, holding MATs, federations and foundation trusts together.
- Bands are on current schools, counting every kind.
- A band holding one group falls back to the whole family (none does).

| Peer set | Groups | Schools pooled (special/AP/PRU/nursery only) | FSM % | Same-schools 1-yr change |
|---|---|---|---|---|
| `peer:special_ap:2-5` | 67 (66 + The Orchards) | 174 | 50.53 | +5.15% |
| `peer:special_ap:6-10` | 28 | 158 | 53.42 | +3.12% |
| `peer:special_ap:11+` | 11 | 138 | 55.76 | +5.54% |
| `peer:nursery:all` | 34 | 91 | 13.21 | −4.67% |

All four pass R-MIN-SCHOOLS. A non-mainstream peer set ranks only `roll_change_1`, `roll_same_schools_1` and `fsm`, never results (NM7). A mainstream group can't be in these sets, and a non-mainstream group can't be in a mainstream one.

**Index rows.**
- Every listed group has a card.
- A non-mainstream group's card carries:
  - `kind` and `schools_by_kind`;
  - `peer`, its family's set;
  - `fsm: {pct, n_with_figure, main_kind, england: {kind: pct}}`, for each kind it has;
  - `has_mainstream_line`;
  - `headline: {}` (no results).
- `group_index_lookup()` now returns mainstream cards in **`groups`**, exactly as before, and non-mainstream cards in a new **`non_mainstream`** list (140). So the live library is unchanged until the app reads the new list.

**Mainstream groups' own special, AP and nursery schools (NM11), as data:**
- **161 listed mainstream groups hold 305 such schools.** The scoping report counted 164 and 308 on the 8 Nov inputs.
- Each school's FSM and `pool_kind` are in `group_school_year`.
- Its kind's pools come from `group_comparison_lookup(…, ['pools'])`.
- `figures.kind_lines[kind]` gives roll, change and FSM (no results) where a group has **5+ current schools of one kind**, with AP and PRU counted together. **7 listed groups have one:** Shaw, Central Learning Partnership, Community Inclusive, Reach South, Unity Schools Partnership, Weydon and Eastern Education Group (special, in every case).
  - Shaw: 12 special schools, roll 1,727, FSM 49.85%.

## 4. The gate: before and after

**Method.** One fetch (13 Nov 23:14, the new `fetch_inputs` including FSM) gave one `inputs.pkl`. That file was copied into a detached worktree of `main` (437a211) and both codes ran `compute --dry-run` on it. Then `scripts/non_mainstream_before_after.py` compared every value recursively and exactly:
- keys that are new in the after build are **additions**;
- a changed value, or a key or row that disappears, is a **move**.

I checked the script itself both ways: a planted change of one roll and one school count failed it.

The output is in `~/dev/vicdata` (branch) at `docs/vicdata_non_mainstream_groups_before_after.md`.

**Result: PASSED. Every mainstream figure is identical (0 moves).**

| Table | Rows compared | Moved | Additions only |
|---|---|---|---|
| group_year_aggregate (2,420 mainstream groups, every row) | 98,827 | **0** | `group_kind`; `fsm`, `schools_by_kind` ("all" rows); `peer.places.roll_same_schools_1` / `.fsm`; `kind_lines` (186 rows) |
| group_comparison (mainstream groups) | 391,976 | **0** | `fsm` |
| group_comparison_set (every set that existed before) | 26,364 | **0** | `fsm` |
| group_school_year (every school-year) | 92,080 | **0** | `fsm`, `pool_kind`, `state_funded` |
| group_peer (mainstream groups) | 1,682 | **0** | none |
| group_index (mainstream cards) | 1,642 | **0** | `kind`, `schools_by_kind`, `fsm`, `has_mainstream_line` |
| group_membership_year | 179,283 | **0** | none |
| new rows for mainstream groups | – | **0** | – |

The regenerated Harris and Dukes fixtures are also identical to the committed ones apart from new keys, so there has been no data drift since 8 Nov. A trial gate on the 8 Nov inputs passed as well.

## 5. The non-mainstream groups' new figures

- **All 190 non-mainstream records (140 listed) now have figures of their own.**
- Before, only the 34 records with mainstream schools had any, and those figures were over their mainstream schools. The rest had none.

Five named examples, members at the time, 2025/26:

| Group | Kind, peer set | Own schools (by kind) | Roll | 1-yr change, same schools | FSM % | Peer set FSM | England FSM (its kind) | Before | Mainstream line |
|---|---|---|---|---|---|---|---|---|---|
| **Nexus MAT** (16125) | special_ap, 11+ (11 groups) | 18 counted (21 special, 1 AP, 1 mainstream current; 3 opened after the census) | 2,808 | +6.85% | **53.39** | 55.76 | 50.91 (special) | roll 409 over its 1 mainstream school | Crags Community School: roll 409, FSM 54.5% |
| **Wellspring Academy Trust** (5252) | special_ap, 11+ | 17 (9 special, 8 AP; 16 mainstream) | 1,895 | +5.39% | **64.16** | 55.76 | 50.91 | roll 5,803 over its 16 mainstream schools | 16 schools, roll 5,803, FSM 38.44% |
| **The Eden Academy** (3004) | special_ap, 6–10 (28) | 9 special | 1,140 | +4.87% | **44.04** | 53.42 | 50.91 | no figures | – |
| **WAVE MAT** (2067) | special_ap, 11+ | 11 (10 AP, 1 special) | 497 | +3.97% | **64.37** | 55.76 | 65.36 (AP) | no figures | – |
| **Birmingham Federation of Maintained Nursery Schools** (17126) | nursery, all (34) | 9 nursery | 924 | −7.69% | **31.51** | 13.21 | 10.08 (nursery) | no figures | – |

A sixth example: KSENT (16368, a foundation trust) has 11 special schools, roll 3,349, FSM 49.52%, and had no figures before.

## 6. Promote, verify, timings

- **Fetch** (the new inputs, FSM included): 13.5 min (807 s inputs, then subjects).
- **Dry runs:** about 45 s each (the old code 44 s, the new code 46–49 s).
- **PGlite** (`tests/group_aggregates/run_pglite.mjs`, with the new migration): **80 checks, all pass**. The new checks cover:
  - kinds;
  - Nexus's own figures, FSM and mainstream line;
  - the pools: kind-only, phase "all", special LA pools;
  - Birmingham's nursery-only pools and its peer label "All nursery federations";
  - Shaw's special pools and kind line;
  - the index's separate list;
  - the row cap.
- **Apply and rollback** (`supabase/ops/non_mainstream_groups/ops_pglite.mjs`): all pass. They cover apply twice, old-shape data reading the same, rollback restoring the lookups, and reapply.
- **Unit tests:** 74 pass. That is the 63 from before, with 2 updated for NM4/NM10 (SPG now has its family's peer set and a flagged card), plus 11 new in `tests/test_non_mainstream_groups.py`.
- **Promote:** 1,134 s (18.9 min; it refetched), giving **build 7**:
  - 179,283 membership years
  - 92,080 school-years
  - 106,996 group rows
  - 1,822 peers
  - 36,148 sets
  - 404,164 comparisons
  - 1,782 index rows
  - 2,610 group kinds
- **Verify:** all **23** calls (Harris, Dukes, Nexus, Birmingham and Shaw, plus the index) are **SAME** on production.
- **Timing** (production, cold to warm), all under 600 ms:
  - Harris: 54–221 ms.
  - Nexus and Birmingham: 28–589 ms.
  - Shaw: 29–61 ms.
  - Dukes: 347–468 ms.
- **As anon through PostgREST:** `group_index_lookup` answers build 7 with **1,642** cards in `groups` and **140** in `non_mainstream`. `group_kind` refuses anon (401). All tables stay locked.

## 7. The fixtures

The fixtures are in **`/Users/guy/dev/vicdata_non_mainstream/docs/group_aggregates_fixtures/`** (after Guy's merge: `~/dev/vicdata/docs/group_aggregates_fixtures/`). They are in the same shape as `docs/v0.8/groups_fixtures`, and `manifest.json` lists every call.
- **Harris (3320) and Dukes:** regenerated. Same calls as before, identical apart from new keys.
- **`nexus_*` (16125), `birmingham_*` (17126), `shaw_*` (4499):** `group_aggregate_lookup` for both readings, `group_comparison_lookup` and `group_schools_year_lookup`.
  - Nexus and Birmingham were called with `['peer_band','pools','kind_areas','mainstream_line','england','non_group','sat']`.
  - Shaw was called with the usual six kinds plus `'pools'`.
- **`group_index_lookup.json`:** now with `non_mainstream` alongside `groups`.

Copying them into the app's `docs/v0.8/groups_fixtures` is the app half's job. I made no change to this repo apart from this report.

## 8. For the app half

- **The library.** Read `group_index_lookup().non_mainstream` for the separate section; `groups` is unchanged.
  - The cards' fields are listed in §3.
  - The scoping report's "57 of these groups have two schools" still holds (57 of 140).
- **The group dashboard.**
  - `group_aggregate_lookup` → `group.kind` (`mainstream` / `special_ap` / `nursery`) and `group.schools_by_kind`.
  - Rows' `figures.fsm`, `schools_by_kind`, and `mainstream_line`, which has the same shape as a group figure, in every phase.
  - Rows flagged `no_own_figures` hold only a line.
  - The `excluded` reason `mainstream_line`.
  - `share.sector` = the family.
- **Results stay in production's figures for non-mainstream groups** (DfE's own numbers). The app shows none (R-NM-NO-RESULTS). The same goes for `subject_areas`: for a non-mainstream group they come from its mainstream schools, so hide them.
- **`group_comparison_lookup`.** The existing kinds answer as before. The new kinds:
  - `pools`: variant `england:{kind}` / `region:{kind}` / `la:special`. Labels read like "State-funded special schools, Yorkshire and The Humber". Phase "all" only. There is one row set per kind, region and special LA where the group has a current state-funded school of that kind. This works for mainstream groups too, for NM11's placing.
  - `kind_areas`: variant `region`, the group's own schools against same-kind pools, weighted to its mix.
  - `mainstream_line`: variants `areas_la`, `areas_region`, `non_group_areas`, `mix_matched`.
  - `peer_band` labels for the families: "Special and AP trusts with 2-5 schools", "All nursery federations".
  - For a non-mainstream group, `england`, `non_group` and `sat` are the **mainstream** pools, so use them for the mainstream line only.
  - A non-mainstream group has no `areas`, `non_group` areas or `mix_matched` rows.
- **Apply R-MIN-SCHOOLS to the new pools.** 53 of the 150 `la:special` pools are under 5. The region pools and peer sets all pass.
- **`group_schools_year_lookup`.** `figures.counted` is still per school, by kind, so it means "counts in a mainstream group". **In a non-mainstream group the app must invert it from `group.kind`:** special, AP, PRU and nursery schools count there, and mainstream schools are the line.
  - Each school also has `fsm {pct, eligible}`, `pool_kind` and `state_funded` (special, AP, PRU and nursery only).
  - For NM11: place each such school's `trend` (roll change) and `fsm.pct` against `pools` `region:{pool_kind}`.
  - The pooled line is `figures.kind_lines[kind]`, only at 5+ of a kind.
- **Peer places:** the new `fsm` place counts rank 1 as the **highest** FSM, so word it with care. Non-mainstream peer sets have no results places.
- **FSM precision:** pools and groups are stored to 2 dp, schools to DfE's 1 dp. Show 1 dp, as the app does elsewhere.
- **The nursery FSM (i):** a nursery federation's figures only ever meet nursery figures. The Orchards (special_ap, with 1 nursery school) is the one cross-family group.
- **Group sets (R-NM-SETS):** enforce by `group.kind` / card `kind`. Production has no set rules.

## 9. Later production rounds (not built)

1. **SEN in England:** EHCP share, SEN support and primary need, per school (DfE, Special educational needs in England).
2. **Destinations:** KS4, then 16–18 (DfE destination measures; cohorts under 6 are suppressed).
3. **Ofsted:** state-funded schools' inspections and outcomes (MI). **Open question for Guy:** which judgements count as comparable across the pre-2024 grades, the 2024–25 no-grade inspections and the report cards since Nov 2025. This is decided when that ingest is scoped (NM9).
4. Then KS4 Attainment 8 per school, within need type, once primary need is in (NM7).

## 10. Nothing blocking

- The `~/dev/vicdata` main checkout and `~/dev/vicdata_group_sets` were not touched; the uncommitted `.env.example` in `~/dev/vicdata` was left alone.
- The scratch worktree of main used for the "before" run is detached, in the session scratchpad. It can be removed with `git -C ~/dev/vicdata worktree prune` once the scratchpad goes.
- **Guy:** merge `feat/non-mainstream-groups` into `main` in `~/dev/vicdata`. Production already runs build 7 from it, along with migration `20261113120000`.
- **Rollback, if ever needed:** run `supabase/ops/non_mainstream_groups/rollback.sql`, then re-promote from main.
