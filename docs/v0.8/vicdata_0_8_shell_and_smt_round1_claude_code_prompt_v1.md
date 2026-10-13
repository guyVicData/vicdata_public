# VicData 0.8 — The shared shell, then SMT round 1 (Overview and Academic, the SMT home)

Claude Code build prompt, written 13 Oct 2026, for the app repo (`~/dev/vicdata_public`). Two parts, in order: **Part A extracts the shared shell** (no visible change), **Part B builds SMT round 1 on it**. Part B starts only if Part A's parity is clean.

## Read first, in full

- **The spec:** `docs/v0.8/vicdata_one_dashboard_ux_smt_and_groups_spec_v1.md`: §1 (the shared shell table and the rule "a view is a catalogue entry plus a component"), §2 (SMT: focus chips §2.2, the four dashboards §2.3, the SMT home, access §2.4), §4 (build order), §5 (answered and open).
- **The wireframes:** `docs/wireframes/smt/` (canvas "VicData SMT dashboards"). **Build them pixel-perfect, in both themes, from the app's real tokens and components.** The hexes are illustrative; SMT's accent is `ROLE_ACCENT.smt`.

  | Board | What |
  |---|---|
  | `Main` | Overview (The Chase): column 1 "The school now"; large view Scorecard · Map · Flags; row 2 trends; the "Compared against" menu drawn open; the Edit · View as… footer |
  | `Academic` | Academic (GCSE → Sciences): the level chips with the subject-area second row; large view Subject areas · Subjects · Value added · Grade profile; row 2 |
  | `LeightonLight` | Overview in light: an IGCSE school (GCSE chip marked, "not ranked" rows), boarding filter, Progress 8 "not published for independent schools" |
  | `Pupils`, `Context` | **Round 2, not this round.** Read them so the data layer and chips you build fit them |
  | `Phone` | 390: column 1, then the large view as tabs, then rows |
  | `Home` | The SMT home cards |
- **Admissions round 3 report** (`docs/v0.7/admissions_r3_report_v1.md`): F1 (`CardBox`, `PanelIconRow`, the fixed icon order, notes behind the caption button), F4 (one nav, control bar and edit bar), F5 (View as). SMT reuses all of it.
- **The editor stages 1–2 report** (`docs/v0.7/admissions_editor_s1_2_report_v1.md`) and the catalogue (`src/catalogue/`): how Admissions' views became catalogue entries with R-* rules.
- **The year rules** (`src/catalogue/years.ts`, `docs/v0.7/year_rules_report_v1.md`): SMT reads every year from there and from `academic_current_periods`, including "(provisional)". GCSE 2025/26 lands on Thursday; nothing in SMT may hard-code a year.

## Ground rules

- **Branch `v0.8-shell-smt-r1` from `main`.** Commit per stage, with tsc, eslint, build, unit tests, rule tests, the RLS test (111) and both parity harnesses (Teacher 2,875 pairs, Admissions 328) clean.
- **Never put a server key in client code.** Stage files by name; never `git commit -a`. Leave Guy's untracked or modified files alone (there are several in `docs/`).
- **Database changes are written and tested, never applied by you.** Apply commands are `&&` chains with the project-ref check (`lnhulykjlxmoneappnsp` for the app, `hrqrbvrrhlidpoybezhs` for production) and **no `exit`**. The app must work before and after any apply.
- **Long runs:** statement timeouts, progress logs, free ports for harness servers (check each server's folder before trusting a result).
- **Log calls** under "2026-10-xx — 0.8 shell + SMT r1" in `docs/OPEN_QUESTIONS.md`.
- **If the year-rules follow-ups round** (`docs/v0.7/vicdata_0_7_year_rules_followups_claude_code_prompt_v1.md`) merges to `main` while you work, rebase onto it and rerun parity before merging.

---

## Part A — Extract the shared shell (no visible change)

**Goal:** one set of parts that Teacher, Admissions, SMT and (later) the group view all import, so they can't drift.

1. **Move into `src/components/shell/`** (keep re-exports at the old paths so nothing else has to change in this round):
   - the nav (`TeacherNav` and its pieces), the control bar (`ControlBar`, `GroupSwitcher`, the chip row and the filter pills), the edit bar / footer (Edit, View as…);
   - the grid: rows, row heads, the column-1 + large-view arrangement Admissions uses, and Teacher's three-column arrangement;
   - the panel: `CardBox`, `PanelIconRow`, `PanelFooter` (source, caption, private note, flag), `PanelMenu`, `PillMenu`, `TeacherModal` / full screen;
   - the phone layout (column 1, the large view as tabs, then rows).
2. **Name the accent per product** in one place: Teacher by phase (`PHASE_ACCENT`), Admissions and SMT by role (`ROLE_ACCENT`), groups to come. The shell reads the accent from context; no product passes hexes.
3. **Admissions' wrapper** (`src/components/admissions/ui.tsx`'s `Panel`) stays a thin wrapper round the shell's `CardBox`, as round 3 left it.
4. **Parity is the test:** Teacher and the public page **byte-identical**; Admissions **byte-identical** to its own harness. Any difference stops Part A; fix it, don't explain it.
5. **A short shell README** (`src/components/shell/README.md`): what each part is, the icon order, how a product supplies its chips, filters, accent and dashboards.

