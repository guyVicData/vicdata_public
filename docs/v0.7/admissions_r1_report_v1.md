# VicData 0.7 — Admissions round 1 (data layer) report

Branch `v0.7-admissions-r1` (vicdata_public, pushed) and `feat/admissions-derived` (ingest repo, committed, **not pushed**). There is no dashboard UI this round. Both migrations are written and tested, **not applied**. Nothing is merged.

Teacher, the Data View and the public page are unchanged: the parity harness against `main` gives 2,875 pairs identical.

## 1. What was built

| Stage | Commit | What |
|---|---|---|
| A1 | fd94b63 | `src/lib/admissions/`: cohort definition, entry points, the cohort ladder (counted rungs, births split 8/12 + 4/12 and calibrated to the set, drift p10/p90, handovers between kinds of school, 11+ projection overlay off by default, past pools), LA blend, shares, flow, shape, data fetchers (predecessor years for converted schools), default rung sets, pipeline and market. `ADMISSIONS_NOTES`. Eight rules R-ADM-*. |
| A2 | ingest 4f95fff | Migration `20261007220000_admissions_derived.sql`: `school_cohort_flow` (cohort, joiners lower bound, leaving share at 16) and `admissions_flag_thresholds` (national 20th / 80th percentiles of change), with anon lookups. Built in SQL in timed steps, rebuilt on promote, `backfill_admissions_derived.py` with `--dry-run`. |
| A3 | 1de5af8 | Migration `20261106090000_v07_admissions_r1.sql`: `school_memberships.admissions_lead` (a flag on the `admissions` role, guarded), `admissions_grants` provenance, `admissions_set_member()` for the lead's delegated granting, audit rows in `platform_audit_log`, `admissions_entry_points`, `admissions_lists`, `admissions_list_shares`. `ADMISSIONS_LEAD_LABEL` / `admissionsLabel()` in `src/lib/roles.ts`. |
| A4 | 13b7a08 | Rivals' ranks (national and regional headline, families, subjects, size) and flags: `ranks.ts`, `thresholds.ts` (reads `admissions_flag_thresholds_lookup()`; absent → no threshold flags), `flags.ts` (`FLAG_RULES`), `rivals.ts`, `feeders.ts`. Four more rules. |
| A5 | 53c4255 | `admissionsCaller` (Admissions, SMT, School-Admin, platform admin) and the routes `/api/admissions/{pipeline,market-share,rivals,shape,lists}`. Timing and hand-check scripts. |

No server key is in client code: every admissions module is server-only, and the routes use the caller's session plus the anon reference lookups.

## 2. Hand-checks

The full census rows are in `docs/v0.7/audit_scripts/admissions_r1_handcheck.out` (script alongside).

**The Chase 137625, 11+** (15 nearest state primaries). Set sums from raw census rows: age 10 in 2024/25 = **401**, age 10 in 2025/26 = **382**, age 9 in 2025/26 = **334**, age 4 in 2025/26 = **286**.

The library gives:

- **Past pools:** 2025 = 401 and 2026 = 382 (counted).
- **Future pools:** 2027 = 334 [329–344] … 2032 = 286 [260–342] (counted, carried with drift); 2033–2036 from births: 303, 295, 290, 291.
- **Drift:** 0.9841–1.0305 (35 matched ratios).
- **Births calibration:** 0.0618 (0.0563–0.0661).
- **Blend:** Worcestershire 87.4%, Herefordshire 12.6%.
- **Share needed:** 236 / 401 = **58.85%** this year; 70.66% in 2027.

Grove Primary 151298, a conversion, reads its predecessor's 2024 row (18). Without that, the 2025 pool read 383.

**King's School, Worcester 117037, 11+ market share** (10 nearest schools teaching Year 7, plus King's):

| Year | King's | Area total | Share | Rank |
|---|---|---|---|---|
| 2023/24 | 99 | 1,709 | 5.79% | 8 of 11 |
| 2024/25 | 123 | 1,694 | 7.26% | 8 of 11 |
| 2025/26 | 101 | 1,531 | 6.60% | 8 of 11 |

**Ranks:** The Chase's Attainment 8 is 897th of 4,736 nationally and 69th of 545 in the West Midlands; size band XL. **16+ handover ratio** (primaries → secondaries) 4.74–5.44.

## 3. Tests

- **Rule tests** (`scripts/catalogue-rule-tests.ts`): PASS 32, FAIL 0, including the 12 new ones:
  - R-ADM-LADDER, R-ADM-BIRTH-SPLIT, R-ADM-DRIFT-RANGE, R-ADM-HOLD-SHARE, R-ADM-GROUP-SHARE, R-ADM-JOINERS-ESTIMATE;
  - R-ADM-SHAPE-NOT-RANKED, R-ADM-POOL-NOT-INTAKE, R-ADM-RIVAL-RANKS;
  - R-ADM-FLAG-MOMENTUM, R-ADM-FLAG-STRENGTHS, R-ADM-FLAG-FEEDER.
