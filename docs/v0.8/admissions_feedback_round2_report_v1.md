# VicData 0.8: Admissions feedback round 2 (F-31, F-36) and two feedback-system fixes

The round for `docs/v0.8/vicdata_0_8_admissions_feedback_round2_claude_code_prompt_v1.md`, on the branch `v0.8-admissions-fb2` (local, in the shared repository; worktree `~/dev/vicdata_public-adm-fb2`). It starts from `main` at `5fe846e`. Every call made unattended is under "2026-11-06 — Admissions feedback round 2" in `docs/OPEN_QUESTIONS.md`.

**In short:**
- **F-31:** "Why did our intake change?" is now two steps, cohort size and your share. Families moving is drawn as the cohort step's hollow, dashed "of which". There is a sum line under the chart, and a new note there that reads the waterfall. The boarding caveat moved into the (i).
- **F-36:** in full screen, "You and the rivals" draws you and each rival in its own colour, with a key and labelled gridlines. It uses the same component as F-20's band roll. The panel is unchanged.
- **The feedback window:**
  - it records the view it's tied to, with that view's own state and address;
  - it offers the move when the panel, the rail, the entry point or the set changes;
  - it warns before sending;
  - the server refuses a contradictory item.
- **Auto-close:** a new `resolved_views` lets a "Looks good" on a view a fix added or changed close the item.
- **The template:** step 1 records the migration with an idempotent insert.
- **One migration,** `20261120090000_v08_feedback_resolved_views.sql`, for Guy to apply. Merge only after it is applied.
- **No republish:** no published dashboard config changed (`src/catalogue/dashboards` is untouched).

Screenshots are in `docs/v0.8/admissions_fb2_screenshots/`.

## F-31: "Why did our intake change?" rebuilt

### What it draws

Five columns, of which two are steps:

| Column | What it is | Label (Leighton Park, 16+) |
|---|---|---|
| Your Year 12 (Year 7 at 11+), base year | solid bar | 2019/20 |
| **Cohort size**, a step | the local children a year below entry (15 at 16+, 10 at 11+), mid-year before entry, same LSOAs as before | local 15-year-olds: 6,622 → 8,134 (+23%) |
| **Families moving**, "of which" | hollow and dashed; the running total doesn't move | moved in since age 8 (net): +716 → +824 |
| **Your share**, a step | | of the local 15-year-olds: 1.2% → 1.1% |
| Your Year 12, latest year | solid bar | 2025/26 |

Under the chart:
- the sum, **82 + 18 − 10 = 90**;
- the line saying where the bars start;
- the new note, which reads the waterfall. It used to explain boarding.

**The maths** (`src/lib/admissions/intake-change.ts`):
- **The steps.** Entry = local cohort × share. The change is split by the existing log-mean (LMDI) split, now over two factors, so the two steps add up to the change exactly. They are rounded by largest remainders, so the rounded steps add up to the rounded change. Small intakes still average three years at each end.
- **The "of which".** The local cohort = the same children at the earliest age held, plus those who moved in since (net).
  - The cohort step is shared between the two in proportion to each one's change from the base year to the latest. Each local child is worth the same number of pupils.
  - The shares are rounded so the two add up to the step.
  - If the local cohort didn't change at all, the proportion is undefined. The split then uses its limit (L ÷ cohort), so a swap still shows, for example +5 and −5.
- **Opposite signs** (logged). The dashed bar always ends level with the cohort step's end. It starts where the children already here would alone have taken the running total.
  - When the two move the same way, it sits inside the step's top.
  - When they move opposite ways, it sits outside the step. It is coloured by its own sign: the accent for families moving in, orange for moving out.
  - The note under the chart gives both numbers. See St Bonaventure's below.
- **The earliest age.** Age 0 ("born here", "moved in since birth") where the LSOA years reach the base cohort's birth year. Otherwise the youngest age held (`birthsAge`). Today that is age 3 at 11+ and age 8 at 16+: the ONS small-area data starts in mid-2011, so no current case reaches births.
  - With no earlier age at all, the view now draws the two steps without the "of which". Before, it drew nothing. No current case hits this.
- **The wording.** "Moved out" when families moved out (net) at both ends, and "moved in or out" when it turns between them. The counts are always signed.

