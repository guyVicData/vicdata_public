# VicData 0.6, night 2 build report (S3b, S4–S7)

Branch `v0.6`, pushed to `origin/v0.6`. Nothing was merged or pushed to `main`. Every stage is its own commit (or a few), each with tsc, eslint (no new problems) and `next build` clean. The final tree passes:
- `tsc --noEmit`, `next build`, and eslint on all 150+ files changed tonight (0 problems);
- the unit tests, 142/142 (`npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`);
- the real-data rule tests, 9 PASS / 0 FAIL (`npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`), where night 1 had 7 / 1;
- the four PGlite database test files (51 + 20 + 16 + 35 checks), plus all six 0.6 migrations applied in order on one PGlite instance.

Read with `docs/OPEN_QUESTIONS.md`: the night-2 entries for S6, S5, the integration pass, and S3b/S4/S7/E/titles.

## For you first

1. **Five database changes are written and tested locally, but not applied** (as agreed, decision 11). In order:
   ```
   # S2, if not applied yet (night-1 report), then its seed:
   supabase db query --linked -f supabase/migrations/20261103100000_v06_s2_dashboards.sql
   supabase migration repair --status applied 20261103100000 --linked
   npx -y tsx scripts/dashboards-seed-sql.ts > /tmp/seed.sql && supabase db query --linked -f /tmp/seed.sql
   # Night 2:
   supabase db query --linked -f supabase/migrations/20261104090000_v06_membership_insert_hardening.sql
   supabase migration repair --status applied 20261104090000 --linked
   supabase db query --linked -f supabase/migrations/20261104100000_v06_s4_view_requests.sql
   supabase migration repair --status applied 20261104100000 --linked
   supabase db query --linked -f supabase/migrations/20261104110000_v06_s7_meetings_migration.sql
   supabase migration repair --status applied 20261104110000 --linked
   supabase db query --linked -f supabase/migrations/20261104130000_v06_s6_dashboard_icons.sql
   supabase migration repair --status applied 20261104130000 --linked
   ```
   - The meetings migration needs S2 first. It copies today's meeting into the new format and leaves the old tables alone.
   - Until S2 is applied, these screens say so plainly and work from the configs seeded in code: the editor, library, meetings and Copy this view. Nothing breaks.
2. **Deliberate figure changes** (your S3b decisions): before/after tables for named schools below.
3. **Two deliberate wording changes on the live, unflagged dashboards:**
   - "% change" on points and rates becomes "change in points" / "change in percentage points" (fix 3b);
   - the Results switcher's "Average point score" becomes "Average points", as decided in the catalogue doc (C3) but not done before. The strings are in commit 78291b8.

   Apart from these and the S3b fixes, flag-off renders exactly as before (32/32 pixel-identical, below).
4. **New limits on custom dashboards, encoded and shown in the UI** (you may want to lift them):
   - one phase per dashboard;
   - one of Candidates or Results per dashboard, because the page's derivation reads one shared Candidates/Results setting;
   - each kind of column once;
   - Rolls and Live births show placeholders only.

   A custom dashboard also has no subject picker yet; it follows your first ticked subject.

## S3b — fixes from your decisions

| # | Fix | Commit | Status |
|---|---|---|---|
| 1 | **Membership insert hardening** as a migration. PGlite reproduces the hole first, then proves it closed. `join_school` still works and ignores the client's role. | ca58593 | Written, not applied |
| 2 | **`.maybeSingle()` at 2+ member schools:** the 3 pages you named, plus `/teacher/recruitment`, the Data View shell, and every membership-gated API route (31). Those routes would all have answered 502 at a school with a second member. | d2216bc, 2c84a1a | PGlite: the old query returns 2 rows; the fixed ones return the right one; a non-member still sees none |
| 3a | **R-POINTS-SAME-QUAL:** points per qualification family, "All subjects" filtered, a note says why | d369af1 | Figures change (table) |
| 3b | **Honest number types:** Change in points / Change in percentage points | 582e8a7 | Figures change (table) |
| 3c | **R-FOCUS-NEVER-FILTERED:** an AS/AEA focus counts itself in | 1192c2f | Figures change (table) |
| 4 | **R-IB-NONSUBJECT:** the ingest repo's own list, ported once to `NON_SUBJECT_ROWS` | bd1ec45 | Rule test passes |
| 5 | **Old testing school switcher retired** (route and `/account` UI) | 9d0b81b | Done; the two env vars can go |
| 6 | **Light-theme band** below short content | 03a3321 | Done; checked headless in both themes × both OS schemes |