- **App:** tsc, eslint, 381 unit tests and the build, all clean.
- **RLS** (`supabase/tests/v07_admissions_rls_pglite.mjs`, output `.out` beside it): **84 / 84 PASS**, ending "ALL PASS". It runs on PGlite with the real 0.6 S1 and membership-hardening migrations underneath. It covers:
  - who can set the lead flag;
  - the lead granting and removing only Admissions, and only grants a lead made;
  - audit rows for every grant, removal and flag change, including the School-Admin's;
  - list and share read/write by role, team and user;
  - share stamps not spoofable;
  - re-running the migration over itself.
- **Ingest:** 40 unit tests OK. The A2 PGlite test applies the real migration to exported production rows and passes 9 / 9: SQL equals the Python reference (496 cohort-flow rows, 11 thresholds, to 1e-9); 151298's age 10 in 2024 = 18; and the lookups, access and constraints behave.

## 4. Independent review of A3

A separate reviewer agent read the migration, ran the RLS test (byte-identical output) and wrote probes. **No critical or high issues.** Everything it raised in this migration is fixed; the RLS test grew from 61 to 84 checks to cover each fix.

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Medium | Provenance went stale when the legacy `role` column was written (S1's trigger rewrites `roles`, but a column-list trigger didn't fire), so a lead could remove a School-Admin's grant | Provenance trigger is `after insert or update` with no column list; it compares old and new `roles` |
| 2 | Low | A lead losing the role cleared the flag but wasn't audited | The flag audit trigger has no column list |
| 3 | Low | The School-Admin's own Admissions grants and removals weren't audited | `admissions_admin_grant` / `admissions_admin_remove` rows |
| 4 | Low | `admissions_list_shares.created_by` / `created_at` could be set by the client | Stamp trigger on insert |
| 5 | Low | SMT could edit or delete any share | SMT changes only its own shares; the School-Admin and the lead can change any |
| — | Ops / nits | Comments, ordering, the runbook | Done |

**Left for you, outside this migration:** the 0.6 S1 `sync_membership_roles` trigger has the same unguarded `''::jsonb` cast on an empty claims setting. A one-line `nullif` fixes it.

## 5. Migrations and apply commands, in order

**1. App DB: the A3 migration.** It needs 0.6 S1 and `20261104090000` (membership hardening) applied first.

```
cd ~/dev/vicdata_public && git checkout v0.7-admissions-r1 && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261106090000_v07_admissions_r1.sql && supabase migration repair --status applied 20261106090000 --linked
```

**Make the first lead** (SQL editor on the app DB; replace `<id>` with the membership id):

```
begin; select set_config('request.jwt.claims','{"role":"service_role"}', true); update public.school_memberships set admissions_lead = true where id='<id>' and 'admissions' = any(roles); commit;
```

**2. Production: the A2 migration, then the backfill.** The ingest branch sits on `feat/post16-neighbours` and `feat/subject-rank-lookup`, so push it first; it carries both. Apply their migrations (`20261007200000`, `20261007210000`) first if they aren't applied yet. Full steps and verify queries are in the ingest repo's `docs/vicdata_admissions_derived_build_report_v1.md` §6.

```
cd ~/dev/vicdata && git push -u origin feat/admissions-derived
```

```
cd ~/dev/vicdata && git checkout feat/admissions-derived && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && supabase db query --linked -f supabase/migrations/20261007220000_admissions_derived.sql && supabase migration repair --status applied 20261007220000 --linked
```

```
cd ~/dev/vicdata && test "$(cat supabase/.temp/project-ref)" = "hrqrbvrrhlidpoybezhs" && .venv/bin/python backfill_admissions_derived.py --dry-run && .venv/bin/python backfill_admissions_derived.py
```

The dry run takes about 13.5 minutes and the write about the same. Every step has a 5-minute cap and logs its progress.

Until step 2 is applied, the app shows no threshold flags ("thresholds not loaded"), and nothing is guessed in their place. Everything else works without it.

## 6. The A2 dry run (production, read-only)

The first run hung overnight: its connection dropped with no statement timeout and no keepalive. It was stopped and rebuilt:

- 15 s connect timeout and TCP keepalives;
- `statement_timeout = 5min` per step;
- a log line per step (label, rows, elapsed);
- every aggregate in SQL (`percentile_cont` over grouped `filter` pivots instead of self-joins, and only the CTEs each step needs).

