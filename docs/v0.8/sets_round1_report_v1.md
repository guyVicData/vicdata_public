# VicData 0.8 Sets round 1: report

Built straight through, unattended, from `docs/v0.8/vicdata_0_8_sets_round1_claude_code_prompt_v2.md`, on branch **`v0.8-sets-r1`** (from `main` 8eb2fc9; local, not pushed or merged). **Nothing was written to any database.** The migration is written and tested in PGlite, and **not applied**: Guy's step 1 applies it. Every call made along the way is in `docs/OPEN_QUESTIONS.md` under "2026-11-06: sets round 1" (M1 to M5).

## How far it got

| Milestone | State | Commit |
|---|---|---|
| Prompt and design files | moved from `.sets_design_inbox/` into `docs/v0.8/sets_design/` (the main checkout no longer holds them) | `aaac88b` |
| **M1 Storage** (A1-A5) | done: one model, RLS, the cap, `save_set`, the conversion, every old reader moved, the recipes | `4400490` |
| **M5 Small fixes and 7 Nov feedback** (F23-F25) | done (built in parallel, merged after M1) | `97f164d`..`dd6a725`, merged `5f929d2` |
| **M2 The selector** (B6-B11, G26, G30) | done on Admissions, SMT and Teacher | `da00c2b` |
| **M3 The editor** (C12-C17, E22, G27) and **M4 Library and set view** (D18-D21, G28, G29, G31) | done; built and checked together, so one commit | `4bb0b15` |
| Phone and layout fixes from the 390 px measurements; the screenshots | done | `439c6e5` |
| **Lead-only school sets** (Guy, 7 Nov), the School-Admin's audit, and the parity fixes | done | `a49d8fe` |
| **M6 "Add to set…"** (stretch) | not built (see OPEN_QUESTIONS) | — |

Left for a later round:
- Teacher's chooser still builds the LA set and the rankings. The menu's last Default row opens it.
- The old tables are still in place (`admissions_lists`, `saved_sets`, `saved_set_members`). Nothing reads or writes them now; dropping them waits until Guy has seen this round live.
- `admissions_list_shares` has nothing left to grant for sets. It still gates the entry points and the shared-lists page.
- There is no request flow for "Propose as school set" when you don't curate that kind.

## The model (A1-A4)

There is one table for every stored set, `public.sets`, with `set_members` (urn, position, tier) and `set_user_state` (per person and per set: last used and folder). The migration is `supabase/migrations/20261121090000_v08_sets_r1.sql`.

| Field | Holds |
|---|---|
| `name`, `description` | the set's name, and "why these schools" |
| `kind` | `compared_against` or `feeders` |
| `entry_point` / `phase` | Admissions `4+`, `11+`, `16+` or `age:N`; or Teacher `ks4` or `ks5`; or neither (whole school) |
| `focus_urn` | the school the set is about |
| `owner_scope` | `school` (curated) or `personal` |
| `creator_kind` | stored: `admissions`, `smt`, `school_admin`, `me`. Default, group and Victoria Consultancy sets are computed when shown, never stored. |
| `pinned`, `folder`, `tags`, `archived` | the menu and the library; folders are per person in `set_user_state` |
| `rule`, `source_recipe`, `la_blend`, `config` | the old fuzzy definition, the default set it started from, the lead's LA birth blend, Teacher's extras |
| `audience`, `rung_age`, `is_default` | feeders: day or boarding; the 16+ rung; the school's own choice for its page (so Admissions reads the same lists) |
| `legacy_list_id`, `legacy_saved_set_id` | the converted row, so a second run changes nothing |

The pure rules are in `src/lib/sets/model.ts`:
- which sets fit a page (11+ compared-against sets on GCSE pages, 16+ on Post-16; feeder sets never in Teacher);
- who curates which kind;
- the cap.

Reads and writes go through `src/lib/sets/store.ts`.

## Who reads and writes: the RLS (R-SETS-RLS)

- **Reading.**
  - A **personal** set is read by its owner only. If it names a school, the owner must be approved there.
  - A **school** set is read by every approved member of its school, and by platform admins. View as reads through the server once `resolveCaller` has confirmed it.
