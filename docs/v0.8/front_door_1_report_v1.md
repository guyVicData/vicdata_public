# VicData 0.8 front door, part 1: theme, homes and walks — report

Built straight through, unattended, from `docs/v0.8/vicdata_0_8_front_door_part1_theme_homes_walks_claude_code_prompt_v1.md`, on branch **`v0.8-front-door-1`** (from `main` 31fa917; local, not pushed or merged). **Nothing was written to any database.** The one migration is written and tested in PGlite and **not applied**: Guy's step 1 applies it. Every call made along the way is in `docs/OPEN_QUESTIONS.md` under "2026-11-13: front door, part 1" (M2 to M5).

## How far it got

| Milestone | What | Commit |
|---|---|---|
| 1. Design files moved | `walkthroughs_design_inbox/` → `docs/v0.8/front_door_design/` (`git mv`, its own commit) | `b22fced` |
| 2. Theme, layering and colour (C18–C20) | Dark · Mid · Light (Mid on homes and walks only); the panel layer ladder on every dashboard; SMT orange; head office bronze | `e9f884e` |
| 3. Homes (B8–B10) | one home of question tiles for Teacher (by phase), SMT, a primary school's SMT, Admissions and head office; roles stacked; "Show fewer questions" | `59d56fd` |
| 4. First visit (A5–A7) | the welcome (once per person), the one-screen setup, "New since your last visit" and the changelog page | `75cefe7` |
| 5. Walks (B11–B17) | the walk player; the GCSE and Post-16 walks (3 each); SMT's, Admissions' and head office's walks; answer templates; the dumbbell; peer lines; HTML labels | `1f4688e` |
| 6. The report | this file, the screenshots, the final checks | (this commit) |

All six milestones are done. **What is left, or thinner than the prompt drew it** (each is in OPEN_QUESTIONS):