**Run:** 8 Oct 2026, **810 s** in total. Thresholds took 254 s (census 131 s, KS2 121 s, GCSE / Post-16 headline 0.5 s, subject area 1.1 s); the cohort flow took 68–82 s per census year. Log: ingest `docs/admissions_derived_dryrun_2026-10-08.txt`.

**Cohort-flow rows per year:** 2019: 173,173 · 2020: 226,412 · 2021: 225,286 · 2022: 223,343 · 2023: 220,618 · 2024: 217,092 · 2025: 213,644.

| Phase | Measure | 20th / 80th | Schools | Years |
|---|---|---|---|---|
| Primary | entry cohort | −19.61 / 10.00 % | 14,851 | 2023–25 |
| Primary | roll | −8.92 / 2.59 % | 14,851 | 2023–25 |
| Secondary | entry cohort | −16.09 / 5.34 % | 4,814 | 2023–25 |
| Secondary | roll | −5.76 / 5.51 % | 4,814 | 2023–25 |
| Post-16 | entry cohort | −18.18 / 18.86 % | 2,694 | 2023–25 |
| Post-16 | roll | −5.55 / 4.74 % | 2,694 | 2023–25 |
| Primary | headline (KS2) | −7.00 / 13.00 pts | 14,321 | 2022–24 |
| Secondary | headline | −2.80 / 2.50 pts | 4,195 | 2022–24 |
| Post-16 | headline | −1.88 / 3.08 pts | 2,396 | 2022–24 |
| Secondary | subject area | −0.34 / 0.47 pts | 22,369 | 2022–24 |
| Post-16 | subject area | −2.34 / 3.35 pts | 10,427 | 2022–24 |

**These are final, not provisional.** The app's A4 fixture (`docs/v0.7/audit_scripts/admissions_flag_thresholds_dryrun.json`) is identical to this run to 1e-9 on all 11 rows. The app reads the live table at run time, so no constant needs changing.

## 7. Timings (warm over 3 runs; `docs/v0.7/audit_scripts/admissions_r1_timing.out`)

| Call | Warm | Target |
|---|---|---|
| Pipeline (15–26 schools) | 76–123 ms | 600 ms |
| Market share (10 rivals) | 0–1 ms | 400 ms |
| Rivals' ranks and flags | 59–65 ms | 800 ms |

Cold first calls take 0.1–9 s while the national populations load; these are cached for an hour per phase. School-account data (lists) never enters a shared cache.

## 8. Logged calls

Every call is logged with its reasons in `docs/OPEN_QUESTIONS.md` under "2026-10-08 — 0.7 admissions r1". The main ones:

- **Cohort:** full-time from age 4, plus part-time at ages 2–3.
- **Data:** converted schools read their single predecessor's earlier years; matched ratios only, with a 90% coverage floor.
- **Default sets:** state schools only (15 nearest R–Y6 primaries; at 16+, the 10 nearest secondaries plus the school). Rivals are the 10 nearest of either sector teaching E and E+1.
- **Ladder:**
  - the 16+ primary rungs are scaled by the Y6→Y7 handover;
  - births are calibrated to the set above 4+;
  - Reception's horizon stops at the last birth year (no ONS ages 0–3 projections);
  - the 11+ projection overlay is off by default.
- **Past pools** come from the age E−1 rung a year earlier, so "share needed" is Year 7 over last year's Year 6 pool.
- **Units:** results and subject-area changes are in points; pupil counts in %.
- **Flags:**
  - strength / weakness is the top or bottom third of rivals and above or below their average;
  - losing pupils is three falls in a row;
  - a feeder's red flag is 5 points worse than the area's.
- **FE colleges** have no school census, so their own figures are empty, never invented.
- **Roles:**
  - the lead is a flag on the `admissions` role, not a new role value;
  - grants made before this migration count as the School-Admin's;
  - shares use the role / team / user target model.

## 9. Questions for you before round 2 (the views)

1. **People UI:** where the lead flag, the delegated grants and the admissions audit history show, and the School-Admin's override there.
2. **A lead sharing lists:** the lead can today; should Admissions members without the flag also be able to?
3. **School-Admin without the lead flag:** they can edit lists and grants today (the override). Is that right, or should editing need the flag?
4. **Platform admins** can read every school's lists (View as). Confirm.
5. **Share targets:** people a list is shared with read it through RLS but can't open the computed views (routes are role-gated). Should a share also open the pipeline / rivals for that list?
6. **FE colleges:** use ILR participation data (an existing source) for their own entry cohort and shares?
7. **Reception's horizon:** ingest ONS population projections at ages 0–3 to reach "two years beyond" the last birth year?
8. **The S1 `nullif` fix** to `sync_membership_roles`: apply as a small separate migration?
