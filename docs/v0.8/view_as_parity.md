# 0.8 View as: parity (17 Oct 2026)

**Result: no regressions.** Members' pages are identical to base in all four harnesses. Every difference found is one of three things:
- render noise that disappears on a recheck;
- the README's known random flake;
- the allowed role switch moving from the /teacher home into the nav.

**What was compared**
- **Base:** `824e2fb`, origin main's tip. It ran as a detached worktree in the scratchpad, removed at the end.
- **Branch:** `v0.8-view-as`. Bundles and fixtures were built at 12:36–12:53 from `c2ee44a` plus the working tree (one uncommitted change, to `src/lib/view-as-round.test.ts`).
- **Later commits:** `44b1a7a` and `4fad9b8` landed during the run. They touch only docs, test files and `src/lib/view-as-testkit.ts`, and no app code imports that file. So these results also stand for `4fad9b8`.

**How it ran**
- **Fixtures:** each tree's own server code, read-only against production, captured after `rules.log` printed `exit 0`, one capture at a time.
- **Pages:** drawn on fixtures shared by both trees: Teacher's ranking fixtures, and the base fixtures for Admissions, SMT and Groups. This is safe because every per-tree fixture pair was byte-identical (see below).
- **Isolation:** harness copies, Chrome profiles and logs are all in the scratchpad. Ports were 3301–3395. No repo file was edited except this one, and nothing was written to any database.

Scratchpad root, used in every path below: `/private/tmp/claude-501/-Users-guy-dev-vicdata-public/af4980b2-cf9a-49b0-8cf3-15b2b2d086ff/scratchpad/parity`

## Summary

