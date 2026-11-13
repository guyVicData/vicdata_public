# VicData 0.8 front door, part 1 of 3: theme, homes and walkthroughs

A Claude Code prompt for the app repo (`~/dev/vicdata_public`) and the app database (`lnhulykjlxmoneappnsp`). Written 13 Nov 2026 from Guy's decisions, 9–13 Nov, made on the design canvas "VicData walkthroughs — GCSE mockup". The decision records are in the project: `claude/vicdata_walkthroughs_decisions_v1.md` and `claude/vicdata_beta_access_and_security_decisions_v1.md`. Where this prompt and those records differ, this prompt wins.

**The 0.8 front door is built in three parts, in this order:** Part 1 theme, homes and walks; Part 2 guided sets, school admin and phone; Part 3 sign-in, the beta gate and account security (written now, run only after Guy has reviewed Parts 1 and 2). They were split on 13 Nov from one prompt (`vicdata_0_8_front_door_claude_code_prompt_v1.md`, now superseded). Decision numbers (A1–F29) are that prompt's, kept so the records still line up; a decision another part owns is named, never built, here.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each one ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## Why

A teacher shown the GCSE dashboards found the information "incredible" but the interface threw him: the multi-panel layout, open/closed rows, the small rail icons. What worked was the onboarding's last screen: simple questions that made sense. He expected each to be a button.

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**. Five pieces, built together:

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**.

**This part:** every role lands on a home of plain question tiles; each question starts a full-screen walk that teaches the dashboard; a friendly mid-tone theme; clearer panel layering; new role colours; a welcome screen, a one-screen setup and a "New since your last visit" strip leading into the home.

**Not in this part:** the beta gate, landing page, noindex rules and account security (Part 3); guided sets, the School-Admin account and membership pages, and the designed phone layouts (Part 2). Until Part 2, every new screen must still work at phone width (no horizontal scroll, nothing cut off), without its designed phone layout.

**Design files:** the folder `walkthroughs_design_inbox/` is at the top level of the repo, `~/dev/vicdata_public/walkthroughs_design_inbox/` (no dot in front of the name; already committed on `main`). **Move it** (`git mv`, not copy) to `docs/v0.8/front_door_design/` on your branch and commit that move first; Parts 2 and 3 read it there. Its `README.md` maps every screen to a PNG (`png/`) and its source board (`dc/*.dc.html`). They are design references (layout, wording, colour, behaviour), not code to port. **Every figure, school name and date in them is illustrative.** Use real data everywhere.

## The decisions (Guy, 9–13 Nov)

### A. First visit (from Beta access)

5. **First login opens with a welcome screen.** One friendly full-screen page: what VicData is for, that this is a private beta and their feedback shapes it, and where the feedback button lives. Then setup, then home. Shown once per person.
6. **Setup is shorter.** Today (`TeacherDashboard.tsx`) it runs per phase in four steps: qualifications → subjects (live count) → results preview → the question screen. New:
   - **One screen, "Which subjects do you teach?"**, with qualifications as headings within the list (not a separate step) and **the live entry count kept**.
   - **Drop the results preview** (walks and home figures now do that job).
   - **The question screen becomes the home page** (section B).
   - A teacher at a school with both phases sees **GCSE and Post-16 lists on the one screen** and lands on a home with both sections ready. (Guy didn't confirm this; it's the working assumption. Log it.)
   - Roles without subjects (SMT, Admissions, head office, School-Admin) skip setup: welcome → home.
7. **Later logins: a slim "New since your last visit" strip** at the top of home: one line naming what's new, linking to a short changelog page. It shows only when an entry is newer than that person's last visit, and goes once seen. Entries are written by Guy (a small table, edited through the existing platform-admin pages or a seed file; your call, logged). An entry can credit feedback ("Your feedback on X led to this").
   - The welcome page names the private beta in words only; the landing page and the gate are Part 3.

### B. Homes and walkthroughs

