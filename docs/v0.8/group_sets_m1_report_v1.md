# Group sets M1 (production): build report

Brief: `vicdata_0_8_group_sets_brief_v2.md` §8 and D1, D4. Done 8 Nov 2026.

## Where the work is

- **Production:**
  - code on `feat/group-sets-production` in `~/dev/vicdata`, worktree `~/dev/vicdata_group_sets`;
  - commits `c64452c` (the changes) and `501fd89` (the before/after table);
  - **not merged**.
- **App:**
  - `feat/group-sets-academic`, worktree `~/dev/vicdata_public_group`, commit `72fa74e`;
  - **not merged**.
- **Live in production now** (D1, made directly):
  - migration `20261108130000_group_sets.sql` applied and recorded;
  - aggregates **build 5** promoted.

> **Production now runs this branch's definitions, but `main` in `~/dev/vicdata` doesn't have them.** A promote from `main` would put the old definitions back: SATs inside non-group, no `sat:all`, no index. Merge `feat/group-sets-production` before anyone runs the next aggregates promote.

## What changed

1. **`group_index_lookup()`**: one jsonb with every listed group's card. 1,784 groups:
   - MAT 1,109, federation 467, foundation trust 73, independent charity 59, independent company 41, independent other 35;
   - each with 2+ current schools; one body under two records listed once (GIAS record first); no sponsor, single-academy trust, umbrella or self-declared records.
   
   A card holds:
   - type, schools (and how many are likely);
   - regions as school counts (the app names them and puts the main one first);
   - schools and pupils by phase, the main phase;
   - roll and its 3-year change (combined and same schools);
   - per phase, the headline (KS2 RWM, A8, A-level APS) in its latest year with England's that year (null = not published);
   - its own peer set and its size.
   
   Through PostgREST as anon: 163 KB compressed, 0.6 s.