**Commit and stop here if anything in Part A isn't clean.** Report what failed; don't start Part B.

---

## Part B — SMT round 1: Overview, Academic and the SMT home

### B1 — Routes, roles and the dashboard group

- **Routes:** `/teacher/smt` (Overview) and `/teacher/smt/academic`, behind the existing role check: SMT and School-Admin; platform admins through View as, read-only. Governors already map to SMT (`roles.ts`: `head_governor: "smt"`); **governors see exactly the SMT view** (Guy, 13 Oct). No new RLS.
- **The dashboard group** in the catalogue (`src/catalogue/dashboards/smt.ts`), beside `teacher.ts` and `admissions.ts`: Overview · Academic now; Pupils and Context registered as "coming" so the switch shows four (greyed, not clickable) or two, whichever the editor already supports cleanly; log the choice.
- **The badge:** "S", the title "SMT — {school}", the switch in `GroupSwitcher`'s slot, all from the shell.

### B2 — The level chips (spec §2.2), built as Teacher's subject chips and Admissions' entry-point chips

- **The same chip component**, in the same slot, one chip selected, held in the URL (`?level=`), remembered per user (as Teacher remembers its subject).
- **Row 1:** Whole school (default) · Primary · GCSE · Post-16, **only the phases the school has** (from the census phases, as the public page's Roll by phase decides them).
- **An IGCSE school** (the existing rule that excludes it from GCSE comparison, e.g. Leighton Park 110110, Sevenoaks 118952): the GCSE chip is shown, marked (dashed, with the reason in its tooltip), and every GCSE view says why it has no comparison. Never zeroes.
- **Subject areas sit under a phase:** choosing GCSE or Post-16 shows a second, lighter row from `subject_family_map` (only the areas the school enters), "All areas" selected by default. Whole school and Primary have no second row.
- **No labels** before the chips (Admissions r3 removed "Entry point"; follow that).
- **Filters stay as pills:** Gender (mixed schools only); Day + boarding (boarding schools only, the r3 `isBoardingSchool` rule). Phase is never a pill.
- **Every view follows the level.** A view that can't show the level says so in its own space (e.g. "Value added isn't published for KS2"); it never disappears.

### B3 — "Compared against": Teacher's comparison sets, as a default VicData function

- The control bar's **"Compared against"** pill is Teacher's `PillMenu`: the selected set; "Edit this set…"; "Change comparison…", opening Teacher's `ComparatorSetChooser` hub (10 nearest, schools in the LA, my saved sets, the school's sets, regional and national rankings). **No new chooser.**
- **One set drives the whole SMT dashboard.** Saved sets are the same sets Teacher uses (same tables, same RLS).
- **Level-aware ranks:** at GCSE the set ranks only its schools with GCSE results, and the count says so ("7th of 10 with GCSE results").
- **`?set=`** works as it does from r2b, so SMT can deep-link into Teacher's subject explorer with the same set.

### B4 — Data: what SMT round 1 reads (audit first, build the gaps)

**Audit before building,** and write the audit into the report: for each Overview and Academic panel, the table or route it reads, whether it exists, its years, and its coverage (state / independent / IGCSE / FE). Reuse before building:
- roll, phases, girls/boys, day/boarding: the census lookups the public page and Admissions already use;
- XS–XL: `sizeBadgeForValue` and the school page's Roll by phase;
- headline results and ranks: 0.6.6's whole-population ranking and the headline snapshot (Attainment 8, grade 5+ English and maths, A-level points per entry, KS2 where published);
- value added: A-level VA by qualification type (2023/24, 2024/25), subject A-level VA (`dfe_ks5_subject_value_added`), Progress 8 (to 2023/24 only; **not published for 2024/25 or 2025/26**, and never for independents: say which reason applies);
- subject areas: Admissions' strengths and weaknesses view, against the comparison set instead of rivals;
- grade profile: Teacher's grade bands;
- market share at 11+: Admissions' figures, read-only (empty state with the reason where the school has no Admissions lists).

**New server routes only where nothing serves the figure,** under `/api/smt/*`, computed in the database or on the server, never in the browser. Pupil-weighting and set ranks follow the existing ranking function.

### B5 — The views (catalogue entries + components, inside the shell)

Every view is a **catalogue entry plus a component**, with R-* rules and tests, as Admissions' were. If a view needs a new piece of chrome, stop and report.