### Old and new bars

Each school is at its default radius, census 2019/20 to 2025/26. Old: births (cohort size) / families moving / your share. New: cohort size / your share, with the "of which" split as children here / families moving.

| School | Entry | Old | New | Of which: here / moving | Local cohort | Here at the earliest age | Moved in (net) | Share |
|---|---|---|---|---|---|---|---|---|
| Leighton Park (110110), 15 km | 11+ | 47 → 57: −3 / +5 / +8 | 47 + 3 + 7 = 57 | −2 / +5 | 10-year-olds 7,332 → 7,713 | since age 3: 7,112 → 6,754 | +220 → +959 | 0.64% → 0.74% |
| Leighton Park | 16+ | 82 → 90: +18 / 0 / −10 | 82 + 18 − 10 = 90 | +17 / +1 | 15-year-olds 6,622 → 8,134 | since age 8: 5,906 → 7,310 | +716 → +824 | 1.24% → 1.11% |
| **Moving in:** Bolton School Boys' Division (105271), 15 km | 11+ | 143 → 154: −2 / +8 / +5 | 143 + 6 + 5 = 154 | −2 / +8 | 13,658 → 14,223 | 13,372 → 13,162 | +286 → +1,061 | 1.05% → 1.08% |
| Bolton School Boys' Division | 16+ | 109 → 94: +19 / +1 / −35 | 109 + 20 − 35 = 94 | +18 / +2 | 11,738 → 14,272 | 11,256 → 13,595 | +482 → +677 | 0.93% → 0.66% |
| **Moving out:** St Bonaventure's RC School, Newham (102787), 2 km | 11+ | 208 → 199: +11 / −34 / +14 | 208 − 23 + 14 = 199 | **+13 / −36** | 2,528 → 2,261 | 2,734 → 2,887 | −206 → −626 | 8.23% → 8.80% |
| St Bonaventure's | 16+ | 175 → 193: +20 / −4 / +2 | 175 + 16 + 2 = 193 | +22 / −6 | 2,085 → 2,270 | 2,188 → 2,442 | −103 → −172 | 8.39% → 8.50% |

How to read the changes:
- **The share step moves too.** For example, Leighton Park at 11+ goes from +8 to +7: with two factors in place of three, the log-mean split's rounding falls differently.
- **The new cohort step is roughly the old "births" and "moving" together:** old (−3) + (+5) ≈ new +3.
- **The two other schools** were chosen from 80 school/entry pairs read on 6 Nov (read-only):
  - Bolton has the clearest move in among independent schools: +286 → +1,061 at 11+.
  - St Bonaventure's shows families moving out while the born-here count grows. That is the opposite-signs case: the cohort fell by 23 pupils' worth; the children here added 13 and families leaving took 36.

### Screenshots

`f31_{urn}_{11|16}_{light|dark}_{before|after}.png`: 24 files, from the Admissions preview harness, with each tree's own fixtures. Also `f31_110110_11_light_after_phone.png` and `f31_102787_11_light_after_phone.png`, at 350 px. On a phone the labels wrap and the detail lines move into the hover, as before. Those two shots cut the note off only because the harness slot has a fixed height.

- Leighton Park 16+: `f31_110110_16_light_before.png` → `f31_110110_16_light_after.png`.
- St Bonaventure's 11+, the opposite-signs case: `f31_102787_11_dark_after.png`.

### The (i), as it fills (Leighton Park, 16+)

**Notes:** the two-step note, then families moving (net, and why children travelling in show in your share), boarding (moved here from under the chart), international boarders, and "not your feeder list".

**Years:** "Your Year 12 from 2019/20 to 2025/26, each with the local 15-year-olds the mid-year before entry, and the same children at the earliest age held. The "of which" counts the cohort from age 8 ("here since age 8"), not from birth, because the area's population figures start in mid-2011, after the 2019/20 Year 12 were born. Each end is one year."

The one sentence on which age applies and why is in Years. The long mid-2011 sentence is only in "How it is calculated", step 6.

**How it is calculated:**
1. The area.
2. Cohort size: the local 15-year-olds.
3. Your Year 12.
4. Year 12 = cohort size × share.
5. The LMDI split into two steps.
6. Families moving, the "of which": the long mid-2011 sentence, then the proportional share-out and the opposite-signs case.
7. The 3-year average.
8. How the waterfall is drawn, and the sum line.