**Sevenoaks (118952) finding:** yes, the picker showed them. "Learning Skills", "Study Skills" and "Baccalaureate", 244 entries each, were the subject list's top three, in onboarding step 2 and quick edit. Godolphin and Latymer (100369) showed the same three, 26 each. Knock-on: Sevenoaks' Context on A*–E now covers 0 years instead of 2, because only the IB Core rows had A–E grades.

**Nothing outside each fix moved.** 80,784 real-data scenarios were compared across eight school-phases: 100053 and 117037 at GCSE and Post-16, plus 130432, 118952, 100369 and 130448 at Post-16.
- 3a: every difference is Post-16 Context on points.
- 3c: every difference has an AS or AEA focus.
- 4: the six school-phases without those rows are all equal.
- 3b: every change figure on entries is identical.

The harness and probes are in `docs/v0.6/audit_scripts/s3b_fixes/`.

### Before/after, named schools

**3a — R-POINTS-SAME-QUAL** (commit d369af1): Post-16 Context points keep to one qualification family.

| School | URN | Phase | Subject (focus) | View | Before | After |
|---|---|---|---|---|---|---|
| Croydon College | 130432 | Post-16 | Computer Science (A level) | Context, All subjects: group average; drawn | 24.7; 55 | 25.6; 20 |
| Croydon College | 130432 | Post-16 | Computer Science (A level) | Context, Subject category: group average | 7.0 | 7.0 |
| Croydon College | 130432 | Post-16 | Business Studies (BTEC Ext. Cert.) | Context, All subjects: group average; drawn | 24.7; 55 | 22.9; 35 |
| Croydon College | 130432 | Post-16 | Business Studies (BTEC Ext. Cert.) | Context, Subject category: group average | 26.2 | 26.1 |
| Croydon College | 130432 | Post-16 | Business Studies member value, A-level focus | Context group value | 24.12 (A level + 5 BTECs) | 26.36 (A level) |
| Croydon College | 130432 | Post-16 | Psychology member value, A-level focus | Context group value | 20.18 (A level + 2 BTECs) | 18.33 (A level) |
| The King's School Worcester | 117037 | Post-16 | Mathematics (A level) | Context, All subjects: group average; drawn | 43.1; 21 | 43.1; 21 |
| The King's School Worcester | 117037 | Post-16 | Mathematics (A level) | Context, Subject category: group average | 44.9 | 44.9 |
| Godolphin and Latymer | 100369 | Post-16 | Chemistry (IB Higher level) | Context, All subjects: group average; drawn | 52.4; 32 | 52.4; 14 |
| Godolphin and Latymer | 100369 | Post-16 | Chemistry (IB Higher level) | Context, Subject category: group average | 49.1 | 51.2 |
| Godolphin and Latymer | 100369 | Post-16 | Mathematics (A level) | Context, All subjects: group average; drawn | 52.4; 32 | 52.6; 18 |
| Godolphin and Latymer | 100369 | Post-16 | Mathematics (A level) | Context, Subject category: group average | 52.4 | 51.8 |
| South Thames Colleges Group | 130448 | Post-16 | Psychology (A level) | Context, All subjects: group average; drawn | 25.7; 36 | 28.0; 5 |
| South Thames Colleges Group | 130448 | Post-16 | Psychology (A level) | Context, Subject category: group average | 23.7 | 26.7 |

