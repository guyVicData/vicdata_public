# Group pools: like for like (the check before M2) — findings and proposal (v1)

Guy's three steps, 8 Nov. **The pools are not like for like.** This is the proposed fix, with before/afters. Stopped here for Guy's answer:
- nothing promoted;
- D9's change not made;
- M2 not started.

The proposal's code is on its own branch, `feat/group-pools-like-for-like` (production repo, worktree `~/dev/vicdata_group_sets`, commit `6148015`). It sits on top of `feat/group-sets-production`, which is untouched.

## 1. Small pools: VicData already has a rule (R-MIN-SCHOOLS)

`src/catalogue/rules.ts`, **R-MIN-SCHOOLS**: "An LA or region benchmark row is suppressed below 5 schools. England is exempt (minimum 1)…". It is enforced in the subject-geography lookups and in the grade-band benchmarks ("fewer than 5 schools").

**The threshold is the same, 5**, so D9 extends R-MIN-SCHOOLS to every group pool rather than adding a rule. The wording:
- the figure: "Too few schools (n)", with no figure;
- the (i): "A pooled figure needs at least 5 schools with the figure (R-MIN-SCHOOLS); fewer would identify them and swing too much to be a benchmark."

(Not built yet, per step 3.)

## 2. Southend East and the school kinds in each pool

**Southend East's non-group-in-its-LAs Attainment 8 of 6.10 is one school: Sutton House Academy (142940), an Academy special sponsor led.** It counts as non-group because it is in no listed group and no single-academy trust.

**What each pool counts today:**

