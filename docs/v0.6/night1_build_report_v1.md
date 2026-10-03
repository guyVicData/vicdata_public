# VicData 0.6, night 1 build report (S0–S3)

Branch `v0.6` from `main`, pushed to `origin/v0.6`. Nothing was merged or pushed to `main`. Every stage is its own commit, and each was clean on `tsc --noEmit`, eslint (no new problems; `main` itself carries 5 errors and 2 warnings in untouched files) and `next build` before the next stage started.

| Commit | Stage |
|---|---|
| `496a78e` | S0 audit (`docs/v0.6/audit_v1.md`) |
| `324e127` | S1 roles, teams, platform admin, sign-in events; People, Teams, Platform screens |
| `992f18f` | S2 rule lift (no figure changed) |
| `3c80838` | S2 engine: catalogue, config, matching, renderer, dashboards migration |
| `c5207c3` | S3 the four Teacher dashboards as config; Catalogue page; `docs/catalogue/*.md` |
| `3a6cf38` | OPEN_QUESTIONS.md |
| (this commit) | This build report and screenshots |

## Stops and things that need you first

1. **Security hole, pre-existing, not fixed.** Any signed-in user can insert an approved admin membership in any school (audit C §8.7.3). The fix is in `docs/v0.6/proposed_sql/membership_insert_hardening.sql`. It's an RLS change on memberships, which is a stop, so it waits for you.
2. **The S2 migration is not applied.** S1's migration was applied live: additive, then verified, and recorded with `migration repair`. After that the session's permission classifier blocked further live-database actions, so I stopped touching the database. To finish:
   ```
   supabase db query --linked -f supabase/migrations/20261103100000_v06_s2_dashboards.sql
   supabase migration repair --status applied 20261103100000 --linked
   npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/seed.sql && supabase db query --linked -f /tmp/seed.sql
   ```
   It is tested on local Postgres (`supabase/tests/v06_rls_pglite.mjs`: 39 checks plus the seed, run twice for idempotence). Nothing in night 1's UI needs it, because the flagged renderer reads the configs seeded in code. Night 2's editor will.
3. **No rule lift changed a figure, so there was no lift stop.** Three live behaviours break catalogue rules, and fixing them *would* change figures; they're kept and logged (OPEN_QUESTIONS 2026-10-03, item 3).
4. **R-IB-NONSUBJECT fails on real data**: Sevenoaks' raw 2024/25 facts include Baccalaureate and IB Core rows, which the subject list reads unfiltered. It's left alone, because filtering it would change a live list.

## Schools verified

| School | URN | Type | Used for |
|---|---|---|---|
| Acland Burghley School | 100053 | State (LA maintained) | Performance baseline; rule-lift equality (GCSE and Post-16); rule tests; parity screenshots |
| The King's School, Worcester | 117037 | Independent | Performance baseline; rule-lift equality (GCSE and Post-16); parity screenshots |
| The Chase | 137625 | Independent | Rule test R-BANDS-ENGLAND-BENCH |
| Whitmore High School | 102239 | State | Rule test R-KS5-ASAEA-EXCL |
| The Godolphin and Latymer School | 100369 | Independent | Rule test R-KS5-ENGLAND-EXACT |
| Croydon College | 130432 | FE | Rule test R-POINTS-WEIGHTED |
| Sevenoaks School | 118952 | Independent | Rule test R-IB-NONSUBJECT (fails, see above) |

## Live site untouched, and parity (checked, not assumed)

**Method.** The real `src/app/teacher/[phase]/page.tsx` was bundled from `main` (5597757) and from `v0.6`, each with its own built CSS. Supabase, `next/navigation` and the `/api/teacher/*` routes were stubbed with **real** fixture data captured through the app's own lib code. Headless Chrome then shot it at true 1280 and 390 widths over CDP, and the PNGs were pixel-diffed. Map tiles were blocked so they couldn't vary.

