# VicData 0.8: the shared shell, then SMT round 1 (Overview, Academic, the SMT home, the usage log)

Branch `v0.8-shell-smt-r1`, from `main` (`5057e15`). Prompt: `docs/v0.8/vicdata_0_8_shell_and_smt_round1_claude_code_prompt_v1.md`. Calls are logged under "2026-10-13 — 0.8 shell + SMT r1" in `docs/OPEN_QUESTIONS.md`.

| Part | Commit | What |
|---|---|---|
| A | `135c290` | The shared shell, `src/components/shell/`. No visible change: Teacher 2,875 / 2,875 and Admissions 328 / 328 identical; the public page's SSR identical. |
| B | (this commit) | SMT Overview and Academic, the SMT home card, the usage log (migration written and tested, **not applied**), rules and tests, screenshots, this report. |

**Database:** one migration, `supabase/migrations/20261109090000_v08_usage_log.sql`, written and tested locally, not applied (apply below). An optional re-seed puts the SMT dashboards in the `dashboards` table, which the editor needs before Edit can save them (apply below). Nothing else. No new RLS beyond the usage tables.

## Checks

| Check | Result |
|---|---|
| tsc | clean |
| eslint | 0 errors; the same 2 warnings as `main` |
| build | clean; new routes `/teacher/smt`, `/teacher/smt/academic`, `/api/smt/{school,overview,academic}`, `/api/usage` |
| Unit tests | **404 / 404** (395 before; 9 new in `src/lib/smt/smt.test.ts`) |
| Rule tests | **72 PASS, 0 FAIL** (52 before, plus 20 R-SMT rules, each with a real-data runner). Every pre-existing rule's output is line for line as before. One exception: in the full run, R-ADM-BOARDING-ONLY-WHERE-BOARDERS errored twice on a database statement timeout (a cold national read, not an assertion). `main`'s tree passed it next, and on the branch it then passed |
| RLS test | **111 / 111** |
| Usage log test (new) | **19 / 19** (`supabase/tests/v08_usage_log_pglite.mjs`, output in `.out`) |
| Teacher parity | **2,875 / 2,875 identical**, unmasked, every case set; negative control caught |
| Admissions parity | **328 / 328 identical**, pixels and DOM, 592 panel-views |
| Public page SSR | **identical** (137625, 117037) |
| Teacher and Admissions homes | **20 / 20 identical**, DOM and pixels (teacher, multi-role and School-Admin members; Teacher and Admissions lenses; both themes; 1440 and 390) |
| Server keys in client bundles | none (`.next/static` searched for the service-role and reference keys) |

---

## Part A: the shared shell

**What moved** (each old path is now a re-export stub, so nothing else had to change):

| Shell file | From | What |
|---|---|---|
| `TeacherNav.tsx` | `teacher/` | the nav |
| `TeacherChrome.tsx` | `teacher/` | the theme toggle (the nav imports it) |
| `ControlBar.tsx` | `teacher/` | the control bar, its chip row and its slots |
| `GroupSwitcher.tsx` | `dashboard-config/ConfigDashboard.tsx` | the dashboard switch |
| `FilterPills.tsx` | `admissions/ui.tsx`, `controls.tsx` | `FChip`, `MenuChip`, `EntryChip` |
| `PillMenu.tsx` | `teacher/` | the pill with a menu ("Compared against") |
| `EditSwitch.tsx` | `edit-mode/` | the footer's Edit · View as… |
| `DashboardGrid.tsx`, `DashboardColumn.tsx` | `teacher/` | Teacher's three columns |
| `Rows.tsx` | `admissions/AdmissionsDashboard.tsx`, `controls.tsx` | `ShellPage`, `ShellRow`, `RowHead`, `PhoneStack`: Admissions' column 1 + large view rows and the phone stack |
| `CardBox.tsx`, `PanelIconRow.tsx`, `PanelFooter.tsx`, `PanelMenu.tsx`, `TeacherModal.tsx`, `PanelIcons.tsx` | `teacher/` | the panel, the icon row, the footer, the menus, full screen, the glyphs |
| `RailPanel.tsx` | `admissions/ui.tsx` | the panel with a tag line, a span and a rail; `Tabs` on a phone. Admissions' `Panel` is now a thin wrapper round it. |
| `accent.ts` | (new) | each product's accent in one place: Teacher by phase, Admissions and SMT by role |
| `README.md` | (new) | what each part is, the icon order, what a product supplies |