- **Head office's walks** answer their first screen from the group home's figures and **open each later view on the group dashboard** rather than drawing it in the walk: the group views and their data live in group code, off limits while group sets is built. After group sets merges, they can embed the group views the way the SMT walk embeds SMT's.
- **SMT's and Admissions' walks embed the dashboards' own view components**, fed by their own routes. They render only when signed in, so they **weren't seen in a browser here** (the local app is behind the gate): they are on Guy's live check list (step 7). Teacher's walks were rendered and screenshotted with real data.
- **One SMT walk screen opens the dashboard instead of drawing** (Context's map of where children live, which needs the boundary map's own load).
- **No figure on two tiles:** SMT's Context ("children nearby, next 5 years" needs the Context route, a heavier read) and head office's Academic (the group home's summary carries no results). Both show their question without a figure, as B9 allows.
- **Parity was run once, at the end**, on every harness, not after each milestone (see Parity).

## The new tables and RLS

One migration, `supabase/migrations/20261123090000_v08_front_door_r1.sql` (named after the latest on `main` and in the live history, both `20261122090000`; group sets' unmerged `20261121100000` is earlier):

| Table / function | What | Who reads | Who writes |
|---|---|---|---|
| `front_door_state` (one row per person) | `welcome_seen_at`, `last_visit_at`, `whats_new_seen_at` | the person, own row only | the person, own row only (insert, update) |
| `changelog_entries` | `published_at`, `title`, `body`, `credit_text`, `credit_profile_ids`, `link` (a path in the app) | nobody directly (platform admins) | platform admins (`is_platform_admin()`) |
| `changelog_for_me(max_entries)` | published entries, newest first; an entry's `credit_text` only for the people in its `credit_profile_ids` | every signed-in person | — |

Anon reads nothing. PGlite (`supabase/tests/v08_front_door_r1_pglite.mjs`, **16 / 16**) proves: a person reads and writes only their own state row, never another's; a row goes with its profile; only platform admins write the changelog; members can't read the table; the function lists published entries only (a future-dated one waits), newest first, with the credit for its person only; a link must be a path; RLS is on; the migration runs twice.

**Entries are Guy's, from a seed file** (`supabase/seeds/changelog_entries.sql`, two first entries dated 1 Dec 2026, re-runnable). Before the migration is applied the homes can't read the table, so nobody is sent to the welcome and no strip shows: the site works exactly as before. **After it's applied, everyone sees the welcome once on their next visit, existing users included.** If existing users should skip it, one insert marks them all seen (in step 1 below, optional).

## Theme: final tokens and the contrast table

**Mid** (C18) is the person's choice under the old localStorage key (an old "dark"/"light" reads unchanged). Dashboards, sets and admin pages ask `useTeacherTheme()`, which answers Dark under Mid; only the files in `src/lib/front-door/scope.ts` read Mid (the homes, first visit and walks). In Mid the page, header and "Also here" band stay dark and each area takes its part's colour (two stops, a glow top-left, a darkening bottom-right):

| Part | Field | Glow | Text on it | Accent (buttons, badges) | Tint |
|---|---|---|---|---|---|
| GCSE | #86E3AE → #1E9E5E | #4CD98A | #07200f | #15803d (text #12713a) | #dcf5e7 |
| Post-16 | #C1B0FF → #7A5BEF | #A48CFF | #1a1240 | #6a4be0 (text #5b3dd1) | #ece6ff |
| Top level (SMT, whole school) | #FFB74D → #F57C00 | #FF9F0A | #3a1c02 | #c2410c (text #b13c0b) | #ffeddc |
| Head office | the same orange field | | #3a1c02 | #8A5A2B (text #7E4F24) | #F3E6D8 |
| Admissions | #8BD8FB → #1596DB | #5AC8FA | #062436 | #0b6fa6 | #dcf1fc |

Inside a field the dashboard tokens turn to Light's, so tiles and chart plates are near-white. Only large text sits on a bare field: the Post-16 field's darker stop can't carry small text at 4.5:1 even in black (4.4:1 at best).

**The panel layer ladder** (C19), on every dashboard (the shell marks it `data-dash-ladder`; the tokens do the rest):

| | page | column / border | open panel = well / border | shut panel = raised bar / border, shadow |
|---|---|---|---|---|
| Dark | #08080a | #141417 / #222226 | #0b0b0d / #1f1f23 | **#27272e** / #34343b, `0 1px 0 rgba(255,255,255,.05) inset, 0 2px 6px rgba(0,0,0,.45)` |
| Light | #e9e9ed | #f6f6f8 / #dedee3 | #ffffff / #e2e2e7 | #ffffff / #cfcfd6, `0 1px 2px rgba(20,20,30,.10), 0 3px 8px rgba(20,20,30,.08)` |

Changes from the prompt's starting tokens: Dark's shut bar one step lighter (#24242a gave 1.19:1 from the column; #27272e gives **1.24:1**); on Light dashboards `--muted` is #63636a (the default #6b6b72 was 4.3:1 on the grey page; now 4.9:1). **Logged steps (R-PANEL-LADDER):** Dark fill ≥ 1.2 (1.24) and border ≥ 1.4 (1.49); Light border ≥ 1.4 (1.44, with the shadow; its white fill is 1.08:1 from the near-white column). A shut panel has a solid right chevron first and its figure in the accent; a shut row's head (Admissions, SMT, groups) is the raised bar too.

**Role colours** (C20): SMT **#fb923c** on Dark, **#c2410c** on Light (`ROLE_ACCENT_LIGHT.smt`, via `smtVars`; #fb923c is 2.3:1 on white). Head office's dashboards **#a8743f** (`GROUP_ACCENT`: the group pages read one hex in both themes, so it is the bronze that passes on both, 4.6:1 as text on the dark panel and 4.0:1 as a mark on white); the Mid homes use the deeper #8A5A2B. Set creator colours: SMT #9a3c0a on #feebdc / #ffb985 on #412c1d; the school's group #7e4f24 on #f3e6d8 / #e3bf98 on #3a2c1f. Featured rows: SMT #feebdc / #412c1d; groups #f7eee4 / #3a2c1f.

**The contrast table** (R-THEME-CONTRAST, read from `globals.css` by `contrastTable`; AA = 4.5:1 small, 3:1 large and marks):

| Pair | Colours | Kind | Ratio |
|---|---|---|---|
| GCSE: heading on the light / dark stop | #07200f on #86e3ae / #1e9e5e | large | 11.13 / 5.00 |
| GCSE: accent text on the tile / tint | #12713a on #ffffff / #dcf5e7 | small | 6.09 / 5.29 |
| GCSE: white arrow on the accent | #ffffff on #15803d | mark | 5.02 |
| Post-16: heading on the light / dark stop | #1a1240 on #c1b0ff / #7a5bef | large | 9.07 / 3.79 |
| Post-16: accent text on the tile / tint | #5b3dd1 on #ffffff / #ece6ff | small | 6.92 / 5.71 |
| Post-16: white arrow on the accent | #ffffff on #6a4be0 | mark | 5.68 |
| Top level: heading on the light / dark stop | #3a1c02 on #ffb74d / #f57c00 | large | 9.01 / 5.77 |
| Top level: accent text on the tile / tint | #b13c0b on #ffffff / #ffeddc | small | 5.96 / 5.23 |
| Top level: white arrow on the accent | #ffffff on #c2410c | mark | 5.18 |
| Head office: accent text on the tile / tint | #7e4f24 on #ffffff / #f3e6d8 | small | 6.93 / 5.65 |
| Head office: white arrow on the accent | #ffffff on #8a5a2b | mark | 5.87 |
| Admissions: heading on the light / dark stop | #062436 on #8bd8fb / #1596db | large | 10.14 / 4.89 |
| Admissions: accent text on the tile / tint | #0b6fa6 on #ffffff / #dcf1fc | small | 5.47 / 4.70 |
| Admissions: white arrow on the accent | #ffffff on #0b6fa6 | mark | 5.47 |
| Mid tile: text / muted / muted2 | #17171b / #5f5f67 / #4f4f56 on #ffffff | small | 17.88 / 6.33 / 8.12 |
| Ladder Light: shut bar title | #17171b on #ffffff | small | 17.88 |
| Ladder Dark: shut bar title | #f2f2f3 on #27272e | small | 13.26 |
| Ladder Light: text / muted in the well | #17171b / #63636a on #ffffff | small | 17.88 / 5.9 |
| Ladder Dark: text / muted in the well | #f2f2f3 / #8a8a90 on #0b0b0d | small | 17.58 / 5.73 |
| Ladder Light: muted in the column / on the page | #63636a on #f6f6f8 / #e9e9ed | small | 5.5 / 4.92 |
| Ladder Dark: muted in the column / on the page | #8a8a90 on #141417 / #08080a | small | 5.36 / 5.83 |
| Ladder Light: muted2 on the page | #55555c on #e9e9ed | small | 6.11 |

All 39 pairs pass.

## Homes, first visit and walks: what was built

- **Homes** (`/teacher`, and `/teacher/group` for head office): a section per role (stacked, 10 px of page between them, for a person with more than one role), each its part's field with its chips, "Open the full … dashboard" and its question tiles: a big real figure (the dashboard's own rows and routes) or none, the question, a row of round icons (one per screen of its walk, the view's own rail icon and name on hover), and one solid arrow. Tiles lift on hover. Teacher: a section per phase (GCSE, Post-16; KS2 with its dashboard button and "Walkthroughs for Key stage 2 come in a later round"), with a subject switcher for teachers of more than one subject. SMT: Overview, Academic, Pupils, Context, the "Sets of schools" card (D21, real counts, opening `/sets`) and the school's group card. A primary school: "Key stage 2", with Academic saying in its own space that SMT Academic has no KS2 views yet. Admissions: its entry-point picker, Pipelines, Market share and the "Sets of schools" card. Head office: Overview, Schools, Academic, Pupils, then "Our schools" (each opens that school's SMT home read-only, as before). "Also here": Dashboards, Meetings and the role's extras.
- **"Show fewer questions"** (home and the account menu, one switch per person in this browser): the dashboard button leads and the questions drop to one line of links.
- **First visit:** the welcome (what VicData is for, the private beta, where feedback lives), then the one-screen setup for a Teacher ("Which subjects do you teach?", every GCSE and Post-16 subject on one screen with qualifications as headings and the live entry count per phase), then home. Roles without subjects go straight home. A dashboard phase opened before setup goes there and back. The old four steps are gone. Later visits get the "New since your last visit" strip (newest entry, "and n more", a credit if it's theirs), linking to `/teacher/whats-new`.
- **Walks** (`/teacher/walk/<id>?…`): close, the walk's icon and question, step dots, the subject·phase chip, "Step n of N"; the screen's question large and a one-line answer from the data; the view as an enlarged panel (accent bar, column icon, name and question, the pill that sets it, the row tag, the panel's own rail with names written out, "As a table" switching in place, the chart under the view's own title, the note); the mini-map (3×2 grid, this panel lit, "Show me"); Back and a Next that previews the next question; "Here's what you found" at the end (every answer with where it lives, the other questions, the full dashboard).
- **Teacher's walks** (GCSE and Post-16): How many (tiles; the category's subjects; the whole school; entries over time with peers; the dumbbell; nearby and nationally, indexed), How well (tiles; the grade spread against England; the category; the whole school; results over time with unpublished years dotted; nearby and nationally), How do we compare (the map of the 10 nearest; entries at each; points at each; where we rank; our place over time). Results walks use Average points throughout. Peers take shades of their category's colour, light to dark, each with its own marker; LA, England and the nearest schools keep their fixed colours; region is in the table only. Every label on a line chart is HTML over the plot; only the lines are SVG.
- **The dumbbell** (`DV-C2-TR-DUMBBELL`, draft, **not on the dashboard's rail**, ready to add): every comparable subject, first year to latest, largest first; the focus row tinted; same-category subjects in the category colour, the rest grey; a dashed school-average row last; change in pupils with ▲/▼.

## Screenshots

`docs/v0.8/front_door_1_screenshots/` (49 PNGs; 1440 wide, phone at 390 × 844 drawn at 2×). Drawn by preview harnesses from the app's own components and the built CSS, with **real data** read through the app's own loaders (The Chase 137625, Leighton Park 110110, a primary academy 142990, Harris Federation 3320). Every page measured: no horizontal scroll at 390.

| Screen | Files |
|---|---|
| Welcome | `welcome_{mid,dark,light}_1440.png`, `welcome_mid_390.png` |
| Setup (Leighton Park: GCSE and Post-16 on one screen) | `setup_{mid,dark,light}_1440.png`, `setup_mid_390.png` |
| "New since your last visit" | `whats_new_strip_{dark,light}_1440.png` |
| Teacher home (Leighton Park, both phases) | `home_teacher_{mid,dark,light}_1440.png`, `home_teacher_mid_390.png` |
| SMT home (Leighton Park) | `home_smt_{mid,dark,light}_1440.png`, `home_smt_mid_390.png` |
| Primary SMT home | `home_smt_primary_{mid,dark,light}_1440.png`, `home_smt_primary_mid_390.png` |
| Head office home (Harris) | `home_group_{mid,dark,light}_1440.png`, `home_group_mid_390.png` |
| Admissions home (Leighton Park, 11+) | `home_admissions_{mid,dark,light}_1440.png`, `home_admissions_mid_390.png` |
| Walk: How many (The Chase, Geography) | `walk_many_1_mid_1440.png`, `walk_many_4_mid_1440.png`, `walk_many_4_mid_390.png` |
| Walk: How well | `walk_well_1_light_1440.png`, `walk_well_2_dark_1440.png`, `walk_well_2_dark_390.png` |
| Walk: How do we compare | `walk_nearby_1_mid_1440.png`, `walk_nearby_1_mid_390.png`, `walk_nearby_4_dark_1440.png` |
| The dumbbell | `dumbbell_{mid,dark,light}_1440.png`, `dumbbell_mid_390.png` |
| The ladder (open and shut panels) | `ladder_teacher_column_{dark,light}_1440.png`; Group Overview before and after: `ladder_group_overview_{light,dark}_{before,after}.png`; SMT Overview after: `ladder_smt_overview_{light,dark}_after.png` |

## Walk screens left out (their view doesn't exist yet)

| Walk | Screen | Why |
|---|---|---|
| A primary school's SMT Academic | every screen (Year 6 results, by subject, over time) | SMT Academic has no KS2 views yet; the tile says so in its own space |
| A primary school's SMT Pupils | Reception places filled | no view holds places or offers; the walk uses the year groups and the entry points |
| A primary school's SMT Pupils | Leaving at 16 | no Year 11 |
| Head office Academic | Post-16 trend, Value added | shown on the group dashboard by phase; one Results trend keeps the walk to five |

## Rules

**Added (10):** R-THEME-MID-SCOPE, R-THEME-CONTRAST, R-PANEL-LADDER, R-ROLE-COLOURS (M2); R-HOME-TILES (M3); R-WELCOME-ONCE, R-SETUP-ONE-SCREEN, R-WHATS-NEW (M4); R-WALK-RHYTHM, R-WALK-KEYS, R-DUMBBELL (M5). Each has a runner: the theme ones read the stylesheet and the source; R-HOME-TILES, R-WALK-RHYTHM, R-WALK-KEYS and R-DUMBBELL build the walks on two real schools (The Chase GCSE Geography, Leighton Park Post-16); the first-visit ones run their unit tests and the PGlite suite.

**Rewritten (1):** R-TABLE-FEATURED-ROW's statement: "SMT violet, groups orange" became "SMT orange and the groups (head office) bronze". Its test is unchanged (it reads the tokens, still one per product, light and dark).

**Retired:** none. No rule named the old onboarding Step 4 (checked: rules, runners and unit tests).

`docs/catalogue/*.md` regenerated. The dumbbell is in the dataview catalogue (draft, rail null) with its renderer (RD-DUMBBELL), viewspec preset and method note. `docs/v0.6/views_preset_table.md` regenerated, which also fixed a failure that was already on `main` (its hand-written SMT rows were stale).

## Tests

On the branch at the report's commit:

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors; 3 warnings, all older than this round |
| build | passes |
| Unit (every `src/**/*.test.ts(x)`, each with `--env-file=.env --test-force-exit`) | **632 pass, 5 fail**; all 5 fail on `main` too (below) |
| Catalogue unit | **77 / 77** |
| Rule tests (production reads; PGlite installed) | **167 pass, 0 fail**; 15 manual, 19 with no test, 8 superseded. The last full run (at M5) gave 165 and 2 fails, R-MINUS-SIGN and R-NO-NEGATIVE-ZERO, which caught a hand-rolled sign in the head office walk; fixed (the shared `signedValue`), and both pass, re-run alone with the theme, ladder, home-tile and report rules after the last changes |
| PGlite, RLS and usage log (all 27 suites, run as their headers say) | **26 pass**; `v08_view_as_editing_pglite.mjs` 42 / 44 on both the branch and `main` (below) |

**Failing on `main` already (not this round's; unchanged by it):**
- `editor-guarantees.test.ts` (4) and `v08_view_as_editing_pglite.mjs` (2): the editor's dashboard fixture names three SMT Academic dataviews that SMT Academic round 2 removed (`DV-SMT-A-SUBJECTS`, `-VA`, `-BANDS`).
- `groups/rules.test.ts` (1): R-GROUP-HARRIS-ROLL expects the ingest's 42,940; the live lookups give 42,938.
- On `main` the unit run also fails `viewspec.test.ts` (1): fixed on this branch (the regenerated preset doc).

## Parity

Base: `b22fced` (`main` 31fa917 plus the design move; no app change) in its own detached worktree. Branch: the working tree at M5. Each harness drew the same fixtures, captured from each tree's own code: **byte-identical between the trees in every harness** (Teacher 10 / 10, Admissions 4 / 4 schools, SMT, Groups).

Every pair was compared three ways: the PNG, the DOM, and the **words** (every figure, label and title on the view). The harnesses' own "identical / noise" bars are pixel bars, and the ladder moves pixels on every dashboard by design, so a pair is counted **allowed** when its words are identical to the base (setting aside the theme switch's three words), and **unexpected** only if its words differ.

| Harness | Pairs | Words identical (allowed: ladder, switch, colours) | Words differ | Not compared |
|---|---|---|---|---|
| Teacher walker, 7 case sets (PNG + words digest per panel view) | run 1: 2,051 | 1,995 | 56, in 4 cases (resolved by run 2) | 131 views in 38 cases that failed on either side |
| Teacher walker, re-run of the two sets holding those 4 cases (c5_0, c5_1) | 1,084 | **1,084** (the 4 cases included: 94 views) | **0** | 19 views in 4 cases that failed |
| Teacher public-page SSR (137625, 117037) | 2 | 2 (byte-identical) | 0 | — |
| Admissions, 4 schools × 2 entry points × both themes × 1440 and 390, every rail step (PNG + DOM) | 468 | 468 | 0 | — |
| SMT, 2 schools × 4 dashboards × both themes × 1440 and 390, every rail step (PNG + DOM) | 142 | 142 | 0 | — |
| SMT home (2 schools × themes × widths) | 8 | — | 8 | allowed: the new home (in the harness it opens the welcome: no `front_door_state` row there) |
| Groups, Harris and Dukes × 4 dashboards × both themes × 1440 and 390, every rail step (PNG + DOM) | 88 | 88 | 0 | — |
| Head office home | 8 | — | 8 | allowed: the new home |
| Data View | — | — | — | not re-walked: the import graph shows its only changed modules are the catalogue (a draft dataview it never lists, its preset) and the theme constants (SMT's and the group's accent hexes, which it doesn't draw); the public page's SSR is byte-identical |

**Run 1's 56 differing views** came from 4 cases where the branch's walker captured a different state from main's on that run (for one: 7 shots in 6 s against main's 25 in 21 s, on another subject and measure). Run 2 re-walked their case sets: all 1,084 views identical in words, those 4 cases among them. **Failed cases** (a walker error such as "execution context was destroyed") happened on both trees about equally (run 1: main 22, branch 19), with Chromium's headless shell standing in for Google Chrome, which is no longer installed; they are left out of both counts, never counted as passes. Teacher's fixtures were byte-identical between the trees (10 / 10). The harness copies, the commands and the two word-comparison scripts are in the session scratchpad (`par/`, `grp/`, `smt/`, `adm/`, `domcmp.py`, `wordscmp2.py`). **The runs drew the tree at M5**: the two changes after it (Light dashboards' muted text one step darker; the sets card on the SMT and Admissions homes) are a text colour on Light dashboards and a home card, neither a figure.

**What the allowed differences are:**
- **The panel ladder** on every dashboard: the page, column and well tones, the shut panel's raised bar (its chevron moved to the front, its figure in the accent), a shut row head's bar.
- **The theme switch** in the nav: "Dark · Mid · Light" where the sun/moon button was (the only word difference on any dashboard page).
- **SMT orange** (accent, tints, featured rows, set colours) and **head office bronze** (the group pages' accent through `GROUP_ACCENT`, their featured row).
- **The homes:** the SMT, Teacher and head office homes are new pages.

**Figures never change:** in every dashboard page compared, the words (every figure, label and title) are identical to the base, once the theme switch's three words are set aside.

**Group-page parity pictures the ladder changes** (for whoever merges second to re-run): **every Group dashboard picture** — Overview, Schools, Academic and Pupils, for both groups (Harris, Dukes), both themes, 1440 and 390, and every rail step (88 pictures: page tone, panel well and border, the bronze accent, the theme switch) — and **all 8 head office home pictures** (the home is rebuilt). The Access and join pages change only by the nav's theme switch.

## Seams left for Parts 2 and 3

- **Part 2 (guided sets, School-Admin, phone):** the Admissions and SMT homes' "Sets of schools" card (D21: the school's saved and ready-made sets, counted by the sets library route) opens the round-1 library (`/sets`); Part 2 points it at the guided editor (`SetsCard` in `sections.tsx`, one `href`). The phone layouts are the responsive defaults (no designed phone layout). School-Admin's own home isn't built: a School-Admin without SMT gets the Admissions section, as before.
- **Part 3 (sign-in, gate, security):** the welcome names the private beta in words only. `front_door_state` is where a "beta terms accepted" stamp could go.
- **Group sets (merging first):** `GROUPS_LIBRARY_HREF` in `GroupHome.tsx` (null) becomes its "Groups library" card; `groups/ui.ts` and `groupDashVars` still write orange as the group pages' light accent text and chip tints (one-line changes to bronze after the merge); the head office walks can then embed the group views.
- **The dashboard:** the dumbbell is ready for Context › Trends (needs a ViewSpec "dumbbell" kind); a walk's rail opens the dashboard but not yet at the chosen panel and view (no deep link exists); Mid on the dashboards is the next step Guy named.

## Merging with group sets

`main` was fetched at the end (13 Nov): **group sets has not merged** (`main` is still 31fa917). Guy merges group sets first; then this branch takes `main` and re-runs its checks. Expected conflicts: `src/components/groups/GroupHome.tsx` (group sets edits the old Body and adds GroupDashChips' `library` prop; take this branch's Body, keep their `GroupDashChips` change, and set `GROUPS_LIBRARY_HREF`), and possibly `src/app/globals.css` (both add tokens), `scripts/catalogue-rule-tests.ts` and `src/catalogue/rules.ts` (both append rules: keep both).

## Guy's commands

The branch `v0.8-front-door-1` is local, not pushed: the worktree at `~/.t3/worktrees/vicdata_public/t3-f46beabf` shares the repository with `~/dev/vicdata_public`, so it is there already. The live site is **`https://vicdata.co.uk`**. Group sets merges first.

**1. Migrations** — apply the front door's migration and record it (it writes; the project-ref check first), then load the changelog's first entries:

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-front-door-1:supabase/migrations/20261123090000_v08_front_door_r1.sql > /tmp/front_door_r1.sql && supabase db query --linked -f /tmp/front_door_r1.sql && supabase db query --linked "insert into supabase_migrations.schema_migrations (version, name) values ('20261123090000', 'v08_front_door_r1') on conflict (version) do nothing" && supabase db query --linked "select version, name from supabase_migrations.schema_migrations where version = '20261123090000'"
```

Expect one row: `20261123090000 | v08_front_door_r1`. Then the changelog's entries (edit the file first if you want different words or dates):

```
cd ~/dev/vicdata_public && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && git show v0.8-front-door-1:supabase/seeds/changelog_entries.sql > /tmp/changelog_entries.sql && supabase db query --linked -f /tmp/changelog_entries.sql && supabase db query --linked "select title, published_at from changelog_entries order by published_at"
```

Optional, only if existing users should skip the welcome (everyone who has a profile today):

```
cd ~/dev/vicdata_public && supabase db query --linked "insert into front_door_state (profile_id, welcome_seen_at, whats_new_seen_at, last_visit_at) select id, now(), now(), now() from profiles on conflict (profile_id) do nothing"
```

**2. Merge and push** — after group sets is on `main`: from `~/dev/vicdata_public` on a clean `main`, merge (resolve as "Merging with group sets" says), re-run the checks, build, push:

```
cd ~/dev/vicdata_public && git checkout main && git pull https://github.com/guyVicData/vicdata_public.git main && git merge --no-ff v0.8-front-door-1 -m "0.8 front door part 1: Dark · Mid · Light, the panel ladder, SMT orange and head office bronze; one home of question tiles for every role; the welcome, one-screen setup and what's new; the walks" && npm run build && git push https://github.com/guyVicData/vicdata_public.git main
```

**3. Render deploys main on its own** (auto-deploy, On Commit). If no deploy starts within 5 minutes, deploy by hand.

**4. Wait until /api/version shows the merge commit.**

```
cd ~/dev/vicdata_public && M=$(git rev-parse --short=12 HEAD) && until curl -s https://vicdata.co.uk/api/version | grep -q "\"commit\":\"$M\""; do echo "waiting for $M"; sleep 30; done && curl -s https://vicdata.co.uk/api/version
```

**5. Republish:** none this round. No published dashboard changed (`src/catalogue/dashboards` is untouched; the dumbbell is a draft dataview off every rail).

**6. Set fixed:** none this round (no feedback items).

**7. Live check** — on vicdata.co.uk, in each theme (the switch is in the nav):

- **A teacher at a two-phase school** (Leighton Park 110110: View as… → Teacher, or a teacher account): first login opens the welcome → "Let's start" → setup lists GCSE and Post-16 subjects on one screen; tick two, watch each phase's count move → "Take me to my home" → two sections (GCSE green, Post-16 violet in Mid), three tiles each with real figures and an icon row → the GCSE "How many pupils take …?" arrow → six screens; check each answer against the full dashboard (Show me), "As a table", Next previewing the next question, "Here's what you found". Reload a home: no welcome. (In View as the welcome never shows: use a real teacher account for first login, or `delete from front_door_state where profile_id = …` for your own.)
- **An SMT member** (`/teacher/smt?lookAs=110110&as=smt&peek=1` for the dashboards; View as for the home): the orange home with Overview, Academic, Pupils, Context; the Overview walk draws the dashboard's own views (School now, Scorecard, Roll indexed, Results trend, Market share, Flags).
- **A head-office user** (View as… → Harris Federation head office): the orange field with bronze buttons, four group dashboard cards, Our schools (each opens that school's SMT, read-only), Also here; the Schools walk's first screen, then Show me.
- **An Admissions lead** (View as… → Admissions at Leighton Park): the sky home, the Entry point picker (11+ / 16+), the pool and share figures; the Pipelines walk (Entry point now, Pipeline, Map of feeders, Pool trends, Your cohort).
- **Every dashboard:** shut panels read as raised bars (Teacher's accordion; a closed Admissions or SMT row); SMT is orange, Post-16 violet; the Group pages bronze. A dashboard in Mid draws Dark.
- **The strip:** after step 1's entries pass their date (1 Dec), a later visit shows "New since your last visit" once.