| Harness | Pairs | Identical | Noise | Unexpected | Failed |
|---|---|---|---|---|---|
| 1. Teacher walker (all 7 case sets) | 2,875 | 2,874 | 1 | 0 | 0 (3 known-flake error files) |
| 1. Teacher: import graph | Data View 0, public 0 changed files in graph | — | — | 0 | 0 |
| 1. Teacher: public page SSR (137625, 117037) | 2 | 2 | 0 | 0 | 0 |
| 1b. Teacher nav + account menu + footer (extra check, see below) | 16 | 16 | 0 | 0 | 0 |
| 2. Admissions (`par.mjs`, PNG + DOM) | 328 | 328 | 0 | 0 | 0 |
| 3. SMT pages (`smtpar.mjs`, PNG + DOM files) | 312 files (156 DOM + 156 PNG) | 286 | 26 PNG (DOM identical) | 0 | 0 |
| 3. SMT homes (`homecmp.mjs`) | 20 | 12 | 0 | 8, all allowed (role switch moved into the nav) | 0 |
| 3. SMT builders, field by field (each tree's own code) | 32,956 fields | all | — | 0 | 0 |
| 4. Groups dashboards (r3 harness, PNG + DOM files) | 192 files | 191 | 1 PNG (DOM identical) | 0 | 0 |

**Fixtures, each tree's own code:**
- Teacher: 10/10 byte-identical.
- Admissions: 3/3 schools byte-identical (31,428 fields).
- SMT: byte-identical (32,956 fields).
- Groups: byte-identical (458,463 fields).

## 1. Teacher parity (`docs/v0.7/audit_scripts/parity_harness`)

**Command:** `cd <root>/teacher && caffeinate -dims ./run_parity.sh`, a full run of all case sets (c5_0 to c5_3, rka, rkb, sv), plus the import graph and the SSR check.

**Changes to the copy:**
- `R=/Users/guy/dev/vicdata_public_viewas`.
- `PARITY_BASE=824e2fb` in its `rev-parse` and `worktree` lines; `main-tree` became `<root>/base-tree`.
- `graph.py` diffs against `824e2fb`.
- Ports: http 3301, probe 3311, walkers 3321–3327.
- `h_index.html` copied to `h/index.html`.
- `h/leaflet-all.css` = leaflet.css + MarkerCluster.css + MarkerCluster.Default.css (16,965 bytes; the README's 18,223 was an older leaflet).

**Results:**
- **Walker:** 2,875 pairs, 2,874 identical, 1 noise, 0 unexpected, 0 only-one-side.
  - The noise pair is in rkb (`c3`): render noise, words equal.
  - Fixtures were 10/10 byte-identical between the trees.
  - The ranking fixtures took 3 probe passes, ending with 0 unanswered requests.
- **Error files:** 3, all the README's known random flake, `rej TypeError: parameter 1 is not of type 'Element'`:
  - base: `130416-ks5-points-dark-1280`;
  - branch: `130432_aslaw-ks5-bands-light-390` and `130416-ks5-points-light-390`.

  They hit both trees, and each of those cases' pairs is identical.
- **Import graph:**
  - Data View: 0 changed files in its client graph.
  - Public page: 0 (and public-api: 0).
  - dataview-api: 8, the six `data-view` route.ts files plus `view-as.ts` and `view-as-server.ts`. These are the membership checks moving to `resolveCaller`: server side and expected.
  - Teacher: 20 changed files in graph, as expected for this branch (nav, View as, RoleSwitch, editor).
- **SSR:** identical for 137625 (64,771 bytes) and 117037 (73,542 bytes).
- `cmp6_noinfo.py` was not needed (no text differs).

**1b. Extra nav check.** The walker compares panels only, so the nav, account menu and footer weren't covered. `<root>/navcmp/navcmp.mjs` loads the same harness page on both bundles for 4 schools × 2 themes × 2 widths. It compares the nav DOM, the account menu opened, the footer DOM and a PNG of the top 200 px. **16/16 identical.**
- The menu reads Your Account / People / Teams / Log Out on both trees.
- The footer has no "View as…" on either tree: the stub member isn't a platform admin.
- The stub member has one role, `teacher` (with `is_admin`), so **the role switch does not appear in the Teacher harness.**

**Logs:**
- `<root>/teacher/logs/full_run.log`
- `<root>/teacher/out/run_20261017_123640/` (SUMMARY.txt, run.log, cmp_*.txt, walk_*.log, graph/)
- `<root>/teacher/logs/ssr/`
- `<root>/logs/teacher_navcmp.txt`
- `<root>/navcmp/out/`

## 2. Admissions parity (`docs/v0.7/audit_scripts/admissions_preview`)

**Commands:**
- **Build:** `REPO=<tree> NAME=bundle_<t> CSSNAME=app_<t> ./build.sh`. The CSS is byte-identical between the trees.
- **Capture:** `cap2.mts` per tree (`REPO=` added), for 137625 (11+, 16+), 117037 (11+, 16+) and 115786 (4+, 11+), into `fx_base` and `fx_br`. Both trees came out byte-identical.
- **Walk and compare:** `OUT=par_out HTTP_PORT=3331 FX=fx_base node par.mjs 3341 3 base=bundle_base:app_base br=bundle_br:app_br`, then `python3 parcmp.py par_out base br`.
  - `fx_s12` became `FX`. That set came from a variant capture that can't be rebuilt, so fresh per-tree captures replaced it.

**Result:**
- 328 pairs, **328 identical** (pixels and `#teacher-root` DOM, which includes the nav). 592 distinct panel-views were drawn, with 0 page errors.
- The stub is an Admissions lead with one role, so no role switch draws.

**Logs:**
- `<root>/logs/adm_par.log`, `<root>/logs/adm_parcmp.txt`
- `<root>/logs/cap_adm_{base,br}.log`
- `<root>/adm/par_out/`

## 3. SMT parity (`docs/v0.8/audit_scripts/smt_preview` + `groups_r3_preview/smtpar.mjs`, `cmp.py`)

**Builders, field by field.** The routes' own builders ran from each tree:

```
npx -y tsx --env-file=.env smt/cap.mts fx_<t>/index.js 137625 110110
```
- The copy imports from `REPO`.
- Its `buildContext` call was updated to the current signature `(school, area, level, resolveCatchment(school, null, null))`, because the r1 script crashed on both trees.
- Then `python3 <root>/cmpfx.py fx_base/index.js fx_br/index.js`: **byte-identical, 32,956 fields, 0 differ.**
- Production threw statement timeouts on `academic_subject_rank_lookup`, and both trees took the app-side fallback.

**Pages.** Each tree's bundle drew the shared fixtures:
```
TREES=base,br HTTP_PORT=3332 node smtpar.mjs 3351 3
python3 cmp.py smtpar_out base br
```
The cases: 137625 and 110110 × Overview / Academic / Pupils / Context / Home × 2 themes × 2 widths, with every rail view on desktop.
- 312 files, 286 identical, 26 differ. **All 26 are PNGs; every DOM file is identical.**
  - `{137625,110110}_overview_dark_1440_s0–s9`: max 1/255, 25 px, at x 1409–1412.
  - `137625_context_light_1440_s0,s1,s3`: max 1/255, 41 px.
  - `110110_context_light_1440_s0,s1,s3`: max 15/255, 25 px, in a 3-px text strip at y 103–106.
- **Rechecked twice** (the four cases, both trees): recheck 1 was 68/68 identical; recheck 2 was 62/68, with only 6 of the same antialiasing PNGs. **Noise (flake).**
- The stub role is `smt` (one role), so no role switch draws. The platform-admin "not for you" messages aren't exercised (no `padmin` case).

**Homes** (`homecmp.mjs`: role teacher / multi / admin × lens × theme × width): 20 pairs, 12 identical, 8 differ, all `multi`.
- The `multi` stub member holds smt + teacher + admissions. All 8 differences are the **allowed role switch move**:
  - base draws the /teacher home's own LensSwitch, under the school name (`div.mt-[18px] > [role=tablist][aria-label="Your roles"]` with the "Shown because a School-Admin gave you more than one role…" line);
  - the branch drops it and draws `NavRoleSwitch` in the TeacherNav's right-hand group, before the account menu (`[data-role-switch]`, the same text as its title).
- With those two blocks set aside, **8/8 DOMs are identical.** The teacher (one role) and admin pairs are byte-identical.
- **Harness artefact (not a regression):** the stub's `usePathname()` returns `/teacher/admissions`, so with `lens=teacher` the branch's nav switch highlighted "Admissions". A rerun with a `/teacher` pathname stub (`homecmp2.mjs`) showed the nav switch selecting the same role the base home selected (Teacher for lens=teacher, Admissions for lens=admissions).

**Logs:**
- `<root>/logs/cap_smt_{base,br}.log` (`cap_smt_base_try1.log` is the r1 script's crash)
- `<root>/logs/fixture_fields.txt`
- `<root>/logs/smt_par.log`, `smt_cmp.txt`, `smt_pxdiff.txt`, `smt_recheck_cmp.txt`
- `<root>/logs/smt_homecmp.txt`, `smt_homecmp2.txt`, `smt_homecmp_pathfix.txt`
- `<root>/smt/{smtpar_out,recheck1,recheck2,homecmp,homecmp2}/`

## 4. Groups parity (`docs/v0.8/audit_scripts/groups_r3_preview`)

**No groups README names a separate "parity" script.** The r3 README's parity is SMT's `smtpar.mjs` / `cmp.py`, and the consistency report's "Groups parity" counts group-dashboard files. So this run is the r3 dashboard harness:
- `cap_dashboards.mts` + `index_dashboards.html` (given `css` / `fx` / `bundle` parameters), with the r2 `harness.tsx` and the admissions stubs.
- `smtpar.mjs` re-cased as `grppar.mjs`: harris and dukes × overview / schools / academic / pupils / home × 2 themes × 2 widths.

**Capture:** `VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=<tree>/docs/v0.8/groups_fixtures npx -y tsx --env-file=.env --tsconfig tsconfig.json cap_dashboards.mts fx_<t>/r2.js`, per tree: **byte-identical, 458,463 fields.**

**Walk:** `TREES=base,br HTTP_PORT=3333 node grppar.mjs 3361 3`, then `python3 cmp.py grppar_out base br`.
- 192 files, 191 identical. The 1 difference is `harris_schools_dark_1440_s2.png`: max 1/255, 2 px, DOM identical.
- Rechecked twice: 6/6 identical both times. **Flake.**
- The stub has no school memberships (head office), so no role switch draws.

**Logs:**
- `<root>/logs/cap_grp_{base,br}.log`
- `<root>/logs/grp_par.log`, `grp_cmp.txt`, `grp_pxdiff.txt`, `grp_recheck_cmp.txt`
- `<root>/groups/{grppar_out,recheck1,recheck2}/`

## Unexpected pairs and their classification

| Pair(s) | Harness | Classification |
|---|---|---|
| rkb `c3` (1 pair) | Teacher | noise (render, words equal), within cmp6's thresholds |
| 3 `__errors.txt` (130416 / 130432 ks5) | Teacher | known flake (README), both trees |
| 26 SMT PNGs (overview dark 1440, context light 1440) | SMT | flake: DOM identical, max 1–15/255, recheck 1 all identical |
| `harris_schools_dark_1440_s2.png` | Groups | flake: 2 px at 1/255, identical on 2 rechecks |
| 8 `multi` homes | SMT homes | **allowed**: the role switch moved from the /teacher home into the nav (TeacherNav, right-hand group, before the account menu) |

**Real regressions: none.**