**The accent** is set once per product on its page root (`accentVars(productAccent(...))`), and every shell part reads `var(--accent)`. Teacher's three accent sites, the custom dashboard screen and Admissions now go through it, with the same values.

**Parity** (Part A, `135c290`, against `main`):

- **Teacher:** 2,874 / 2,875 identical on the first run.
  - The one flagged pair was `rk-137625-nat-pending`'s column-1 Trends map: Leaflet's fit timing, the same pair as in the editor round.
  - A rerun of its case set gave **229 / 229 identical**.
  - Public page SSR identical; negative control caught.
- **Admissions:** **328 / 328** identical, pixels and DOM, 592 panel-views.
- **Rule tests:** 52 / 52, output identical to the last round's line for line.
- **CSS:** the branch's Tailwind CSS has one extra class, `translate-x-0`, picked up from Guy's untracked docs in `docs/` (Tailwind scans them). No element uses it.

---

## Part B: SMT round 1

### B1: routes, roles, the dashboard group

- **Routes.**
  - `/teacher/smt` is Overview; `/teacher/smt/academic` is Academic.
  - Access: SMT (governors hold the SMT role), the School-Admin, and platform admins through View as, read-only.
  - The gate is `src/lib/smt/auth.ts` on the server; the page asks the same through `src/components/smt/member.ts`. Teachers see "The SMT dashboards are for the school's SMT, its governors and its School-Admin."
- **The group.**
  - `src/catalogue/dashboards/smt.ts` defines `vicdata.smt.overview` and `vicdata.smt.academic`, with Admissions' layout: column 1 plus one large view spanning columns 2–3, then three row-2 panels.
  - Pupils and Context are registered as coming (`SMT_COMING`). **The switch shows two dashboards.** Neither the editor nor the switcher has a "coming" state, and one would be new chrome (logged).
- **The bar.** The "S" badge, "SMT — {school}" and the switch are all the shell's.

### B2: the level chips

- **Row 1** is `ControlBar`'s chip row, in the subject chips' slot: Whole school, then only the phases the school has, from its census bands as the school page's Roll by phase decides them.
- **No ±, no label.** The bar's new optional `noEdit` drops the ±; nothing is drawn before the chips.
- **An IGCSE school's GCSE chip** is drawn dashed, with a ring and the reason as its tooltip (`marked`, new and optional). It can still be chosen, and every GCSE view then says why it has nothing to compare.
- **Row 2** is the bar's new optional `subRow`, a lighter row under the first. It appears under GCSE or Post-16 only, with All areas first and then the areas the school entered.
  - These are the data's eight families (Sciences & Maths, Languages & Literature, …), not the spec's illustrative list (logged).
- **The level is held in the address** (`?level=gcse&area=sciences_maths`) and remembered per school in this browser. A level the school can't show falls back to Whole school or All areas (R-SMT-LEVEL-CHIPS).
- **Filters are pills, only where they apply:** Gender for a mixed school, Day + boarding for a boarding school (`pillsFor`, R-SMT-BOARDING-ONLY).
  - They filter the roll figures.
  - Results aren't split either way, and Academic says so when a filter is on.

### B3: Compared against