2. **`sat:all`**: single-academy trusts' schools pooled, both readings, every year and phase. A new kind `sat` in `group_comparison_lookup`, for state groups only (Dukes gets none).
3. **Peer sets for every type** (D4):
   - `peer:foundation_trust:all` (Guy's `ft:all`) and `peer:independent_other:all`. They are named in the peer family, so they rank and pool exactly like a band, and the lookup labels them "All foundation trusts".
   - **The same gap, found and closed:**
     - other independent groups (35, all 2–5 schools) had no bands;
     - two independent-charity bands held one group each, ranking it "1st of 1": St Peter's College Radley (6–10) and the Girls' Day School Trust (21–40).
     
     Both now rank among all 59 independent charities (`peer:independent_charity:all`).
   - Whole-type sets count every group of the type in the ranking and the pooled figure. `group_peer.n_groups` carries the size (86 foundation trusts have a peer row; 73 have figures and a card).
4. **Non-group redefined** (R-GROUP-NON-GROUP).
   - Each state school counts in exactly one of:
     - a listed group (MAT, federation, foundation trust with 2+ current schools);
     - `sat:all`;
     - non-group.
   - Before, non-group meant "in no MAT or federation", so it held the single-academy trusts and the foundation trusts' schools.
   - Independents are unchanged.
   - The LA and region reweightings (non-group in its LAs, mix-matched) follow.
   - Unit test `every_state_school_counts_once` checks the partition, both readings, every year.
5. **App wording** (`72fa74e`):
   - `peerWords()`: "All foundation trusts" as a set, and "12th of 74 foundation trusts" in a place sentence;
   - the non-group source note now reads "State schools in England in no listed group (MAT, federation or foundation trust of 2 or more schools) and not a single-academy trust: mostly LA-maintained schools. Single-academy trusts are a benchmark of their own." It is also in the method steps;
   - fixtures regenerated, including `group_index_lookup.json`.
   
   The Single-academy trusts entry in the picker comes with M4's Default block.

## Before and after

`~/dev/vicdata_group_sets/docs/vicdata_group_sets_m1_before_after.md` has the full table.
- **Method:** the same inputs (fetched 8 Nov 17:03), computed by `main`'s code and by this branch's, so it shows definition changes only.
- **Reading:** members at the time; each measure's latest year.

**National sets: the ones that move**

| Set | Measure | Before | After | Schools |
|---|---|---|---|---|
| Non-group state | Roll 2025/26 | 3,467,948 | 2,748,895 | 9,626 → 8,603 |
| Non-group state | KS2 RWM % 2024/25 | 63.65 | 63.59 | 7,943 → 7,442 |
| Non-group state | Attainment 8 2025/26 | 50.15 | 48.27 | 1,058 → 581 |
| Non-group state | Grade 5+ E&M % 2025/26 | 52.25 | 48.78 | 1,058 → 581 |
| Non-group state | Grade 4+ E&M % 2025/26 | 70.50 | 68.09 | 1,058 → 581 |
| Non-group state | Progress 8 2023/24 | 0.07 | −0.01 | 1,286 → 810 |
| Non-group state | A-level APS 2024/25 | 36.99 | 35.74 | 730 → 371 |
| Non-group state | All quals APS 2024/25 | 36.18 | 35.00 | 746 → 377 |
| Non-group state | A-level VA 2024/25 | 0.01 | −0.00 | 732 → 372 |
| **Single-academy trusts** (new) | Roll / A8 / P8 / A-level APS | — | 636,115 / 53.00 / +0.22 / 38.10 | 810 / 454 / 453 / 349 |
| **All foundation trusts** (new) | Roll / A8 / A-level APS | — | 98,455 / 41.45 / 33.18 | 283 / 39 / 11 |
| **All independent charities** (new; replaces the two one-group bands) | Roll / A-level APS | — | 99,851 / 44.34 | 215 / 97 |
| **All other independent groups** (new) | Roll / A-level APS | — | 33,423 / 44.44 | 87 / 25 |

**Unchanged:**
- England (all, state, independent);
- non-group independent;
- every MAT and federation band, including MATs 41+ for Harris;
- the other independent-company and independent-charity bands.

The two one-group bands are gone.

**What it means:**
- "Non-group" at secondary is now essentially the LA-maintained secondaries: 581 schools, A8 48.27.
- The single-academy trusts, which it used to absorb, sit well above them: 454 schools, A8 53.00, P8 +0.22.
- Kept together, the two blurred each other. This is the case for D1's split.

**Harris** (its own figures and peer band are unchanged):

| Benchmark | Measure | Before | After | Schools |
|---|---|---|---|---|
| Non-group in its LAs | Attainment 8 2025/26 | 53.27 | 53.36 | 75 → 41 |
| Non-group in its LAs | A-level APS 2024/25 | 37.65 | 34.93 | 61 → 30 |
| Mix-matched non-group | Attainment 8 2025/26 | 52.69 | 50.74 | 323 → 169 |
| Mix-matched non-group | Grade 5+ E&M % 2025/26 | 56.95 | 53.64 | 323 → 169 |
| Mix-matched non-group | Progress 8 2023/24 | 0.30 | 0.22 | 376 → 223 |

The full Harris rows are in the table file. **Dukes: nothing moved.**

**Every group's own-area benchmarks:**
- Non-group in its LAs moved for about 1,200 of 1,455 groups (A8);
- mix-matched for 1,355 of 1,485.

## ⚠ One thing that needs a decision (M1-D9, new)

**"Non-group schools in its LAs" is now often one school.**

| | Before | After |
|---|---|---|
| Groups whose GCSE figure (2025/26) rests on a **single** school | 90 | **168** |
| Groups whose GCSE figure rests on 2–4 schools | 235 | 432 |

That single school can be a very small or unusual one:
- Southend East Community Academy Trust's "non-group in its LAs" A8 went from 68.37 to **6.10**, which is one school;
- Kingston Educational Trust's A-level APS went from 43.22 to 25.69, also one school.

The app shows each figure's school count (R-GROUP-COUNTS), but a benchmark of one school reads as a benchmark.

**Recommendation:** an app-side minimum. A comparison figure resting on fewer than **5 schools** reads "Too few schools (n)" instead of a number, for every pooled benchmark (non-group in its LAs, our areas, mix-matched, a peer band). Production stays as it is (it already gives the n). The same threshold would serve M4's set median (fewer than 4 groups drops the band; D3 already says so).

## Checks run

- **Ingest unit tests:** `tests.test_group_aggregates` 22 pass. Five are new:
  - banded and whole-type peer sets;
  - whole-type ranking;
  - every state school counts once (both readings, every year);
  - the SAT pool and non-group with a school that left its trust;
  - the index listing each body once.
  
  The old peer-band test now expects the new rule: a group alone in its band takes its type's set.
- **PGlite** (`tests/group_aggregates/run_pglite.mjs`, both migrations plus the new one, applied twice): ALL PASS. New checks:
  - `group_index` locked and the lookup open to anon;
  - 1,784 cards, each once; Harris once and its sponsor record never;
  - only the six listed types, all with 2+ schools;
  - Harris's card;
  - a foundation trust ranked among all of them and labelled "All foundation trusts";
  - Dukes gets no `sat` row.
- **Live, after the promote:**
  - `verify`: every lookup (Harris, Dukes, the index) is the **same** as the fixtures;
  - `timing`: aggregate 51–135 ms, comparisons (6 kinds) 28–29 ms, schools 30–39 ms.
- **App:** `src/lib/groups/*.test.ts` on the new fixtures: 50 pass. `tsc` is clean apart from the generated Next route types, which is a known gap.

## Environment notes

- `~/dev/vicdata/.venv` no longer exists. I built Python 3.12 + `requirements.txt` with `uv` in this session's scratchpad and symlinked it as the worktree's `.venv`. The scratchpad is temporary.
- The main checkout needs its own `.venv` back (`uv venv -p 3.12 && uv pip install -r requirements.txt`) before anyone runs an ingest there.

## Guy's commands

```sh
# 1. Look at the before/after table
open ~/dev/vicdata_group_sets/docs/vicdata_group_sets_m1_before_after.md

# 2. When happy: merge production's branch (so the next promote keeps these definitions)
cd ~/dev/vicdata && git status -sb && git merge --no-ff feat/group-sets-production -m "Merge 0.8 group sets M1: sat:all, non-group redefined, whole-type peer sets, the groups index" && git push

# 3. Re-check production any time (read-only)
cd ~/dev/vicdata_group_sets && .venv/bin/python run_group_aggregates.py verify && .venv/bin/python run_group_aggregates.py timing
```

**Rollback**, if ever needed:
1. Promote from the previous `main` (`git checkout a60334f` in a worktree, then `compute --promote`). That rewrites the tables to the old definitions.
2. Re-apply `20261017100000_group_comparison_lookup_order.sql`, and `group_aggregate_lookup` from `20261017090000`. The new table and column are harmless left in place.