**Note under the chart:** "Your Year 12 changed by +8: +18 from the cohort size (more or fewer local 15-year-olds) and −10 from your share of them. The dashed bar is part of the cohort size, not another step: of its +18, +17 came with the children here since age 8 and +1 with families moving in since age 8 (net)."

**One correction to the old text** (logged): the old note said "families moving" counts children crossing the radius to go to school. The area's figures are where children live, so a child who travels in shows in your share, not in families moving. `intakeMoving` now says so. The editor's sentence for this view still described the pre-F-13 LA blend; it now names the catchment radius.

### Rule and tests

- **R-ADM-VIEW-INTAKE-CHANGE** is restated, with a `fixes` entry. Its runner recomputes both steps and the "of which" by hand from `area_context` and the census, for:
  - Leighton Park at 11+ and 16+;
  - The Chase at 11+;
  - St Bonaventure's at 11+, which must read "moved out".

  It passes.
- **`intake-change.test.ts`:** 13 tests, all passing. They cover:
  - the exact and rounded sums;
  - the proportions;
  - opposite signs;
  - a flat cohort;
  - no earliest age;
  - no change at all;
  - missing figures.
- **Method docs:** `methods-admissions.ts`, `notes.ts` (`intakeNote`, `intakeMoving`, the new `intakeRead` and `intakeOfWhich`), the catalogue's renderer line, and the regenerated `docs/catalogue/*.md`.

## F-36: You and the rivals in full screen