- **The pill is Teacher's `PillMenu`.** It holds the set and its size, then "Edit this set…", then "Change comparison…", which opens Teacher's `ComparatorSetChooser` unchanged.
- **Sets are resolved Teacher's way.** `/api/teacher/chooser-set` handles the nearest ten, lists and rankings, and saved sets come from `/api/teacher/saved-comparator-sets` (the same tables, the same RLS). SMT adds no chooser.
- **One set drives the dashboard.** It's chosen in the school's main exam phase (GCSE; an IGCSE school's is Post-16).
- **Ranks are level-aware.** Only the set's schools with that result are ranked, and the count says so: "2 of 11 · 10 nearest schools with GCSE results".
- **The deep link.** The subject explorer link carries `?set=` (up to 30 schools) and `&setLabel=`, so Teacher opens on the same set under its name. Teacher is unchanged without the label.

### B4: the data audit

Every figure is read through an existing function. **The new server code assembles; it computes no new measure.**

| Panel | Reads | Exists? | Years | Coverage |
|---|---|---|---|---|
| Roll, change, girls · boys, day · boarding | `dfe_school_census` (`buildRollTrend`), `smtSchool` | yes | 2019/20–2025/26 census | every school with a census (state and independent); FE colleges have none |
| Phases (the chips) | census bands, as Roll by phase | yes | latest census | as above |
| XS–XL by phase | `age_band_pupil_distributions` + `sizeByBand` (the school page's) | yes | latest census | as above |
| Attainment 8, grade 5+ E&M, A-level points, KS2 RWM | `academic_headline_snapshot` / `dfe_ks2_attainment`, 0.6.6 ranks (`rankIn`, `englandSchools`) via `src/lib/smt/population.ts` | yes (grade 5+ E&M is `engmath_95_percent`, newly read) | 2021/22–2024/25 (latest from the data) | state and independent; IGCSE schools not ranked at GCSE; KS2 thin for independents |
| Set ranks | the set's schools' figures (`setPlace`) | new arithmetic over existing reads | as above | the set's schools with the figure |
| A-level value added by qualification type | headline snapshot `{A level, Academic, Applied general, Tech level}::value_added` + intervals + banding | **in the data, no read before**; now read | 2023/24, 2024/25 | every school with A levels |
| Subject A-level value added | `dfe_ks5_subject_value_added` (`fetchSubjectLevelDataForSchools`) | yes (read before, not drawn) | 2023/24, 2024/25 | as above |
| Progress 8 | headline snapshot `progress8_average` + intervals | **in the data, no read before**; now read | 2021/22–2023/24 | state schools only; none for 2024/25 or 2025/26 (no KS2 baseline); never independents |
| Subject areas against the set | Admissions' `buildRivals(urn, entry, { rivals: set })` | yes | latest and 2022/23 | GCSE and Post-16; areas with at least 10 entries |
| Subjects | `fetchSubjectLevelDataForSchools` (entries) and Teacher's `subjectRanking` (average, set and England ranks) | yes | latest and 2022/23 | GCSE (9-1) and every Post-16 qualification; 5+ entries to be ranked |
| Grade profile | the school's grade rows (Teacher's) | yes | latest | the main qualification (GCSE (9-1), GCE A level) |
| Roll indexed vs LA and England | `age_profile_aggregates` (ages 5–15) + `indexTo` | yes; **no whole-roll LA series exists**, so the area lines are pupils aged 5–15, said so | 2019/20–2025/26 | mainstream schools |
| Results trend, set's middle half | headline snapshot + `percentile` | new arithmetic over existing reads | 2021/22–2024/25 | as the headline |
| Market share at 11+ | Admissions' `buildMarketShare` with the school's saved 11+ rivals | yes | 2019/20–2025/26 | only where Admissions has saved rivals at 11+; otherwise empty, with the reason |
| Flags | Admissions' `losingPupils`, `entryYearShrinking` and thresholds; SMT's results-against-the-set (`src/lib/smt/flags.ts`) | new rule over existing functions | latest 2–3 years | as the figures |
| Entries mix | the school's subject entries | yes | the years the modern sources hold (2023/24, 2024/25) | GCSE and Post-16 |

**New server routes:**
- `GET /api/smt/school`
- `POST /api/smt/overview` and `POST /api/smt/academic`, which take the set as URNs, as `/api/teacher/chooser-set` does.

Everything is computed on the server and cached for an hour for public data.

### B5: the views

Each view is a catalogue entry (`src/catalogue/smt.ts`: 4 measures, 12 renderers, 20 dataviews and their presets, appended after Teacher's and Admissions') plus a component in `src/components/smt/views/`, inside the shell.

| View | Component | Rules |
|---|---|---|
| Overview · The school now | `Now.tsx` | R-SMT-VIEW-NOW, R-SMT-P8-REASON, R-SMT-BOARDING-ONLY |
| Overview · Scorecard (default) | `Scorecard.tsx` | R-SMT-VIEW-SCORECARD, R-SMT-SET-RANKS, R-SMT-IGCSE-WORDING, R-TREND-FROM-2223 |
| Overview · Map | `SetMap.tsx` | R-SMT-VIEW-MAP |
| Overview · Flags | `Flags.tsx` | R-SMT-FLAGS |
| Overview · Roll indexed (+ table) | `Lines.tsx`, `Tables.tsx` | R-SMT-VIEW-TRENDS |
| Overview · Results against the set (+ table) | `Lines.tsx`, `Tables.tsx` | R-SMT-VIEW-TRENDS, R-TREND-FROM-2223, R-IGCSE-EXCL |
| Overview · Market share at 11+ (+ table) | `Lines.tsx`, `Tables.tsx` | R-SMT-VIEW-TRENDS, R-ADM-GROUP-SHARE |
| Academic · The level now | `AcademicNow.tsx` | R-SMT-VIEW-ACADEMIC-NOW, R-SMT-P8-REASON, R-SMT-VA-HONEST |
| Academic · Subject areas (default; Subjects once an area is chosen) | `Areas.tsx` | R-SMT-VIEW-AREAS, R-ADM-FLAG-STRENGTHS, R-SMT-SET-RANKS |
| Academic · Subjects | `Subjects.tsx` | R-SMT-VIEW-SUBJECTS, R-SMT-SMALL-ENTRIES |
| Academic · Value added | `ValueAdded.tsx` | R-SMT-VA-HONEST, R-SMT-P8-REASON |
| Academic · Grade profile | `Grades.tsx` | R-SMT-VIEW-GRADES |
| Academic · Results trend (+ table) | `Lines.tsx`, `Tables.tsx` | R-SMT-VIEW-TRENDS |
| Academic · Results by band (reserved) | `Reserved.tsx` | R-SMT-VIEW-RESERVED |
| Academic · Entries mix (+ table) | `Mix.tsx`, `Tables.tsx` | R-SMT-VIEW-MIX |

**Across the views:**
- **Rules everywhere:** R-SMT-LEVEL-CHIPS, R-SMT-YEARS (every year from the data or `years.ts`) and R-SMT-NOTES (every caveat from `SMT_NOTES`, in `src/catalogue/notes.ts`).
- **Every panel is a shell `RailPanel`.** It has the ⋯ menu (Print this graph, Copy this view… to meeting slides), full screen as a focus mode with the level chips, the reserved collapse slot, and the footer's source "i" and caption button.
- **Meetings:** a copied SMT view draws on its slide from the SMT routes (`SmtViewPreview`, added to `liveSlotRenderer`).
- **Edit:** the page registers its dashboard with `useInPlaceEdit`. The shared editor opens in place, with every SMT panel previewing live (`SmtViewPreview` in `LivePanelPreview`). It needs the seeded `dashboards` row.
- **Phone:** column 1, then the large view with its views as tabs, then row 2 as tabs of one panel.

**Two things worth knowing:**
- **The years are rehearsed.** With last round's synthetic GCSE 2025/26 (`scripts/year-rehearsal/`, provisional), SMT's GCSE rows move to 2025/26 and Post-16's stay at 2024/25. R-SMT-YEARS runs this in a child process every time. It also checks that no SMT source line holds a year literal; it found one, the scorecard caption's "2022", now `TREND_BASE_PERIOD`.
- **Subjects match the subject explorer.** SMT uses Teacher's own `subjectRanking`, so Biology at The Chase reads 6.81, 2nd of 11, 905th of 3,391 in England, as Teacher shows it.

### B6: the SMT home

The SMT lens of the role home opens on **The school**. It shows Overview and Academic as chips, Pupils and Context dashed as coming, and a summary line from the Overview's own figures ("Roll ▲ 16% since 2019/20 · Attainment 8 2 of 11 · 1 flag").

Then come Admissions (the existing tile), Dashboards, Recruitment and Meetings. This replaces `KeyDashboardsEmpty` for SMT only. **The Teacher and Admissions homes are byte-identical** (20 / 20 pairs).

### B7: the usage log

**The migration** (`20261109090000_v08_usage_log.sql`; not applied):
- **`usage_events`** records who (membership and role, or `platform_admin`), whose data (URN), the product, event (`page_view` or `fullscreen`), dashboard, view, level, set kind and time.
- **`public_page_daily_views`** keeps one count per school per day, written only through `count_public_page_view(urn)`.
- **Locked down:** RLS is on with no policy. anon and authenticated hold no privilege on either table and can't call the function; only the service role writes. The local test checks all of it (19 / 19).

**The app works before and after the apply.** Every write is fire-and-forget and ignores a missing table.

**Members:**
- Teacher, Admissions and SMT log a page view per dashboard, school, level and set kind. `CardBox` logs a full-screen open wherever the page set a usage scope.
- `/api/usage` takes the membership and role from the session, never from the browser.
- View as is never logged.

**The public page:** counted in the proxy after the response (`event.waitUntil`), so the page is unchanged. No cookie; no IP, user agent or anything else about the visitor is kept. Prefetches and self-declared bots aren't counted.

**No reporting UI in this round.** The privacy wording the terms and notice will need is in `OPEN_QUESTIONS.md`.

**Apply** (Guy; it has no effect on anything until applied):
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && supabase db query --linked -f supabase/migrations/20261109090000_v08_usage_log.sql && supabase migration repair --status applied 20261109090000 --linked
```

**Re-seed (optional, for Edit on SMT).** This adds the SMT group, the two dashboards, their first versions and their assignment to the SMT role. Teacher's and Admissions' configs are unchanged, so they get no new versions:
```
cd ~/dev/vicdata_public && git checkout main && git pull && test "$(cat supabase/.temp/project-ref)" = "lnhulykjlxmoneappnsp" && npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/vicdata_seed.sql && supabase db query --linked -f /tmp/vicdata_seed.sql
```

---

## Differences from the wireframes, and why

- **The switch shows Overview · Academic.** Pupils and Context aren't shown greyed, because the editor and the switcher have no "coming" state (see B1). The home card shows them as coming.
- **The subject area chips are the data's families:** Sciences & Maths, Languages & Literature, and so on. There's no separate English or Maths area in the data.
- **The Map is the shared Leaflet map** (`ConsortiumMap`, as Admissions' maps), not Teacher's `RankingsMap`, which needs full academic profiles per school.
- **The roll's LA and England lines are pupils aged 5–15,** not whole rolls, because no per-year LA whole-roll series exists. The caption says so.
- **Market share at 11+** reads "The Admissions lead hasn't chosen rivals at 11+ yet" where Admissions has no saved rivals, as the prompt asks. The wireframe draws the line.
- **The Academic large view opens on Subject areas.** It switches to Subjects once an area is chosen, as the wireframe's Sciences board shows.
- **The wireframe's "[Further functions]" slot** on the home isn't drawn, because nothing is named for it yet.
- **The size rows** read "Senior" and "16+" as the wireframe does. Their hovers are the school page's own captions.

## Screenshots

These are in `docs/v0.8/shell_smt_r1_screenshots/`. The harness draws the built components in headless Chrome on real data from the routes' own functions, with the real Tailwind CSS:
- `{chase,leighton}_{overview,academic}_{dark,light}_{1440,390}.png`: The Chase and Leighton Park, both dashboards, both themes, both widths.
- `chase_academic_gcse_sciences_{dark,light}_1440.png`: the level chips at GCSE with Sciences & Maths.
- `smt_home_{dark,light}_390.png`: the SMT home.
- `compared_against_menu_dark_1440.png`: the Compared against menu.
- `fullscreen_scorecard_dark_1440.png`: one panel in full screen.
- `smt_editor_overview_dark_1440.png`: the shared editor on SMT Overview, with the seeded row.

## Click-through for Guy

After Render's "Deploy live", hard-refresh. Nothing has to be applied for the pages; apply the usage migration to start logging, and the seed to edit SMT.

1. **As yourself:** go to `/teacher/smt`. A platform admin with no SMT role sees "use View as" and the button.
2. **View as The Chase, SMT** (or your own SMT membership): Overview.
   - Column 1 reads 1,449, ▲ 16% since 2019/20.
   - The Scorecard shows Attainment 8 at 2 of 11, 897 of 4,736, +2.5 pts.
   - The flag reads "GCSE results rising faster than the set".
   - Row 2 has the indexed roll, the results band, and market share (or its reason).
3. **Compared against → Change comparison…** opens Teacher's chooser. Pick "schools in the LA" and every rank re-counts.
4. **Academic → GCSE → Sciences & Maths:** the subjects table. "Subject explorer →" opens Teacher's GCSE dashboard on the same set, named.
5. **View as Leighton Park:** the GCSE chip is dashed and its tooltip says why. GCSE rows read "IGCSE · not ranked", Progress 8 reads "Not published for independent schools", and "Day + boarding" is in the bar.
6. **Home, SMT lens:** The school card, with its summary line.
7. **After the seed:** Edit opens the editor on SMT Overview with live previews.
8. **After the migration:** open a dashboard and a panel in full screen, then check `select * from usage_events order by id desc limit 5` with the service role.