8. **One home for everyone, of plain question tiles** (`/teacher`, `src/app/teacher/page.tsx`, and each role's home). It replaces onboarding Step 4 and is shown on every visit.
   - **Teacher:** a section per phase the school has (GCSE, Post-16; KS2 where the teacher view has it), each with its own subject switcher (for teachers of more than one subject), three question tiles, and "Open the full [phase] dashboard". Questions:
     - "How many pupils take [subject]?" / Post-16: "How many students take [subject] A level?"
     - "How well did they do?"
     - "How do we compare with schools nearby?" / Post-16: "…with sixth forms nearby?"
   - **SMT, head office, Admissions:** one card per dashboard, each a question (`home_smt.png`, `home_group.png`, `home_admissions.png`, `home_primary_smt.png`). Head office keeps "Our schools" (each opening that school's SMT home read-only, as today). Admissions keeps its entry-point picker. A primary school's SMT home has a "Key stage 2" chip and KS2 questions (Year 6 results, Reception places, births nearby), as drawn; where a KS2 view doesn't exist yet, the card says so in its own space rather than vanishing.
   - **"Also here"** band: Dashboards/Library, Meetings, and the role's extras, as today's homes have them.
   - **A person with more than one role** sees each role's section, stacked, with a thin dark gap between sections (10 px of page background).
9. **Home-hub tiles** (`home_*.png`):
   - Each tile leads with **a big figure** from real data, then the question: e.g. entries this year, average points, rank among the 10 nearest; for SMT the roll; for Admissions the pool and share. If a figure isn't available, show the question without one; never a placeholder number.
   - Under the question, **a row of round icons, one per screen of the walk**, using each view's rail icon, faded to the same pale tint and coloured glyph as the tile's top-left badge. The screen's name shows on hover (`title`) and in `aria-label`. On the same line, **the solid arrow button is the one key action.**
   - Tiles **lift on hover** (translateY −3 px, a longer softer shadow).
   - Near-white tiles with layered shading: a bright 1 px top edge, a hairline inner border, three stacked soft shadows (see `MidTeacher.dc.html` `SHADE`).
10. **"Hide walkthroughs" shrinks, never removes.** A "Show fewer questions" link on home and the same toggle in the account menu: "Open the full dashboard" becomes the big button and the questions drop to one line of text links beneath it. Same page shape for everyone.
11. **Each question starts a full-screen walk** (`walk_*.png`, `Main.dc.html`). A walk is a short story, not a panel played out: it pulls views from anywhere (Now, Trends, Context, Comparisons; Candidates and Results dashboards alike). **One rhythm for every walk:** this year → in context → over time → wider.
12. **The GCSE walks** (screen by screen as in `WALKS` in `Main.dc.html`):
    - **How many pupils take my subject?** (1) How many took it this year? (tiles, with last year) (2) How does it compare with the other subjects in its area? (3) And across the whole school? (the area picked out in its family colour) (4) Has that gone up or down? (5) Has it grown more than other subjects? (the dumbbell, decision 17) (6) Is the same thing happening nearby and nationally? (indexed: the 10 nearest, LA, England; region in the table only, as the dashboard does).
    - **How well did they do?** (1) What did they get this year? (2) How were the grades spread? (with England as ticks) (3) Against the other subjects in its area (4) Across the whole school (5) Are results going up or down? (unpublished years dotted and labelled) (6) Nearby and nationally. **Uses Average points throughout** (the only Results measure with LA and England figures).
    - **How do we compare with schools nearby?** (1) Which schools are nearby? (map, the 10 nearest offering the subject) (2) How many take it at each? (3) How did they do at each? (4) Where do we rank? (5) Has our position changed?
    - **Post-16:** the same three walks on the Post-16 views. **SMT, Admissions, head office:** one walk per home card, its screens as the card's icon row lists them (`home_smt.png`, `home_admissions.png`, `home_group.png`, `other_roles.png`). Build them as configuration (an ordered list of existing dataview IDs plus the question and answer template per screen), so a later round can let the editor change them. Where a role's walk needs a view that doesn't exist, leave that screen out and log it.
13. **Screen anatomy** (`walk_many_1.png`):
    - Header: close, the walk's icon and question, step dots, the subject·phase chip, "Step n of N".
    - **The screen's question large, and a one-line written answer generated from the data** (e.g. "84 pupils took Geography this year, 6 more than last year"). One template per view, honest about small numbers and missing years (start from the views' method and caption notes).
    - **The view as an enlarged dashboard panel:** 3 px accent bar; header = the column's icon, name and question; the pill that sets it; the row tag ("Current · Data 2024/25"); the panel's **own rail, same order, with names written out** (lit = this view; a table view switches in place; any other view opens the dashboard at that panel with that view picked); the chart titled with the view's own dashboard title; the note line (i).
    - **Mini-map** top right: the dashboard's 3×2 grid with column icons and this panel lit; "Show me" opens the dashboard there.
    - Footer: Back; Next previews the next question. The last screen ends on "Here's what you found": every answer with where it lives, then the other questions and the full dashboard.
14. **The walk teaches the dashboard: one vocabulary** (`vocabulary.png`). Same icons (COLUMN_ICON_PATHS; PanelIcons), same names, same colours, same pills, same column questions. **Every chart keyed:** title, a key for every colour and mark, axis caption with unit, direct end labels, gaps dotted and labelled.
15. **Line-chart labels are HTML over the plot, not SVG text** (end labels, ticks, year labels), so they always render; only the lines are SVG with `vector-effect: non-scaling-stroke`. (Guy saw labels vanish in the mockup until this was done.)
16. **Peer lines on walk charts: category shades + marker shapes.** On a chart of peers (e.g. the other Humanities subjects against Geography): the focus line is the accent; peers take shades of their category colour, light to dark, each with its own marker shape (square, triangle, diamond); direct end labels; keyed. Dashes stay reserved for averages, dotted for unpublished years; reference lines keep fixed colours (LA #3987e5, England #c98500, **10 nearest #d55181, new**). Up to about five peers. Use darker shades in light mode; never put the darkest category shade on a chart with England's amber.
17. **Many peers: a dumbbell, largest first** (`dumbbell.png`), new view **"Change (dumbbell)"**: one row per subject ordered by this year's entries; ring = first year, dot = latest, a bar between; the focus row tinted in the accent; same-category subjects in the category colour, others grey; a dashed school-average row last; change in pupils with ▲/▼ (no green/red). Build it as a dataview used by walk 1 step 5. **Do not add it to the dashboard's Context › Trends rail** in this round (still a proposal); log that it's ready to add.
   - **Sets cards on the Admissions and SMT homes (D21):** draw them in this part with their real counts, opening the round-1 library (`/sets`) for now; Part 2 points them at the guided editor.

### C. Theme, layering and colour

18. **A third theme, "Mid", for the homes and the walks.** The theme switch becomes Dark · Mid · Light (remembered per person, as today). **Dashboards, the sets pages and admin pages follow Dark or Light only;** in Mid they use Dark. (Guy leans to Mid on home and walks only, and wants to see it on dashboards later: log it as the next step.)
    - **Each part of the site has its own colour,** a two-stop gradient with a soft glow top-left and a faint darkening bottom-right (`MidSMT.dc.html` `vivid()`):

      | Part | Gradient | Glow |
      |---|---|---|
      | GCSE | #86E3AE → #1E9E5E | #4CD98A |
      | Post-16 | #C1B0FF → #7A5BEF | #A48CFF |
      | Top level: SMT, whole school, head office | #FFB74D → #F57C00 | #FF9F0A |
      | Admissions | #8BD8FB → #1596DB | #5AC8FA |

    - **Text on the colour is charcoal** (a deep tint of the hue, e.g. `oklch(0.25 0.06 h)`). White text fails contrast on these fields. Small text, keys and charts sit on the near-white tiles and plates.
    - **The header and the "Also here" band stay dark;** only the area you're working in takes the colour.
    - **Head office keeps the orange field with a deep bronze accent** (buttons, icon badges, tints: #8A5A2B, #7E4F24, tint #F3E6D8), so it reads as top level but is distinct from SMT.
    - **Charts in a walk sit on white plates in Mid;** inside the plate nothing changes except the peer-line ambers deepen, as in Light.
    - Check every text/background pair against WCAG AA (4.5:1 small, 3:1 large) and log the table.
19. **The panel layer ladder, in Dark and Light, on every dashboard.** Today open and shut panels share one tone (`--box-bg`), about 6% from the column (`--panel-bg`), so shut panels don't stand out. New rule: page → column → **open panel = a sunk well** (the chart's plate) and **shut panel = a raised bar** (a clear step lighter, a border, a soft shadow, a solid chevron, and its lead figure in the accent), so a shut panel reads as a button. Starting tokens (tune for contrast, log the final values):
    - Dark: page #08080a; column #141417 / border #222226; well #0b0b0d / #1f1f23; shut bar #24242a / #34343b + `0 1px 0 rgba(255,255,255,.05) inset, 0 2px 6px rgba(0,0,0,.45)`.
    - Light: page #e9e9ed; column #f6f6f8 / #dedee3; well #ffffff / #e2e2e7; shut bar #ffffff / #cfcfd6 + `0 1px 2px rgba(20,20,30,.10), 0 3px 8px rgba(20,20,30,.08)`.

    This is the round's one deliberate change to every dashboard's pixels: say so in the parity report.
20. **Role colours change** (`src/lib/teacher-view-theme.ts` and the `--set-*` tokens in `globals.css`):
    - **SMT becomes the top-level orange** (today #a78bfa, the same violet as Post-16). Use the group orange family (#fb923c in Dark; a contrast-checked darker value in Light).
    - **Head office becomes deep bronze** as its accent (dark and light values contrast-checked), set apart from SMT.
    - Post-16 keeps violet. GCSE keeps green. Admissions keeps cyan/sky.
    - Update everywhere these accents are read (the shell, homes, set creator colours, `GroupHome.tsx`'s tiles). Log every file touched.

## Milestones (commit at each; stop cleanly where you must)

1. **Design files moved** (the `git mv` above), on its own commit.
2. **Theme, layering and colour** (C18–C20): the Mid theme tokens, the ladder on every dashboard, SMT orange, head office bronze.
3. **Homes** (B8–B10) for Teacher, SMT, primary SMT, head office, Admissions; the multi-role stack; hide walkthroughs.
4. **First visit** (A5–A7): welcome, the one-screen setup, the changelog strip and page.
5. **Walks** (B11–B17): the walk shell, the GCSE walks, then Post-16, then SMT, Admissions, head office; the answer templates; the dumbbell view; peer lines; HTML labels.
6. **The report.**

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- **R-WELCOME-ONCE** and **R-SETUP-ONE-SCREEN:** welcome shows once; setup is one screen with the live count; both phases on it at a two-phase school; roles without subjects skip it.
- **R-WHATS-NEW:** the strip shows for an entry newer than the last visit and not after it's seen.
- **R-HOME-TILES:** every home tile has a question, a real figure or none, an icon row matching its walk's screens, and one arrow action.
- **R-WALK-RHYTHM:** each walk's screens exist, in order, open real views, and have an answer sentence; Results walks use Average points; region never appears as a line.
- **R-WALK-KEYS:** every walk chart has a key entry for every colour and mark; line labels are HTML.
- **R-DUMBBELL:** order by latest entries; focus row tinted; school-average row last; change matches the data.
- **R-THEME-MID-SCOPE:** Mid applies to homes and walks; dashboards, sets and admin pages render Dark under Mid.
- **R-THEME-CONTRAST:** every Mid text/background pair and the ladder's text pairs pass AA.
- **R-PANEL-LADDER:** shut panels differ from their column by at least the logged contrast step in Dark and Light.
- **R-ROLE-COLOURS:** SMT reads orange everywhere SMT's accent is used; head office reads bronze; Post-16 stays violet.
- **The existing rules still pass.** Update any rule that names the old Step 4 or SMT's violet. Log every rule retired or rewritten, with why.

## Ground rules

- **Branch `v0.8-front-door-1` from current `main`** (it already holds this prompt and the design files), fetched over HTTPS. Commit the design folder's move first. Use worktrees for parallel parts if they help.
- **These must be clean at every milestone:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; every PGlite suite (run as their headers say; `view-as-pages.test.ts` with `--test-force-exit`); every parity harness.
- **Allowed differences in parity:** the new routes and pages (homes, walks, welcome, setup, changelog); the old onboarding steps gone; the panel ladder (every dashboard); SMT and head office colours; the set creator colours; the theme switch. **Figures never change.**
- **No database writes.** Migrations are written and tested in PGlite, and Guy applies them. Give each migration's step with the `schema_migrations` insert, per the template in `docs/FEEDBACK.md`.
- **Name new migrations after the latest one on `main` and in the live history** (today `20261122090000`; the unmerged group-sets branch holds `20261121100000`). Check both before naming.
- **Never put a server key in client code.** Stage files by name. Don't push or merge.
- **Log every call** under "2026-11-13: front door, part 1" in `docs/OPEN_QUESTIONS.md`.
- **Stay inside this part.** Where this part's work meets another part's decision, leave a clean seam (a constant, a prop, a hidden row) and log it; don't build the other part's piece.

## Report

Write `docs/v0.8/front_door_1_report_v1.md`. Include:
- how far you got, milestone by milestone, and anything left;
- the new tables and RLS (welcome seen, last visit, changelog), and the migrations with Guy's apply steps;
- the final colour tokens and the contrast table;
- screenshots, desktop (and one phone check at 390 × 844 per screen, to show nothing breaks), Dark, Light and Mid where it applies: welcome; setup; each home; one screen of each GCSE walk; the dumbbell; a dashboard with the ladder (open and shut panels);
- every walk screen left out because its view doesn't exist yet;
- every rule added, rewritten or retired; tests and parity;
- the seams left for Parts 2 and 3;
- **Guy's commands, in the template's order,** ending with a walk-through for: a teacher at a two-phase school (first login → setup → home → one walk), an SMT member, a head-office user, and an Admissions lead (home → one walk).