The matrix is 32 cases: 2 schools (Acland Burghley 100053, state; The King's School Worcester 117037, independent) × GCSE/Post-16 × Candidates/Results × 1280/390 × dark/light. Each case was shot from `main`, the branch with the flag off, and the branch with the flag on. There were also interaction steps: open Trends in each column, switch to Results (toggle, or group switcher), fullscreen, and on phone the column tabs.

- **`main` vs the branch with the flag off: 32/32 identical**, and every interaction step identical. Two first-run mismatches were harness timing (a chart measuring itself before layout settled). Re-shooting matched `main` every time (8 of 8).
- **Flag off vs flag on, desktop: 16/16 identical**, including every interaction step. The group switcher draws pixel-identically to the Candidates/Results toggle. The DOM confirms the flagged runs went through config (`data-dashboard-id`, columns c1–c3, six config panel ids).
- **Flag off vs flag on, phone: the only difference is the planned one.** Columns become a tab strip with one column at a time, against PhoneDash: an accent pill on the active tab, outlined pills for the rest, and a divider. Each tab keeps its open/closed state.
- **Notes:** the test note on `{phase}:candidates:current` shows in both modes, including in the fullscreen rail.
- **Not built by this round, but seen while checking (same on `main`):**
  - in the light theme, the body below `#teacher-root` follows the OS colour scheme, so there's a dark band under short content. With phone tabs the page is shorter, so it shows more; worth fixing before the flag flips;
  - three Trends buttons clicked in the same tick open only the last one. A person can't do that.

Screenshots are in `docs/v0.6/night1_screenshots/` (desktop parity, live untouched, phone tabs vs PhoneDash, and the People, Teams and Platform board comparisons). The full set of 96 shots and side-by-sides stays in the session scratchpad.

**People, Teams and Platform** were each compared with their board in headless Chrome, with stubbed data. People and Teams were shot at 390 (dark and light, including the editing card, an open team and the Add-people picker), and Platform at 1280 (dark and light) and 820. They match on structure, copy, sizes and states. The visible differences are the app's Arial against the board's system font, real initials in the avatars, and the dashed job-title field.

**Still needs your eyes, because only live data and real sign-ins can show it:**
- every People and Teams write against the real database;
- the School-Admin chip as account holder vs as an ordinary admin;
- the clipboard;
- Look-as landing and logging;
- the parity frames on the Catalogue page with real sign-ins.


## Must-lift rules and whether the lift changed a figure

21 rules were enforced only in `page.tsx` or a panel component. All 21 moved verbatim into the data layer, and **none changed a figure**. 30,888 scenarios were deep-equal before and after, across both schools above, both phases, Candidates and every Results measure (points; threshold; bands with preset, custom, pending and no range; counts), every Context group, and Comparisons with and without a ranking set. The harness catches a deliberately mutated rule. It is kept in `docs/v0.6/audit_scripts/lift_equality/`.

| Rule | Lifted to |
|---|---|
| R-ENTRIES-NOT-POINTS, R-POINTS-SAME-QUAL, R-KS4-POINTS-GCSE-FULL | `teacher-view-measures.ts` (`ownHeadlineRows`, `carriesOwnPoints`, `subjectPointsAt`, `subjectEntriesAt`, `latestOwnPoints`); `POINTS_BEARING_QUALIFICATION` moved to `dfe-qualification-buckets.ts` |
| R-SAME-YEAR-BENCH | `englandIndexOf`, `englandValueAt` |
| R-NO-GRADE-RATE-GEO | `hasEnglandPointsBenchmark` |
| R-THRESHOLD-PERIODS | `periodsForMeasure` |
| R-MEASURE-FALLBACK | `contextFallsBackFor`, `contextMeasureFor`, `comparisonsMeasureFor` |
| R-DONUT-COUNTS-ONLY | `shareApplies` |
| R-POINTS-WEIGHTED, R-KS5-ASAEA-EXCL | `contextGroupValue`; `teacher-view-populations.ts` `isComparablePeer`, `contextGroupRows` |
| R-QUAL-FAMILY-MATCH, R-KS4-SUBJECT-DEDUP, R-SELF-INCLUSIVE-GROUP, R-FOCUS-NEVER-FILTERED | `teacher-view-populations.ts` (`focusQualificationFamily`, `categoryItemsOf`, `candidateItemsOf`, `contextMembersOf`, `inContextGroup`, `keepFocusOrFigured`) |
| R-GEO-APPLIES, R-GEO-POINTS-ELIGIBLE | `teacher-view-geography.ts` (`candidatesGeographyApplies`, `resultsGeographyApplies`, `pointsEligibleEntriesByPeriod`) |
| R-BANDS-ENGLAND-BENCH | `teacher-view-grade-geography.ts` `withEnglandBandBenchmark` |
| R-PREV-YEAR-FALLBACK | `teacher-view-panels.ts` `currentRowsWithDelta` |
| R-COMPARATOR-RATE-PER-QUAL | `teacher-view-comparator-grades.ts` `rateSeriesByUrn` |
| R-COMPARATOR-NO-FIGURE, R-RANKING-SAMPLE | `teacher-view-comparisons.ts` (`comparisonSchools`, `rankedComparisons`, `comparisonsCurrentView`, `onRankingMeasure`, `sampleAllowsMap`) |

R-SINGLE-BUCKET-100 is a Data View rule (no Teacher view path uses it), so it's tagged but not lifted. Every Teacher-view rule ID is tagged at its enforcement points; `docs/catalogue/rules.md`'s "Tagged at" row comes from a grep.

**Rule tests on real data** (`npx tsx --env-file=.env scripts/catalogue-rule-tests.ts`):
- PASS: R-KS5-ASAEA-EXCL, R-KS5-ENGLAND-EXACT, R-MIN-SCHOOLS, R-POINTS-WEIGHTED, R-TREND-LINE-4YR, R-BANDS-ENGLAND-BENCH, R-THRESHOLD-PERIODS.
- FAIL: R-IB-NONSUBJECT.
- 16 are manual (a test case documented, not automated yet), and 15 have no test case.

The result is the same before and after the lift.

## Corrected claims (full table: audit Part D, 81 claims; 31 confirmed, 35 partly right, 15 corrected)

The ones that changed the build:
- **Two panels per column (Current, Trends), not three.** Trend and % change were merged, and each column is a one-open accordion.
- **The panel is 351 × 384**, not 385 × 256 with 24 px gaps, so a 3 × 2 meeting slide doesn't fit 720 (night 2).
- **R-TREND-3YR is really 4 years** for a line.
- **Column 1's % change half is always the LA/region/England view**, so its category change list and change table are dead code. F2 is all of Column 1's change content.
- **Column 1 does compare**: against its category, and in Results against England too.
- **Most must-lift rules lived in `page.tsx`**, not in the panel components. The academic RPCs and points rules live in the sibling ingest repo, and the measure data is in vicdata-production.
- **Roles:**
  - `role` is single-valued text with a CHECK constraint, not a DB enum;
  - School-Admin is `is_admin` plus the account holder;
  - nothing gated on role;
  - there was no system-admin identity and no role/school preview switch, only a destructive testing school switcher open to any signed-in user where its flag is on.
- **Notes:** the 3 live notes use old keys and already show nowhere.
- **Meetings:** they are per person, use old catalogue keys, can't be added from a panel, and the one live slide is already broken.
- **No phone tab strip exists today.** Columns stack, and pair from md. PhoneDash is new behaviour, flagged only.
- **The "alignment spacer" doesn't exist** as a component; alignment comes from pill placement plus the fixed height.
- **Live births are only on the public school page** (LA level), not in the Data View. Rolls have region/England 2019–2025 but LA only for 2025.
- **`entity_keying` lives in vicdata-production's `source_registry`**, not in this project.

## Simplifications made without you

- **The renderer composes through the existing column hosts.** It doesn't draw each dataview standalone: the config controls columns, rows, order, accordion, error boundaries, placeholders and phone tabs. Subset or reorder within a panel's rail, cross-column spans, and moving one view between panels need a small `views` prop on the hosts. That comes with the editor (night 2).
- **The Catalogue page checks parity whole-dashboard by whole-dashboard**, in two live frames, not view by view in isolation.
- **The client fetch de-duplication layer was not built**; reading the fetch helpers was blocked mid-session. The dashboard route already batches the core payload, and closed panels render nothing until opened. The audit's duplication list (B §2–4) is the to-do.
- **Override badges stay hidden** outside edit mode, so the flagged dashboard looks exactly like today. They are in the config and on the Catalogue page.
- **Invite copies the join link** (no invite email).
- **The per-user state table is a sibling** (`dashboard_user_state`). The four Teacher dashboards keep writing through their legacy `teacher_view_preferences` keys.

## Everything logged to OPEN_QUESTIONS.md

The entry is "2026-10-03 — VicData 0.6 night 1 (S0–S3)". In summary:
- **For you first:** the membership hole; S2 not applied; the three figure-changing rule conflicts; R-IB-NONSUBJECT; the panel unit vs the 720 slide.
- **S0:** the key-mapping layer for notes; R-TREND-3YR superseded; the multi-member `.maybeSingle()` bug on `/teacher` and `/teacher/meetings`; the join page fix.
- **S1:**
  - School-Admin is `is_admin`; roles are `text[]`; Guy seeded by profile id;
  - the VC switch is all-or-nothing and disabled at 0 sets; "Last active" comes from sign-in events;
  - the look-as scope; the testing switcher is now platform-only, with retirement suggested; Invite;
  - the screens' visual calls (tokens, font, sizes, behaviours).
- **S2:** the rule lift; the strict compare-subset reading; the host-composed renderer; hidden badges; the partial batching; the sibling state table; version pruning; no alignment spacer.
- **S3:** the marked overrides; the switcher sharing today's setting; whole-dashboard parity on the Catalogue page.

## What else is in

- **Roles as a set.**
  - `school_memberships.roles` is backfilled from `role`, and `role` is kept and synced. HOD and Finance stay in the vocabulary, hidden in the UI.
  - Non-service inserts are forced to Teacher, and `join_school` ignores the client's role and has a fixed `search_path`.
- **`is_platform_admin()`**, with:
  - `platform_admins` (Guy) and `platform_audit_log`;
  - `log_platform_action`, `platform_set_vc_visibility` (the VC Sets switch in the app) and `platform_school_overview`;
  - the testing switcher route now 403s for anyone but a platform admin.
- **Teams.** Three automatic teams per school (All staff, SMT, Admissions), derived from roles at read time, plus named teams. They are School-Admin managed, with RLS and `is_in_team()`.
- **Sign-in events.** One row per approved membership per `SIGNED_IN`, kept 12 months. There is no read policy and no UI.
- **Screens.**
  - `/teacher/people`, `/teacher/teams` and `/platform`, built from their boards in both themes with real tokens;
  - Look at it as… on `/teacher` and `/teacher/[phase]`, platform-admin only, with a read-only banner;
  - `/platform/catalogue`.
- **Catalogue in code** (`src/catalogue`): 40 rules, 14 measures (including Rolls and Live births, with no views yet), 14 renderers and 40 dataviews. Also:
  - the config format (`schema_version` 1) and its validator;
  - the matching rule with familiar-first ordering and empty-state relaxations;
  - G1's upgrade rule;
  - 59 unit tests (`npx -y tsx --test scripts/catalogue-unit-tests.ts`);
  - the export to `docs/catalogue/*.md`.
- **The four Teacher dashboards as config.** They sit in two linked groups behind `?renderer=config` (or `NEXT_PUBLIC_DASHBOARD_RENDERER=config`), and the group switcher stands in for the toggle.

## Click-through for Guy on the preview

The flag is off by default everywhere, so every page without `?renderer=config` should be today's.

1. **Platform** (`/platform`, signed in as you):
   - the school list, sector pills, members, roles in use and last active;
   - select a school: the side panel, and the VC Sets switch (disabled: there are no VC sets yet);
   - Look at it as… Teacher: you land on that school's `/teacher` with the read-only banner, and the phase tiles carry the preview through;
   - signed in as anyone else, `/platform` should be a 404.
2. **People** (`/teacher/people`, as a School-Admin of a real school):
   - approve and decline a waiting person;
   - switch role chips on and off; try to switch off someone's last role;
   - the School-Admin chip as account holder vs as an ordinary admin;
   - edit a job title; Invite (link copied); search; the filter chips.
3. **Teams** (`/teacher/teams`):
   - the automatic teams' counts;
   - + New team, rename, add and remove people, delete (two-step);
   - a Teacher sees "Only your School-Admin can manage teams." (and RLS refuses their writes anyway).
4. **Catalogue parity walk** (`/platform/catalogue` → Parity):
   - for Acland Burghley (state) and The King's School, Worcester (independent), each in GCSE and Post-16: in both frames, tick the same subjects, then compare Candidates and Results;
   - in Results, compare each pill (points, Grade 4+ / A*–E, bands 7–9, counts);
   - open each column's Trends panel, step through every rail view, and open one fullscreen;
   - expected: the frames match panel for panel. The config frame's switcher reads "Candidates | Results" exactly like today's toggle.
   - Then the Dataviews, Rules and Measures tabs are the catalogue to browse.
5. **Phone**: open `/teacher/ks4?renderer=config` at phone width. The columns become tabs (PhoneDash); without the flag they still stack as today.
6. **Notes and open panels**: add a note on Candidates · Current with the flag off, then reload with `?renderer=config`. The same note and open panel should be there.
7. **Sign-in events**: sign out and in, then run `select count(*) from sign_in_events` as service role. It should be one row per approved membership.

Night 2 starts from here: apply the S2 migration and seed first.