- **Writing: school sets are lead-only (Guy chose this, 7 Nov).** The kind's curators write school sets (`can_curate_sets`):
  - compared-against sets: the Admissions lead, SMT, and the School-Admin or the account holder;
  - feeder sets: the Admissions lead, and the School-Admin or the account holder.
  - Everyone else -- other Admissions members, teachers, HoDs -- keeps **personal sets only**. "Propose as school set" stays disabled for them, saying "Ask your Admissions lead", until there is a request flow.
- **The audit.** A School-Admin's change to a school set (one only their School-Admin standing allows: not as the lead, nor as SMT on a compared-against set) writes `admissions_lists_override` to `platform_audit_log`, as 0.7 r2b audited the lists. Each row carries r2b's fields (op, entry point, the old list kind, the schools added and removed, what changed) plus the set's id and name; People -> Admissions history shows it. `save_set` writes only the difference, so one change is one row. The lead's and SMT's own writes aren't audited, nor is the service role's.
- **Guards.**
  - No set can be moved to another school, made personal, or given away.
  - A school set's creator must be the writer's standing there (a trigger): `admissions` is the lead's, `smt` SMT's, `school_admin` the School-Admin's.
- **The cap:** **up to 8 active personal sets** per person, and archiving frees a slot (a trigger).
- **The stamp:** who changed a set and when is the database's own stamp. A member change stamps the set too.
- **`save_set(p_id, p_set, p_members)`** writes a set and its schools in one call, under the caller's own RLS (SECURITY INVOKER). Every save path uses it.

## The conversion: Leighton Park's 6 rows (A5)

The migration converts every `admissions_lists` row, and every `saved_sets` row (none live), into a set. PGlite proved it against a copy of the 6 live rows, read on 7 Nov (`supabase/tests/fixtures/sets_r1_leighton_lists.json`).

**Before** (`admissions_lists`, Leighton Park 110110; every row confirmed, updated by Guy as lead, LA blend null):

| entry | kind | schools | fuzzy rule |
|---|---|---|---|
| 11+ | day_feeders | 18 | none |
| 11+ | boarding_feeders | 27 | none |
| 11+ | rivals | 10 | `{n:10, sector:"independent", source:"nearest"}` |
| 16+ | day_feeders | 16 | none |
| 16+ | boarding_feeders | 18 | none |
| 16+ | rivals | 10 | `{boarding:"1", n:10, source:"nearest"}` |

**After** (`sets`): six school sets.
- Each set:
  - is made by Admissions, `focus_urn` 110110, pinned, and the school's default for its page;
  - keeps its members in the same order and the rule as given;
  - has no blend;
  - keeps the same `updated_by` and `updated_at`.
- By row:
  - **11+:** "Day feeders" (feeders, day, 18); "Boarding feeders" (feeders, boarding, 27); "Rivals" (compared_against, 10, rule kept).
  - **16+:** "Day feeders" (16); "Boarding feeders" (18); "Rivals" (10, rule kept).
- **A second run changes nothing:** the sets, members, order, rules and stamps compare identical. The old table is untouched.

**What the page draws:** Leighton Park's Pipelines draws its day and boarding feeders together, as before ("Day + boarding feeders"), from **the same two lists, so the same figures**. Market share draws its "Rivals".

## Screenshots

The screenshots are in `docs/v0.8/sets_r1_screenshots/`: 8 surfaces, each at 1440×900 and 390×844 (phone at 2×), in light and dark, making 32 PNGs. A preview harness drew them from the app's own components and pages, on a fake Supabase, with real data: Leighton Park's converted sets, the real recipes and real `editorData` output. The harness is in the session scratchpad (`sets_shots/`).

| Surface | Files |
|---|---|
| The selector: Admissions (Feeder schools on Pipelines, Compared against on Market share, the real top bar), SMT, and Teacher's Comparisons column (200 px, a long name truncating) | `selector_admissions_*`, `selector_smt_*`, `selector_teacher_*` |
| The menu: desktop popover, phone bottom sheet | `menu_*` |
| The editor: rivals (Leighton Park 11+ "Rivals"), and a 27-school feeder set grouped by tier with the Add schools panel | `editor_rivals_*`, `editor_feeders_*` |
| The library | `library_*` |
| The set view | `set_view_*` |

**Phone measurements (390×844, headless Chrome), after the fixes below:**