| | Counts |
|---|---|
| **England, non-group, SATs, our areas, mix-matched** (built from `mainstream`: GIAS type groups Academies, LA-maintained, Free Schools, Independent) | special **academies and free schools**, AP academies and free schools, PRUs, LA nursery schools. **Not** GIAS's "Special schools" group (community, foundation and non-maintained special, independent special) |
| **The size bands, all foundation trusts, etc.** (built from the groups' members, with no type filter) | **every member school**, including GIAS's "Special schools" group (85 schools, 24 with A8: 46 in foundation trusts, 31 in federations, 7 in MATs) |
| **The groups' own figures** | every member school, the same as the bands |

So:
- a foundation trust's special schools count in its own figure and in "All foundation trusts", but not in England or non-group;
- a special **academy** counts everywhere.

**How many, 2025/26, members at the time** (full table, both readings: `~/dev/vicdata_group_sets/docs/vicdata_group_pools_school_kinds.md`):

| Pool | Mainstream / special / AP / PRU / nursery | With A8: mainstream / special | A8 now | A8 mainstream only |
|---|---|---|---|---|
| England (all) | 21,772 / 568 / 163 / 137 / 375 | 3,670 / 229 | 47.09 | 47.44 (+0.35) |
| Non-group state | 8,183 / 22 / 6 / 137 / 267 | 567 / 14 | 48.27 | 48.36 (+0.09) |
| Single-academy trusts | 765 / 33 / 12 / 0 / 0 | 441 / 13 | 53.00 | 53.17 (+0.17) |
| All foundation trusts | 238 / 46 / 0 / 0 / 0 | 25 / 14 | 41.45 | 43.79 (**+2.34**) |
| Federations 2–5 | 897 / 31 / 0 / 0 / 98 | 21 / 6 | 42.82 | 44.67 (**+1.85**) |
| MATs 2–5 | 1,147 / 128 / 33 / 0 / 0 | 339 / 50 | 46.92 | 47.74 (+0.82) |
| MATs 41+ (Harris's band) | 812 / 14 / 6 / 0 / 0 | 262 / 7 | 46.09 | 46.22 (+0.13) |
| Harris itself | 54 / 0 / 1 / 0 / 0 | 30 / 0 | 50.99 | 50.99 |
| Listed groups' members, all | 11,867 / 600 / 163 / 0 / 108 | | | (298 groups hold one) |

**Notes:**
- AP and PRUs publish no Attainment 8, so they move rolls but not results.
- Special schools do publish A8 (low), and KS2.
- "Listed now" is within a few schools of these figures.

## 3. The proposal

**One rule for which schools count**, applied to the groups' own figures and every pool alike. Special schools (any kind), alternative provision and PRUs:
- **stay members**: listed, in the school count and on the map;
- are **out of every figure** (roll, results, value added, subject areas, share of places);
- are listed with the reason ("special school: not counted in group figures"), the way IGCSE and outside-England schools are now.

Pools are filtered the same way, so a figure always holds the same kinds of school as what it is compared with.

**The national pools: before (M1, live) → after (variant A)**

| Set | Measure | Before | After | Schools |
|---|---|---|---|---|
| England (all) | Attainment 8 2025/26 | 47.09 | 47.44 | 3,899 → 3,670 |
| England (all) | KS2 RWM % 2024/25 | 63.40 | 63.84 | 15,386 → 15,057 |
| England (all) | Roll 2025/26 | 8,791,004 | 8,688,381 | 22,986 → 22,121 |
| Non-group state | Attainment 8 | 48.27 | 48.36 | 581 → 567 |
| Single-academy trusts | Attainment 8 | 53.00 | 53.17 | 454 → 441 |
| Single-academy trusts | KS2 RWM % | 65.47 | 66.49 | 333 → 312 |
| All foundation trusts | Attainment 8 | 41.45 | 43.79 | 39 → 25 |
| All foundation trusts | KS2 RWM % | 57.65 | 61.72 | 220 → 183 |
| Federations 2–5 | Attainment 8 | 42.82 | 44.67 | 27 → 21 |
| MATs 2–5 | Attainment 8 | 46.92 | 47.74 | 389 → 339 |
| MATs 6–10 | Attainment 8 | 45.71 | 46.26 | 629 → 571 |
| MATs 11–20 | Attainment 8 | 45.79 | 46.15 | 672 → 619 |
| MATs 21–40 | Attainment 8 | 45.42 | 45.87 | 489 → 451 |
| MATs 41+ | Attainment 8 | 46.09 | 46.22 | 269 → 262 |

- **Unchanged:** every independent pool, non-group independent, and federations 6–10.
- **Progress 8 and A-level** move by 0.01–0.03, or not at all.
- **Harris:**
  - its own figures are unchanged apart from its roll (42,940 → 42,938, its one AP school);
  - its areas' A8 50.06 → 50.51;
  - non-group in its LAs 53.36 → 55.44 (41 → 38 schools);
  - mix-matched 50.74 → 50.98.
- **Dukes:** only its areas move (A8 50.03 → 50.38).
- **Groups' own figures:**
  - roll moves for 254 groups;
  - A8 for 88;
  - the largest A8 move is Discovery Schools Academies Trust, 33.19 → 45.60 (4 → 1 schools).
- **Southend East:** its 6.10 disappears. With R-MIN-SCHOOLS on top, the benchmark reads "Too few schools".

Full tables:
- `~/dev/vicdata_group_sets/docs/vicdata_group_pools_before_after_A.md`
- `…_B_nursery.md` (nursery schools as well; variant B)

**Variant B, nursery schools as well:**
- changes **rolls only**: England −35,708 pupils, non-group −25,760, federations 2–5 −8,984;
- no results move, since nursery schools publish none;
- 18 groups' rolls move (federations with a nursery).

## 4. Decisions

```
LF1 The rule: special schools (any kind), AP and PRUs stay members but are out of every figure (the
    groups' own and every pool's), listed with the reason. Recommend yes (variant A).

LF2 Nursery schools as well (variant B)? They publish no results, so only rolls and share of places
    move. Recommend yes: the bands of MATs hold none, while non-group holds 267 and federations 98,
    so leaving them in inflates those rolls against the MATs'.

LF3 Groups made only of special / AP schools. 87 of the 1,784 listed groups have no mainstream
    school (e.g. The Eden Academy, Olive Academies, Raedwald Trust), and 105 are mostly special/AP.
    Under LF1 they would have no figures, and 92 drop out of the library. Options:
    (a) leave them out of the library and the benchmarks for now ("not comparable with mainstream
        groups");
    (b) list them as their own type, "Special and AP trusts" (about 105), with roll and schools only,
        ranked among themselves on roll, and results "not compared";
    (c) a special-school comparison (special pools, England's special schools), in a later round.
    Recommend (b) now and (c) later.

LF4 A mainstream group's one special or AP school (Harris has one AP school): listed as a member,
    not counted, with the reason shown in Schools and the per-school lists. Recommend yes, with the
    count in the "n of m schools" line ("54 of 55 schools; 1 alternative provision not counted").

D9  Confirmed: R-MIN-SCHOOLS (5 schools) extended to every group pool, as in §1.
```

**When you answer:**
1. I'll fold LF1–LF4 into the production branch.
2. I'll re-run the dry run and the before/after on fresh inputs.
3. **I'll wait for your confirmation that `feat/group-sets-production` is merged before promoting.**
4. Then D9 in the app and on to M2.