**3c — R-FOCUS-NEVER-FILTERED** (1192c2f): a focused AS or AEA item counts itself into its own Context group.

| School | URN | Phase | Subject (focus) | View | Before | After |
|---|---|---|---|---|---|---|
| Croydon College | 130432 | Post-16 | Law (AS only, 8 entries) | Context, All subjects, Candidates | not a member; total 1,229; share 0.7%; avg 30.7 | member; total 1,237; share 0.6%; avg 30.2 |
| Croydon College | 130432 | Post-16 | Law (AS only) | Context, Subject category, Candidates | total —; share —; avg — | total 8; share 100%; avg 8.0 |
| Croydon College | 130432 | Post-16 | Economics (AS only, 2) | Context, All subjects, Candidates | not a member; total 1,229; share 0.2%; avg 30.7 | member; total 1,231; share 0.2%; avg 30.0 |
| South Thames Colleges Group | 130448 | Post-16 | Further Maths (AS only, 1) | Context, All subjects, Candidates | not a member; total 1,260; avg 42.0 | member; total 1,261; avg 40.7 |
| Acland Burghley School | 100053 | Post-16 | Psychology (AS, beside A level) | Context, Subject category, Candidates | total 19; share 5.3%; avg 19.0 | total 20; share 5.0%; avg 20.0 |
| Acland Burghley School | 100053 | Post-16 | Psychology (AS, beside A level) | Context, All subjects, Candidates | total 336; share 0.3% | total 337; share 0.3% |

**4 — R-IB-NONSUBJECT** (bd1ec45): the IB Diploma total and IB Core rows leave the subject list.