| Surface | scrollWidth | Past 390 px | Controls under 44 px | Sheets |
|---|---|---|---|---|
| Selector, Admissions (closed and open) | 390 | 0 | 0 in the selector | the menu sheet: Esc, the handle and the backdrop each close it |
| Selector, SMT | 390 | 0 | 0 in the selector | as above |
| Selector, Teacher | 390 | 0 | 0 | |
| Editor, rivals and feeders | 390 | 0 | 0 (each row's checkbox sits in a 44×44 label) | Add schools: Esc, the handle and the backdrop each close it; the sticky bar holds Save 62×44, Save as… 95×44 and ··· 44×44 |
| Library | 390 | 0 outside the deliberate sideways rows (the tabs, the pinned tiles) | 0 | |
| Set view | 390 | 0 | 0 | |

The selector rows above exclude the surrounding Admissions phone header: its own chips (Pipelines and Market share, the entry points, ±, and the Pupils chip beside them) are 29 to 32 px tall, as they were before this round.

**What the first measuring pass found, now fixed:**
- Esc didn't close the editor's Add schools sheet.
- The two sheet handles shrank to 38.7 and 34.6 px (missing `shrink-0`).
- The desktop library table ran 1454 px wide at 1440, and its Kind column wrapped.
- The set view's phone list ran a long name into the km column, with no gap after the number.
- Its folded headings wrapped into two 44 px lines.
- The feeder editor's side panel cut suggestion names to six characters.
- Teacher's set line put its icon on a line of its own.

## Rules

**Added (11):**
- R-SETS-ONE-MODEL, R-SETS-RLS (M1);
- R-SET-PILL, R-SET-DEFAULTS-ADMISSIONS, R-PANEL-NAMES-SET (M2);
- R-SET-EDITOR-TICK, R-SET-HOW-CLOSE, R-FEEDER-TIERS (M3);
- R-SETS-MOBILE (M4);
- R-ADM-MOMENTUM-IGCSE (M5).

**Rewritten:**
- **R-ADM-FILTERS:** the server's filters remain, but the top bar no longer draws them. Its Day + boarding and Independent only dropdowns became choices of set.
- **R-ADM-BOARDING-ONLY-WHERE-BOARDERS:**
  - A boarding school's boarding surfaces now include the menu's boarding sets, in place of the filter.
  - A day school's menu offers none.
  - Boarding feeders are independent preps, day or boarding (B8). The runner checks all three.
  - M5's F24 made the (i)'s boarding sentences boarding-only; the runner now checks all 36 (i)s.

**Runners updated, statements unchanged:**
- **R-ADM-MOMENTUM-IGCSE:** it tests Leighton Park's new default set, "10 nearest | independent". On it the panel switches to Post-16 as the brief expected: 8 of 10 have no GCSE (5 IGCSE).
- **R-ADM-MAP-SELF:** it accepts the map's new marker function, which still draws the school's own dot first.

**Retired:** none.

## Tests

On the branch at `a49d8fe`:

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors; the 3 warnings are older than this round |
| build | passes |
| Unit (`src/**/*.test.ts(x)`, each with `--env-file=.env --test-force-exit`) | 73 files, **585 pass, 0 fail** |
| Catalogue unit | **77 pass, 0 fail** |
| Rule tests | **147 pass, 0 fail, 0 error**; 15 manual, 19 with no test, 6 superseded |
| PGlite, RLS and usage log (all 25 suites, run as their headers say) | **all pass**, including the new `v08_sets_r1_pglite.mjs` (**77 / 77**: the conversion, run twice, reads, lead-only writes by kind and the School-Admin's audit, moves and takeovers, the cap, the stamp, `save_set`) |

## Parity

Every harness ran twice against the base `aaac88b` (`main` 8eb2fc9 plus the prompt):
- **Run 1:** the branch at `5f929d2` (M1 and M5).
- **Run 2:** the branch at `4bb0b15` (through M4).

Both trees ran in their own detached worktrees, with fixtures captured from each tree's own code (read-only). The harness copies and commands are in the session scratchpad (`sets_par/harness_copies/README.txt`).

**Run 2 found one real bug, now fixed.** The Admissions routes returned the set in use under `sets`, the same key as the pipeline's own rung sets. With the route's real answer, Pipelines failed to draw ("p.sets.find is not a function"), as did Market share on a phone. The key is now `setChoices` (`a49d8fe`).

**Runs 3 and 4 checked that fix.** In both, the stubs return exactly what the routes return (`setChoices` beside the pipeline's own `sets`).
- **Run 3, on `2b6bbd4`:**
  - Admissions: 468 rail steps and 1,872 panels, 0 unexpected.
  - SMT: 152 pairs, 100 allowed, 3 noise, 0 unexpected, every chart identical to the base.
  - Leighton Park: Pipelines and Market share at 11+ and 16+, 1440 and 390, light and dark, every view drawn (16 to 24 per page) and no console errors.
  - It also found the phone panels named no set (G30).
- **Run 4, with the phone fix:**
  - Admissions at 390: 234 rail steps and 702 panels, 0 unexpected. The 530 phone panels that draw a set now name it, wrapped and never truncated.
  - Leighton Park: every view still draws, with no console errors.

**"Figures never change for the same set of schools" holds.** The Admissions fixtures call the views with no lists (round 1's nearby defaults), so the sets compare like for like:
- Every Admissions panel was compared with its set lines and set names set aside; all 856 changed panels then match the base exactly, SVG coordinates included.
- In SMT, every chart SVG on the 100 changed pages is identical to the base.
- Teacher's changed pairs differ only by the set line.

| Harness | Pairs | Identical | Allowed | Noise | Unexpected |
|---|---|---|---|---|---|
| Teacher walker, 7 case sets (PNG + words), run 2 | 2,875 | 1,847 | 978 | 50 | 0 |
| Teacher public-page SSR (137625, 117037) | 2 | 2 | — | — | 0 |
| Admissions rail steps, 4 schools × both themes × 1440 and 390 (PNG + DOM), run 2 | 468 | 0 | 468 | 0 | 0 |
| Admissions panels inside those steps | 1,170 | 314 | 856 | 0 | 0 |
| Admissions full screens (You and the rivals, Entry age band roll) | 32 | 0 | 32 (F23) | 0 | 0 |
| SMT, 2 schools (PNG + DOM) | 152 | 52 | 100 | 0 | 0 |
| Groups, nothing picked / a member school picked | 368 | 366 | 0 | 2 | 0 |
| Data View, light and dark | 72 | 72 | 0 | 0 | 0 |

**What the allowed differences are:**
- **Admissions:**
  - the top bar (the set selector, Girls & Boys, the two dropdowns gone);
  - the panel headers' set lines;
  - the set's name in view titles;
  - the "Rivals:" and "Feeders:" chips gone;
  - F25's Rivals' momentum line (two schools named, then "and n more");
  - F23's dashed "Rivals' average" in both full screens;
  - F24's "sector filter" for the day schools' (i)s.
- **SMT:** the selector, and " · n" in the headers.
- **Teacher:** the set line in the Comparisons panels, 968 pairs at run 2. The panels at the committed `a49d8fe` don't repeat it (see below).
- **Teacher's column 3 width is unchanged:**
  - The grid template is `385.328px 2px 385.328px 2px 385.344px` in both trees, at 1280, 1440 and 1920, in both themes.
  - The set button is 200 px wide.
  - The column is 4.75 px taller with the selector, which moves the "not available" panels down: 10 pairs, words equal.

**The other thing run 2 found, now fixed (`a49d8fe`):** Teacher's Comparisons cards have a fixed height, and the per-panel set line squeezed their contents (the tenth bar, the trends legend). The column's set selector sits directly above both panels and names the set and its count, so the panels no longer repeat it (R-PANEL-NAMES-SET says so). Run 1 had also found F25's momentum line clipping the flag table at two schools; that was fixed before run 2.

## Guy's commands

These follow the template in `docs/FEEDBACK.md`. The branch `v0.8-sets-r1` is local, not pushed: `~/dev/vicdata_public` shares the repository, so it is there already. The live site is **`https://vicdata.co.uk`**.

**Between step 1 and step 4, don't change Admissions' lists on the live site.** The old code still writes `admissions_lists`. A change made there after the conversion wouldn't reach the sets: running the conversion again adds only rows it hasn't converted.

**1. Apply the migration and record it** (it writes; the project-ref check comes first). Run it from `~/dev/vicdata_public`; the file is read from the branch, so `main` doesn't need it:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-sets-r1:supabase/migrations/20261121090000_v08_sets_r1.sql > /tmp/sets_r1.sql && supabase db query --linked -f /tmp/sets_r1.sql && supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('20261121090000', 'v08_sets_r1') on conflict (version) do nothing" && supabase db query --linked "select version, name from supabase_migrations.schema_migrations where version = '20261121090000'"
```

Expect one row: `20261121090000 | v08_sets_r1`. Then check the conversion:

```
cd ~/dev/vicdata_public && supabase db query --linked "select s.entry_point, s.name, s.kind, s.audience, s.creator_kind, s.is_default, (select count(*) from set_members m where m.set_id = s.id) as schools, s.rule from sets s order by s.entry_point, s.kind, s.audience"
```

Expect six rows: 11+ Boarding feeders 27, Day feeders 18, Rivals 10 (with its rule); 16+ Boarding feeders 18, Day feeders 16, Rivals 10 (with its rule). Each is `admissions` and default.

**2. Merge and push** (the push starts the Render deploy). From `~/dev/vicdata_public` on a clean `main`:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-sets-r1 -m "0.8 Sets round 1: one sets model (Leighton Park's lists converted), one set selector on Teacher, SMT and Admissions, the set editor, the library and set view, tiers, F-36/F-20 averages, boarding-only (i)s, F-40/F-41 Rivals' momentum on post-16" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge commit.**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** none this round. No published dashboard changed (`src/catalogue/dashboards` is untouched). The selector, the headers and the top bar are component code.

**6. Set fixed** (it writes), from the same checkout at the merge:

```
cd ~/dev/vicdata_public && C="$(git rev-parse --short=12 HEAD)" && scripts/feedback-set-fixed.sh "$C" F-40 F-41
```

- **F-40 and F-41** were both filed on Rivals' momentum at 11+ itself (`…market-share.c2.now/DV-ADM-M-MOMENTUM`), the view the fix changed. So the prompt's `--view` for Rivals' momentum is their own view, and it needs no `--view`: the database drops an item's own view from `resolved_views`.

**7. Live check.** Load `/platform/feedback` once: F-40 and F-41 read **Deployed**, and the gaps line reads "Deploy gaps: 0 · live build <the merge>". Then View as each school below, as Admissions, and walk the route.

1. **Leighton Park (110110), Admissions, 11+.**
   - **Pipelines.**
     - The top bar reads "Feeder schools" then [Day + boarding feeders · 27] (the 18 day feeders are all among the 27 boarding ones), then Pupils (Girls & Boys).
     - There are no Day + boarding or Independent only dropdowns.
     - Panel headers read "Day + boarding feeders · 27".
     - The figures are as before.
   - **The menu.** Open it:
     - **Default:** Day | all sectors / state / independent, and the Boarding versions.
     - **School sets:** Day + boarding feeders, Day feeders, Boarding feeders, each tagged Admissions.
     - **My sets:** "0 of 8".
     - Pick "Day | all sectors": the page redraws, and the address gains `fset`.
   - **Edit this set…:**
     - In View as it isn't offered (read-only).
     - Signed in as yourself (the lead), it opens the editor. Tier a few schools Main, then Save: you come back to Pipelines on that set, and the feeder table lists the Main feeders first.
   - **Market share.**
     - "Compared against" [Rivals · 10] (your saved rivals).
     - Rivals' momentum reads "Post-16 results: n of 10 rivals have no GCSE results (mostly IGCSE)" if over 40% have none. Otherwise it stays on GCSE with "Left out, no GCSE results: …".
     - Give **Looks good** on Rivals' momentum: that closes F-40 and F-41.
   - **Manage sets:** the library at `/sets`, filtered to the page. Open "Rivals": the set view.
2. **Leighton Park, 16+.** The same, with the 16+ sets. The LA default reads "All post-16 in Reading", and Rivals' momentum is unchanged (post-16 already).
3. **A day school, The Chase (137625), 11+.**
   - The menu has no boarding set.
   - The (i)s have no boarding sentences.
   - Its default rivals are "10 nearest | state", or as the menu shows.
4. **A state school, Maiden Erlegh (136637), 11+.**
   - Rivals' momentum stays on GCSE (3 of 10 have no GCSE).
   - Teacher's GCSE page at the school shows the set selector in the Comparisons column, the button the same width as the old pill.

Then read the statuses. Expect F-40 and F-41 **done**:

```
cd ~/dev/vicdata_public && supabase db query --linked "select ref, status, gap from feedback_deploy_gaps order by number" && supabase db query --linked "select ref, status, checked_live_at::date from feedback_for_triage where number in (40, 41) order by number"
```