**Overview**
- **Column 1, "The school now":** roll and change since 2019/20; girls · boys; Attainment 8 and A-level points per entry with national ranks; A-level VA; Progress 8 tile with the right "not published" reason; size by phase XS–XL. For a boarding school, day · boarding (Leighton Park board).
- **Large view rail:**
  - **Scorecard** (default): each headline against the comparison set, the region and England, with change since 2022/23 (from `years.ts`), the counts behind each rank, "not ranked" rows for IGCSE, and the flags line;
  - **Map:** the school and its comparison set (Teacher's map component);
  - **Flags:** Admissions-style flags on the school itself (roll falling three years; results rising or falling faster than the set; entry cohort shrinking). Thresholds in one constants file, as Admissions'.
- **Row 2:** roll indexed to 100 against the LA and England; headline results trend against the set (middle-half band, 2021/22 shaded with the note); market share at 11+ from Admissions (read-only, "Open in Admissions").

**Academic** (top-down)
- **Column 1:** the level's headlines (Whole school: both phases; GCSE: entries, average grade, grade 7+, rank in set; Post-16: points per entry, rank, A-level VA), value added in its own block with honest wording, grade profile.
- **Large view rail:** Subject areas (strengths and weaknesses against the set) · Subjects (the area's subjects with ranks, "Since 2022/23", and "Subject explorer →" carrying `?set=`) · Value added (A-level VA by qualification type and by subject; Progress 8 where published) · Grade profile (Teacher's grade bands).
- **Row 2:** the level's results trend against the set; **"Results by band" as a reserved panel** with the caption "Arrives with the results-by-band round" (roadmap step 4) — the panel slot exists, the data doesn't yet; entries mix (change in entries counts from the first year, per the year rules).

**Panel chrome on every panel:** the shell's `CardBox` (menu ⋯ with Print this graph and Copy this view…; full screen; the reserved collapse slot), the footer (source "i", "What this shows", private note, flag). Honesty lines live behind the caption button, from one notes file, **`SMT_NOTES`**, locked by rules like `ADMISSIONS_NOTES`.

**Edit and View as:** the page registers the SMT dashboard in view (`useInPlaceEdit`), so the platform admin's Edit opens the shared editor in place, with the school as the live preview; the footer shows Edit · View as… to platform admins only.

**Meetings:** Copy this view… works for every SMT panel (meeting slides), as in Teacher.

### B6 — The SMT home (the `Home` board)

The existing role home with the SMT lens: name, school, the role switch (only for people with more than one role), "What would you like to look at?", then the cards:
1. **The school** (new): the SMT dashboards as shortcut chips (Overview · Academic live; Pupils · Context shown as coming), and a one-line summary from the Overview figures (roll change, the headline rank, the number of flags);
2. **Admissions** (existing `AdmissionsTile`, read-only for SMT);
3. **My dashboards** (existing `LibraryTile`);
4. **Recruitment**, **Meetings** (existing cards).

Replace `KeyDashboardsEmpty` for the SMT lens; Teacher's and Admissions' homes stay byte-identical.

### B7 — The usage log (small, so data starts accruing before launch)

From `docs/v0.8/vicdata_usage_tracking_note_v1.md`, **steps 1–2 only, no screens**:
1. **An event table** in the app database (migration written and tested, not applied): who (membership id and role, or `null` for the public), the school whose data was shown (URN), product, dashboard, view, level, set kind, and time. **Insert-only from the server**; no client reads; RLS denies anon and members everything except the server role. Log a page view of every Teacher, Admissions and SMT dashboard, and opening a view in full screen.
2. **Public school page counts:** a server-side counter per URN per day, no cookies, no personal data.

No reporting UI in this round. Log the privacy wording that the terms and privacy notice will need.

### B8 — Tests, parity and the report

- **Rule tests** for every new view (data years from `years.ts`; IGCSE wording; Progress 8 reasons; boarding-only filters; level-aware set counts).
- **Parity:** Teacher, the public page and Admissions byte-identical to `main` (Part A already proved the shell); the Teacher and Admissions homes byte-identical.
- **Screenshots** (`docs/v0.8/shell_smt_r1_screenshots/`): The Chase and Leighton Park, Overview and Academic, both themes, 1440 and 390; the SMT home; the Compared against menu; one full-screen panel; the level chips at GCSE with Sciences.
- **Report:** `docs/v0.8/shell_smt_r1_report_v1.md`: Part A's move list and parity; the B4 audit table; each view and its rules; the usage log migration and its apply command; logged calls; anything that differs from the wireframes and why.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.8-shell-smt-r1 -m "0.8 Shared shell; SMT round 1: Overview, Academic, SMT home, usage log" && npm run build && git push
```

**Stop before merging** if Part A isn't byte-identical, if any existing page changes, or if anything needs RLS beyond the usage table. If a push fails, give Guy the command (he pushes over HTTPS).