| School | URN | Phase | Subject | View | Before | After |
|---|---|---|---|---|---|---|
| Sevenoaks School | 118952 | Post-16 | (all) | Subject list / picker IB tab: items | 32 | 29 |
| Sevenoaks School | 118952 | Post-16 | (all) | Subject list: top three | Learning Skills, Study Skills, Baccalaureate (244 each) | Untranslated Literature, Other Languages, Mathematical Studies |
| Sevenoaks School | 118952 | Post-16 | Chemistry (IB HL) | Column 1 Candidates: rank of N subjects at school | N = 32 | N = 29 |
| Sevenoaks School | 118952 | Post-16 | Chemistry (IB HL) | Context on A*-E rate: years covered | 2 (from the IB Core rows' A-E grades) | 0 (no IB subject has an A*-E rate) |
| Sevenoaks School | 118952 | Post-16 | Chemistry (IB HL) | Context, All subjects, Candidates: total; share; drawn | 1,443; 6.9%; 29 | 1,443; 6.9%; 29 (unchanged) |
| Godolphin and Latymer | 100369 | Post-16 | (all) | Subject list: items; IB tab | 50; 26 | 47; 23 |
| Godolphin and Latymer | 100369 | Post-16 | Chemistry (IB HL) | Column 1 Candidates: rank of N subjects at school | N = 50 | N = 47 |
| Godolphin and Latymer | 100369 | Post-16 | Chemistry (IB HL) | Context, All subjects, Candidates: total; share | 471; 1.5% | 471; 1.5% (unchanged) |

**3b — honest number types** (582e8a7): change on points and rates is no longer a % change.

| School | URN | Phase | Subject | View | Before | After |
|---|---|---|---|---|---|---|
| Acland Burghley School | 100053 | GCSE | Maths (General) | Context, Subject category, Average point score: change list title; focus; group | % change; −1%; +10% | change in points; 0.0; +0.7 |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Comparisons, Average point score: this school's change | −1% | 0.0 |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Context Trend summary | ...a 1% change | ...a change of 0.0 points |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Context, Subject category, Grade 4+ rate: title; focus; group | % change; −1%; −1% | change in percentage points; −1pp; −1pp |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Comparisons, Grade 4+ rate: this school's change | −1% | −1pp |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Context Trend summary (Grade 4+) | ...a 1% change | ...a change of 1 percentage point |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Context, Candidates: title; focus; group (count: unchanged) | % change; +2%; −7% | % change; +2%; −7% |
| Acland Burghley School | 100053 | GCSE | Maths (General) | Comparisons, Candidates (count: unchanged) | +2% | +2% |
| The King's School Worcester | 117037 | Post-16 | Mathematics (A level) | Context, All subjects, Average point score: title; focus; group | % change; −15%; −6% | change in points; −7.4; −3.0 |
| The King's School Worcester | 117037 | Post-16 | Mathematics (A level) | Comparisons, Average point score: this school's change | −15% | −7.4 |
| The King's School Worcester | 117037 | Post-16 | Mathematics (A level) | Context Trend summary | ...a 15% fall | ...a fall of 7.4 points |
| Croydon College | 130432 | Post-16 | Sociology (A level) | Context, All subjects, Average point score: title; focus; group | % change; +3%; −0% | change in points; +0.8; 0.0 |
| Croydon College | 130432 | Post-16 | Sociology (A level) | Comparisons, Average point score: this school's change | −5% | −1.2 |

## What's built

- **S4, Add a view** (`src/components/chooser-v06/`; try it at `/platform/chooser-lab`):
  - opens on Pick, pre-filled from the panel, with familiar views first, live previews where there's a school, warning tags, and the Either grouping;
  - Browse VicData dashboards, with overrides marked;
  - Customise (Numbers limited to honest types, roll forward, fork and back);
  - the empty state with loosening counts, Ask for this view (`view_requests`), and Add a placeholder for super-admin;
  - Steps 1–2, grouped as drawn, reusing the onboarding subject picker and the comparator chooser.
- **S5, Editor** (`/dashboards/[id]/edit`, `/dashboards/new`, super-admin):
  - the edit bar, columns with F5 revalidation, rows with structures and settings, the panel menu, the F3 span question, whole-unit spans;
  - placeholders, Skeleton, Ready to swap in, Export planned views (markdown);
  - draft autosave, Publish as immutable versions, History (preview, restore, compare), undo of 30 steps;
  - Assign with the Key toggle, and the "Updated — what's changed" line.
- **S6:**
  - the library (`/dashboards`);
  - role homes on `/teacher` (with the flag on), with the role switch only for multi-role people;
  - icons from a view, the set or an upload (Storage bucket + RLS);
  - Copy this view to a dashboard (slot map, fit check) or a meeting (the slide re-arranges), opened from the panel's Export menu under the flag.
- **S7, Meetings** (`/teacher/meetings`, `/teacher/meetings/[id]`):
  - slides at the real panel unit on a 1536 × 864 canvas, scaled as a whole (decision 7);
  - the MeetingPlay behaviours plus drag and drop, undo;
  - live pinned slots with keep-live;
  - Present, Grid, PDF (A4 landscape);
  - auto-archive the day after, read-only archive, Reuse for next meeting;
  - the migration of today's meeting;
  - the old page is retired, and its tables are kept.
- **E, views outside the page:**
  - `TeacherDashboard` (the page body as a component; `page.tsx` is now a wrapper);
  - rail subsets under a config;
  - `/dashboards/[id]` for stored dashboards;
  - live meeting slots and live Pick and editor previews;
  - **fetch de-duplication** (decision 10): a 5-minute in-memory cache, so a three-slot slide for one school fetches each route once.
- **Integration:**
  - Copy this view from live panels;
  - an Edit link (super-admin) from the flagged Teacher page and `/dashboards/[id]`;
  - the linked-dashboard switcher on `/dashboards/[id]`;
  - a meeting's Add a view opens the chooser at step 1.

## Live site untouched, and parity

Checked with the headless harness from night 1: the real page, real data fixtures, pixel-diffed. The schools were Acland Burghley (100053, state) and The King's School Worcester (117037, independent), in GCSE and Post-16, Candidates and Results, at 1280 and 390, in dark and light.

- **Flag off, the final tree against the tree right after the S3b fixes** (2c84a1a, before the renderer refactor): 32/32 identical. So the refactor, the editor, the library and meetings change nothing on the live pages. Two timing artefacts in Context appeared on the first run and re-shot identical (3/3), as in night 1.
- **Flag off vs flag on at 1280: 16/16 identical** for a non-admin. A super-admin sees one extra element, the Edit link.
- **Phone:** flag on differs only by the column tabs, as night 1.
- **The live-renderer parity runs** were redone on a clean port after an editor harness server was found holding the old one. The numbers above are from the clean run.

## Screens compared with their boards

Each was screenshotted headless at the board's width, in both themes, side by side with the board. A selection is in `docs/v0.6/night2_screenshots/`; the rest are in the session scratchpad.

| Stage | Boards compared | Result |
|---|---|---|
| S4 | Ch3Pick, Ch3Adjust, Ch3Empty, PickEither, Ch1Data, Ch2Focus, Ch2Subject, Ch2Custom, plus Browse | Structure, order and copy match. Deliberate: thumbnails at the real panel shape, theme colours, real warning tags |
| S5 | Editor, History, Skeleton (1280); RowSettings, ColumnChange, SpanAsk, Assign, New1–4 (390) | Match. Deliberate: real panel unit (the Editor's two rows no longer fit 1120px), "Publish" not "Save", real tokens |
| S6 | Main, HomeSMT, Icon, CopyTo, CopyToMeeting | Match. Deliberate: Copy-to slots at the board's 44px height (one constant switches it), "+ New dashboard" for super-admin only |
| S7 | Meeting, MeetingPlay, MeetingsArchive | Match in structure. Slots are taller than drawn, because the boards used the old unit (decision 7) |

`int-editor-live-previews.png` was taken before one fix: the editor's live previews drew a whole card inside the editor panel. They now draw the figure only (2aeb805). That fix hasn't been re-screenshotted.

## Simplifications made without you

- **Custom dashboards are composed from the three existing column kinds,** with the limits listed under "For you first".
- **A pinned meeting slot honours its year only on Context's Current panel**, the only view with a year control. Other pinned slots show the latest data and log it.
- **Customise's choices are stored with the view** (number type, years, look, title, roll forward), but the hosts draw only the number types they already support. Honest types the host doesn't draw are dotted in Numbers, not offered.
- **"Choose other schools…" is off in the editor and meeting choosers**, because they have no saved-sets payload yet. The Teacher page's own comparator chooser is unchanged.
- **Placeholders live only in the dashboard config;** "Ask for this view" requests go to `view_requests`.
- **Role homes and Copy this view appear only with the flag on.** With the flag off, `/teacher` and every panel's Export menu are as today.
- **Linked groups are kept in the config.** The editor doesn't write `dashboards.group_id`, because the store has no group calls yet.

## Click-through list, by board

The flag is off by default. Add `?renderer=config` to see the new Teacher renderer; the `/dashboards`, `/platform/*` and `/teacher/meetings` screens are new and need no flag. Apply the migrations first for anything that saves.

**Start a dashboard**
- **Main:** `/dashboards`, the Dashboards and Meetings tabs, owner and colour filters, "+ New dashboard" (super-admin).
- **New1 → New4:** `/dashboards/new`: name and start-from, layout preset and accordion, each column's data and compared-to, the summary, then Done, which lands in the editor.

**Add a view** (`/platform/chooser-lab`, or "+ Add a view" in an empty editor panel or meeting cell)
- **Ch3Pick:** the summary line and Change, familiar-first sections, rail icons, live previews, the "on GCSE Results, Comparisons" meta line, warning tags, Browse VicData dashboards. Then Add to panel.
- **PickEither:** a row set to Either groups the list into Latest year / Over time.
- **Ch3Adjust:** Customise: Numbers (dotted where not honest), Years, Look, title chips, roll forward; touching anything forks it, and Back to ready-made undoes that.
- **Ch3Empty:**
  - choose Rolls data: loosen with counts;
  - Ask for this view, as a non-super-admin;
  - Add a placeholder, as super-admin.
- **Ch1Data:** family cards, only one open, phase → measure → which result.
- **Ch2Focus:** "which part of school" with follow/always; the "Compare with something" switch and its sub-bands.
- **Ch2Subject:** the single-select subject picker.
- **Ch2Custom:** Custom area (super-admin only today).

**Edit** (`/dashboards/vicdata.ks4.candidates/edit`, or Edit on a flagged Teacher page)
- **Editor:**
  - the edit bar: History, Settings, Rename, Assign, Save as, Publish, Exit;
  - Edit column; the row bands; the panel ··· menu; drag a view in the rail; drag a span's edge; + Add row;
  - live previews (with a school).
- **RowSettings:** name, Time, structure, open by default.
- **ColumnChange:** change a column's data; keep as override / remove / swap for each view that no longer fits.
- **SpanAsk:** span a panel across two different columns; it asks once, with the left-most pre-picked.
- **Skeleton:** add placeholders; Export planned views (.md); Ready to swap in when a draft view matches.
- **History:** draft vs live; Preview a version; Restore (a new draft); Compare.
- **Assign:** roles (VicData) / teams (school) / mine; live; Key VicData dashboard.
- **Icon:** Settings → Icon: from a view, the set, or upload (super-admin).
- **CopyTo:** a panel's Export → Copy this view… → To a dashboard: the slot map and the fit check (follows the column, or "overridden"); Copy and stay / Copy and open.

**Meetings** (`/teacher/meetings`)
- **Meeting:**
  - open a meeting: the slide strip, title and speaker notes, the layout picker, + Add a view (the chooser at step 1), + Text box;
  - Present (arrows, Esc), Grid view, Export PDF;
  - a slot's fullscreen inside the scaled slide.
- **MeetingPlay:** select, swap, move to previous/next slide, add slide, layouts, suggested titles, shuffle, undo/redo, and drag and drop between slots and slides.
- **CopyToMeeting:** a panel's Copy this view… → To a meeting: the last used is pre-picked, pick a slide, and it re-arranges (1 → 2 across → 3 across → 3 × 2).
- **MeetingsArchive:** a meeting dated yesterday moves to Archive, read-only but presentable; Reuse for next meeting, with "move views on to the latest data".

**Homes and admin**
- **HomeSMT:** give yourself SMT + Teacher in People, then `/teacher?renderer=config`. The role switch shows; the SMT lens has an empty key-dashboards tile. A single-role Teacher sees no switch.
- **People, Teams, Platform:** as in night 1. The old testing switcher is gone from `/account`.

**Phone**
- **PhoneDash:** `/teacher/ks4?renderer=config` at phone width shows the columns as tabs.

**Rule fixes to eyeball**
- Croydon College (130432), Post-16, Context, All subjects, Average points: 20 subjects, not 55, with the family note.
- The King's School Worcester (117037), Post-16 Maths: the change list reads −7.4 (points), not −15%.
- Sevenoaks (118952): the subject picker has no Learning Skills, Study Skills or Baccalaureate.

**Needs your eyes** (headless can't do these honestly):
- real drag and drop;
- Present in true browser fullscreen;
- the PDF print;
- autosave and Publish against the database;
- the meetings migration on "Autumn governors";
- an actual copy and an upload;
- switching roles with a real multi-role account;
- the light-theme cyan Dashboards tile;
- a slot's fullscreen inside a scaled slide.