- **In the panel:** unchanged. You against the rivals' average. Parity: PNG and DOM identical.
- **In full screen:**
  - you and each rival, each in its own colour (dashed after the seventh), with a key and labelled y gridlines;
  - small rivals (under 30 pupils at the entry age at the base, F-20's `ROLL_INDEX_MIN`) are left out and named under the chart. At Leighton Park 11+ (10 nearest), 8 rivals are drawn. "Not drawn (under 30 pupils aged 11 at the start, too few to index): OneSchool Global Reading Senior Campus, Red Balloon Learner Centre Reading."
- **Shared with F-20, not copied:** `YouAndEachRival` in `views/Lines.tsx` draws both. One helper, `indexOwn` (`src/lib/index-base.ts`), indexes each rival, and the server's `rollIndexed` uses it too.
  - The band roll is byte-identical in the panel and in full screen.
  - The market route's answer is identical.
  - No new data: each rival's line is worked out from the entry-age rows the answer already carries.
- **Rule:** a new rule, R-ADM-VS-EACH (runner `admVsEach`). It server-renders the view from the real answer and checks:
  - one key entry per drawn rival;
  - the small rivals are named, not keyed;
  - each rival's last value against the census;
  - the gridlines;
  - that the panel has none of these;
  - that both views use the one component.

  It passes.
- **Logged for Guy:** like F-20's full screen, this one draws each rival in place of the rivals' average. The panel keeps the average. Adding it back in full screen is one series, for both views.

**The other Admissions line views with rivals:** only two draw rivals as a line, the band roll (`DV-ADM-M-ROLL-LINE`, F-20) and this one (`DV-ADM-M-VS-LINE`). Both now share the code. Not extended, and logged:
- **VS-BARS:** each rival per year would be an unreadable grouped bar chart.
- **SHARE-LINE and SHARE-BAND:** they draw only your share, no rivals, so adding rivals is Guy's call.
- **The Pipelines line views:** they compare with the LA, the region and England, not rivals.

**Screenshots** (preview harness, Leighton Park 11+, the real panel and full-screen dialog):
- `f36_panel_light.png` and `f36_panel_dark.png`;
- `f36_fullscreen_light.png` and `f36_fullscreen_dark.png`.

## The feedback window (item 3)

### Why F-31 contradicted itself
- **State came from the opening.** The window kept the page's surface (its `state`) from the moment it was opened: `openFeedback` stored `target.surface`, and Send used it.
- **The address came from Send.** It read `window.location.search` at that moment, and Admissions had already rewritten that with `history.replaceState` when the entry chip changed.
- **Nothing told the window.** CardBox re-announces a panel only when its view changes, never its state. The move offer looked only at the window's own panel, so going to the funnel in another panel offered nothing.

So F-31 recorded 11+ (from the opening) with `entry=16%2B` (from Send).

### F-32's attribution
F-32 (a bare "Looks good", 13:43:57) records the same view as F-31: "Your cohort, girls and boys", `state.entry = 11+`, `page_query entry=16%2B`. It was sent 37 seconds after F-31. It can only come from the same opening: Send keeps the window open on the same target, and any fresh opening from a view's icon takes the page's state as it is then, which by then was 16+.

So **F-32 is mis-filed the same way**, and nothing says which 16+ view Guy meant. It needs no code fix of its own beyond this item. It doesn't count as a check of "Your cohort, girls and boys" at 11+: F-30, at 13:40, already did that correctly.

**Suggested:** in the inbox, set F-32 to won't do, with the reason "mis-filed (stale window, as F-31); the view meant is unknown". Then give "Looks good" again on whichever 16+ view it was for. It is not in step 6.

### The fix
- **What the window is tied to:** the view, with the page's state and address at the moment it was tied. The page's live state is kept in the store.
- **On Send:**
  - if nothing has moved, Send records the state and address at that moment;
  - if the page has moved on, Send first says so ("Before sending: …") with two buttons, "Move to … and send" and "Send on … as it was";
  - "as it was" sends the tied view with its own state and address from when it was tied.

  It is never a mix. The window also checks the payload itself.
- **The move offers** now cover:
  - the rail (as before);
  - **another panel on the same dashboard:** the panel last clicked or tabbed into, its full screen included. Scrolling or hovering doesn't count (logged);
  - **a change of entry point or set:** `entry`, else `level`, else `phase`; `set` or `rivals`.

  The button reads "Move to Why did our intake change? · 16+". The banner reads "You're now in … · 16+. This feedback is still on Your cohort, girls and boys · 11+."
- **A change of dashboard** says so but offers no move: the old view isn't on screen. A page item does move to the new page.
- **The header** always names the tied view with its entry point: "Shape and size · 16+", and on SMT and Teacher "· Post-16", "· GCSE" or "· Whole school". The set goes on the line under it. A page item reads "This page: Pipelines · 16+ · Leighton Park School".
- **The server check:**
  - **Where it runs:** in the route (`feedbackRow`, answering 422, which works before the migration) and in the database's insert trigger (`feedback_state_mismatch`).
  - **What it compares:** the state's `dashboard` with `?view=`, `entry` with `?entry=`, and `level` with `?level=`. A pair is compared only when both are present. A bare `+` in an address still matches "16+".
  - **What the window shows:** "This item's settings don't match its address: entry point 11+ is recorded, but the address says 16+. Nothing was sent. Move the window to the view on screen and send again."
- **R-FEEDBACK-FOLLOWS-VIEW, extended** in `src/lib/smt-fb1.test.ts` and its rule runner:
  - open on A at 11+, then switch to 16+ and to B in another panel: the window offers B · 16+;
  - Send gives B at 16+, or A at 11+ with `entry=11%2B` if declined, never a mix;
  - the 6 Nov mix is refused;
  - an entry-only move and a dashboard change are covered too.

**Not seen in a browser:** no harness draws the window, and localhost is gated. The move offers and the "Before sending" warning are in step 7's live check.

## Auto-close and `resolved_views` (item 4)

**The migration**, `supabase/migrations/20261120090000_v08_feedback_resolved_views.sql`. It needs the deploy gate's migration first and is safe to run twice.
- **The column:** `resolved_views text[] not null default '{}'`, at most 50, no nulls.
  - It is a triage field, so platform admins only, under the deploy gate's update rules.
  - A new item starts with none.
  - The database tidies it (trimmed, no repeats, never the item's own view) and counts a change as triage.
- **`feedback_items_live_check`** closes a deployed item when a platform admin's "Looks good" is on its own view **or on any of its `resolved_views`**, at the same school, at or after `deployed_at`. There is a GIN index for it.
- **The insert check from item 3,** in `feedback_items_on_insert`.
- **`feedback_for_triage`** gets `resolved_views`, appended last. `feedback_deploy_gaps` reads it unchanged.
- **Three pure helpers:** `feedback_url_decode`, `feedback_query_param` and `feedback_state_mismatch`, with `search_path = public`. authenticated can run them; anon can't.
- **I compared it against the deploy gate's migration:** the insert trigger and the live check differ only by the additions above.

**`scripts/feedback-set-fixed.sh --view <view_key>`:**
- it can be repeated, and adds to the list (never removes);
- it applies to every F-number in the call, so run it once per item when the views differ;
- it works on any item not yet done or won't do;
- keys are checked against a pattern.

**The inbox:** a "Resolved views" triage field (one key a line), shown in the detail and in Copy as Markdown. The platform route answers 503 for that field until the migration is applied.

**Docs:** `docs/FEEDBACK.md` gains the triage field, "The feedback window", and "Closing an item" (when to pass `--view`: when the fix added or changed a view other than the item's own). Steps 6 and 7 of the template are updated. There is a new rule, R-FEEDBACK-RESOLVED-VIEWS, and R-FEEDBACK-LIVE-CHECK is updated.

**PGlite:**

| Suite | Result |
|---|---|
| `v08_feedback_resolved_views_pglite.mjs` (new) | 44 / 44 |
| `v08_feedback_deploy_gate_pglite.mjs` | 56 / 56; also 56 with `FEEDBACK_NEXT=1` (the new migration on top) |
| `v08_feedback_page_pglite.mjs` | 17 / 17; also with every later migration on top |
| `v08_notes_feedback_pglite.mjs` | 39 / 39; also with every later migration on top |

The new suite's cases:
- **closes the item:** a "Looks good" on a resolved view;
- **doesn't close it:**
  - one on an unrelated view;
  - one at another school;
  - one before the deploy;
  - a member's;
  - a text item;
- **refused:**
  - a non-admin setting `resolved_views`, even on their own item;
  - anon;
  - the F-31, dashboard and level mismatches, with the message;
- **taken:** agreeing items, a missing parameter, a bare `+`;
- the set-fixed SQL, and the permissions.

## The template's step 1 (item 5)

`docs/FEEDBACK.md` step 1 now:
1. applies the migration with `supabase db query --linked -f`;
2. records it with `insert into supabase_migrations.schema_migrations (version, name) values (…) on conflict (version) do nothing`;
3. shows the recorded row.

It says why not to use `migration repair`: the repair needs the file in the checkout it runs from. R-REPORT-COMMANDS-ORDER (`scripts/report-template.ts`) checks only the steps' bold titles and their order, so it needed no change. It passes on this report and the deploy gate's.

## Tests

On the branch, at `929fd93` plus the one rule-runner fix below:

| Check | Result |
|---|---|
| tsc | clean (after `npx next typegen`, which a fresh worktree needs for `LayoutProps`) |
| eslint | 0 errors; 3 warnings, all older than this round (`PeerTrendChart.tsx`, `SchoolMap.tsx`, an unused `n` in `v08_admissions_fb1_republish_pglite.mjs`) |
| build | passes (`next build`, compiled successfully) |
| Unit (`src/**/*.test.ts(x)`, `--env-file=.env --test-force-exit`) | 68 files, **560 pass, 0 fail** |
| Catalogue unit (`scripts/catalogue-unit-tests.ts`) | **77 pass, 0 fail** |
| Rule tests (`scripts/catalogue-rule-tests.ts`) | **137 pass, 0 fail, 0 error**; 15 manual, 19 with no test, 6 superseded |
| PGlite, RLS and usage log (`supabase/tests/*_pglite.mjs`, all 24) | **all pass**, including the new `v08_feedback_resolved_views_pglite.mjs` (44 / 44), the deploy gate's (56 / 56) and `v08_usage_log_pglite.mjs`. Three need PostGIS (`PGLITE_DIR`, as their headers say) and one runs under `tsx`; run that way, all pass |

**One rule needed its runner changed (logged in OPEN_QUESTIONS):** R-ADM-BOARDING-ONLY-WHERE-BOARDERS first failed at Beaudesert Park 11+ with "ISC note false". The runner looked for the ISC sentence ("International boarders aren't in the school census…") in the rendered pipeline. That sentence lived only in the boarding box under the intake chart, which this round moved into the (i), as asked. The runner now accepts the sentence in the pipeline or in DV-ADM-P-FUNNEL's (i) notes, and passes. The day-school half is unchanged. The (i)'s method text is the same for every school and already carried `intakeBoarding` before this round, so a day school's rendered panels still have no boarding words.

**A hang that isn't a failure:** `src/lib/view-as-pages.test.ts` never exits without `--test-force-exit`, as its header says (the browser client keeps a timer alive). With the flag it passes.

This round's rules all pass:
- R-ADM-VIEW-INTAKE-CHANGE, and R-ADM-BOARDING-ONLY-WHERE-BOARDERS with its runner fix;
- R-ADM-VS-EACH and R-ADM-ROLL-INDEXED;
- R-FEEDBACK-FOLLOWS-VIEW, R-FEEDBACK-RESOLVED-VIEWS and R-FEEDBACK-LIVE-CHECK;
- R-REPORT-COMMANDS-ORDER.

## Parity

**Parity: base `38ad793` (`main` 5fe846e, the live code, plus the prompt) against the branch at `6ca0c1d`. Nothing unexpected.** Both trees were detached worktrees in the scratchpad, each with its own `node_modules`, its own CSS and bundle, and its own fixtures, read-only. `~/dev/vicdata_public` was never touched. The harness copies used are in `docs/v0.8/audit_scripts/admissions_fb2_parity/`.

| Harness | Pairs | Identical | Allowed | Noise | Unexpected | Failed |
|---|---|---|---|---|---|---|
| Teacher walker, all 7 case sets (PNG + words) | 2,875 | 2,875 | 0 | 0 | 0 | 0 (after an `rkb` rerun) |
| Teacher public-page SSR (137625, 117037) | 2 | 2 | — | — | 0 | 0 |
| Admissions, 4 schools, both themes, 1440 and 390, every rail step (PNG and DOM) | 468 | 440 | 28 (F-31) | 0 | 0 | 0 (128 page loads, 0 errors) |
| SMT, 2 schools (PNG and DOM) | 152 | 134 | 0 | 18 PNG | 0 | 0 |
| Groups, nothing picked | 96 | 96 | 0 | 0 | 0 | 0 |
| Groups, a member school picked | 88 | 88 | 0 | 0 | 0 | 0 |
| Data View (graphs, rankings, snapshot), light and dark | 24 | 24 | 0 | 0 | 0 | 0 |

**Fixtures:**
- Teacher, SMT and Groups: byte-identical between the trees.
- Admissions: the only differences are in the pipeline answer's `intake` (the new shape) and its notes. The market, rivals, shape and candidates answers are identical.

**Admissions, the 28 pairs:** all are Pipelines' "Why did our intake change?". That is 4 schools, each entry point with a funnel, both themes and both widths; 4+ has no funnel and is identical. On desktop, only that panel's DOM differs. On a phone, the change runs from the funnel's heading to its (i), and pages grow by up to 122 px from the new note. Market share is identical at every step, the panels of You and the rivals and the band roll included.

**F-36's full screens** (Leighton Park 11+, light):
- the band roll is identical in PNG and DOM;
- You and the rivals differs as intended.

**SMT noise:** 18 PNGs differed by at most a few channel steps, and every DOM was identical. 17 cleared on recheck. The last, a rounded corner on Overview dark at 390, changed between the branch's own runs, so it is antialiasing.

**Teacher:**
- One base case in `rkb` failed to load its fixture script (a harness flake). The `rkb` rerun drew its 24 pairs identical.
- One map pair differed on the rerun only, from the base's own map. That is the known `rkb` map flake.
- The `CardBox` handlers change no DOM or pixels anywhere a harness draws.

**Import graph:**
- the public page has no changed file;
- the Data View's graph holds only the feedback window's files, `view-ref.ts`, the feedback routes, and catalogue data it doesn't draw (`catalogue/admissions.ts`, `notes.ts`).

**After `6ca0c1d`,** the branch only changed the funnel's (i) Years line (wording), docs, the OPEN_QUESTIONS notes and the harness copies. No harness opens the (i).

**Not covered:**
- No harness draws the feedback window, the inbox, or the editor's funnel sentence. Nothing presses a pointer or moves focus, so the "another panel" offer isn't exercised.
- Teacher KS2, meeting slides and custom dashboards have no harness, as before.

## Guy's commands, in order

These follow the template in `docs/FEEDBACK.md`, "Guy's commands", with this round's step 1. The branch `v0.8-admissions-fb2` is local, not pushed: `~/dev/vicdata_public` shares the repository, so it is there already. The live site is **`https://vicdata.co.uk`**.

**1. Apply the migration and record it** (it writes; the project-ref check comes first). Run it from `~/dev/vicdata_public`; the file is read from the branch, so `main` doesn't need it:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-admissions-fb2:supabase/migrations/20261120090000_v08_feedback_resolved_views.sql > /tmp/fb2.sql && supabase db query --linked -f /tmp/fb2.sql && supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('20261120090000', 'v08_feedback_resolved_views') on conflict (version) do nothing" && supabase db query --linked "select version, name from supabase_migrations.schema_migrations where version = '20261120090000'"
```

Expect one row: `20261120090000 | v08_feedback_resolved_views`. Then check the new column is there:

```
cd ~/dev/vicdata_public && supabase db query --linked "select ref, status, resolved_views from feedback_for_triage where number in (31, 32, 36) order by number"
```

Expect F-31 and F-36 planned and F-32 new, each with `{}`.

Until the deploy (step 2), the live window still sends the stale state, so **don't send feedback from a window opened before a change of entry point or panel**: the database would now refuse it, with the message above.

**2. Merge and push** (the push starts the Render deploy). From `~/dev/vicdata_public` on a clean `main`:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-admissions-fb2 -m "0.8 Admissions feedback round 2: F-31 the intake waterfall as two steps with families moving as the of which; F-36 each rival in full screen; the feedback window follows the view; resolved_views" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge commit.**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** none this round. No published dashboard changed (`src/catalogue/dashboards` is untouched). F-31 and F-36 are component, route and catalogue-method code.

**6. Set fixed** (it writes), from the same checkout at the merge, one call per item because their views differ:

```
cd ~/dev/vicdata_public && C="$(git rev-parse --short=12 HEAD)" && scripts/feedback-set-fixed.sh "$C" F-31 --view "vicdata.admissions.pipelines:vicdata.admissions.pipelines.c2.now:vicdata.admissions.pipelines.c2.now/DV-ADM-P-FUNNEL" && scripts/feedback-set-fixed.sh "$C" F-36
```

- **F-31** is recorded against "Your cohort, girls and boys" (mis-filed), so its fix's view, the funnel, goes in with `--view`.
- **F-36** is on its own view, You and the rivals. No other view was extended, so it takes no `--view`. The band roll was refactored but draws the same.
- **F-32** needs no fix and is not in this step. See "F-32's attribution".

**7. Live check.**
1. **Load `/platform/feedback` once.** That records the build: F-31 and F-36 read **Deployed**, and the gaps line reads "Deploy gaps: 0 · live build <the merge>".
2. **Give "Looks good" on each fixed view.** View as Leighton Park, Admissions:
   - **F-31:** Pipelines → "Why did our intake change?" **at 16+**: the five columns, "local 15-year-olds: 6,622 → 8,134 (+23%)", the dashed "of which +1", "82 + 18 − 10 = 90", the new note and the (i). Also look at 11+ (47 + 3 + 7 = 57). Either entry closes it: the auto-close matches the view, not the entry point.
   - **F-36:** Market share → "You and the rivals" **at 11+**, in full screen: each rival with a key and labelled gridlines, and the two small schools named under it. The panel still shows the average.
   - **The feedback window, while you're there:**
     - open it on one view;
     - change the entry point: it offers the move, and the header shows "· 16+";
     - click into another panel: it offers "Move to …";
     - press Send without moving: you get "Before sending: …".
3. **Read the gaps and the statuses.** Expect no rows from the first query, and F-31 and F-36 **done**:

   ```
   cd ~/dev/vicdata_public && supabase db query --linked "select ref, status, gap from feedback_deploy_gaps order by number" && supabase db query --linked "select ref, status, resolved_views, checked_live_at::date from feedback_for_triage where number in (31, 32, 36) order by number"
   ```
