# VicData 0.8 front door, part 2 of 3: guided sets, school admin and phone

A Claude Code prompt for the app repo (`~/dev/vicdata_public`) and the app database (`lnhulykjlxmoneappnsp`). Written 13 Nov 2026 from Guy's decisions, 9–13 Nov, made on the design canvas "VicData walkthroughs — GCSE mockup". The decision records are in the project: `claude/vicdata_walkthroughs_decisions_v1.md` and `claude/vicdata_beta_access_and_security_decisions_v1.md`. Where this prompt and those records differ, this prompt wins.

**The 0.8 front door is built in three parts, in this order:** Part 1 theme, homes and walks; Part 2 guided sets, school admin and phone; Part 3 sign-in, the beta gate and account security (written now, run only after Guy has reviewed Parts 1 and 2). They were split on 13 Nov from one prompt (`vicdata_0_8_front_door_claude_code_prompt_v1.md`, now superseded). Decision numbers (A1–F29) are that prompt's, kept so the records still line up; a decision another part owns is named, never built, here.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each one ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## Why

A teacher shown the GCSE dashboards found the information "incredible" but the interface threw him: the multi-panel layout, open/closed rows, the small rail icons. What worked was the onboarding's last screen: simple questions that made sense. He expected each to be a button.

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**. Five pieces, built together:

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**.

**This part:** Admissions and SMT edit their feeders, rivals and comparison sets on one friendly screen; the sets library uses colour where it carries meaning; the School-Admin gets a plain account page and a membership page (no payments yet); and every new screen from Parts 1 and 2 gets its designed phone layout.

**Not in this part:** the beta gate, landing page, sign-in changes, device codes, the device cap, "Where you're signed in", the admin's Sign-ins and devices page (F27) and joining on the school's email domain (Part 3).

**Design files:** `docs/v0.8/front_door_design/` (moved there from the top-level `walkthroughs_design_inbox/` in Part 1). Its `README.md` maps every screen to a PNG (`png/`) and its source board (`dc/*.dc.html`). They are design references (layout, wording, colour, behaviour), not code to port. **Every figure, school name and date in them is illustrative.** Use real data everywhere.

**Before you start:** check that `main` holds Part 1 (the Mid theme, the homes, the walk shell, `docs/v0.8/front_door_design/`). If it doesn't, stop and say so in the report: this part builds on it.

## The decisions (Guy, 9–13 Nov)

### D. Guided sets

21. **Admissions and SMT reach their sets from a card on their home:** Admissions, e.g. "18 feeders · 9 rivals at 11+ — Who feeds us, and who do we compete with?"; SMT, e.g. "4 comparison sets — Who do we measure ourselves against?". The card opens the guided editor. The round-1 library (`/sets`, `SetsLibrary.tsx`, `SetEditor.tsx`, `SetView.tsx`, `SetSelector.tsx`) stays for power users, and the set menus' Edit still opens the round-1 editor (log whether it should open the guided one instead).
22. **The guided editor: one screen** (`sets_editor_feeders.png`, `sets_editor_rivals.png`), Dark/Light, the role's colour as accent:
    - **Title = the question:** "Who feeds us at [entry point]?" / "Who do we compete with at [entry point]?" / SMT "Who do we measure ourselves against?", one line of explanation; set name and entry point (or phase) as chips.
    - **Map** centred on the school with 5/10/15 km rings (reuse the existing map component): set members solid, main feeders / close rivals larger and labelled, suggestions dashed; hovering a suggestion offers "+ [name]" to add straight from the map; a "Suggest within N km" slider.
    - **Right column, in this order:** **"In your set"** (tick, Remove, a "Main" or "Close" tag, "Mark main feeders" / "Mark close rivals"), then **"Add schools"**. For a new, empty set, "Add schools" comes first.
    - **"Add schools":** a full-width **search box** ("Search any school in England by name, town or postcode"; reuse `SchoolSearch`), then **filter chips** with counts, then suggestions nearest first with "+ Add":
      - Feeders: State · Independent · Primary · Junior · Prep · Has the entry year (e.g. Year 6 at 11+).
      - Rivals and SMT sets: Independent/State · Day · Boarding · Mixed · Girls · Boys · Similar size (a band around your roll).
      - Suggestions start pre-filtered to the school's own profile; the chips are always visible and one tap to undo; the map follows the chips.
    - **"This set now"**, live as you tick: schools; distance range and median; sector mix (feeders) or day/boarding mix (rivals); main feeders (feeders) or the rivals' average GCSE points against yours with the count that sit IGCSE (rivals; the same shared 40% IGCSE constant as Rivals' momentum, R-ADM-MOMENTUM-IGCSE). Cancel / Save set.
    - **Same model and permissions as round 1** (`saved_sets`-successor tables, curators by kind, tiers as `main`). Reuse the round-1 server library; build no second engine.
23. **The sets library uses colour where it carries meaning** (`sets_library.png`), on the plain page:
    - every set gets a **solid gradient icon tile in its maker's colour**, keeping the kind icon (bars / streams);
    - pinned sets as larger tiles with a coloured top strip;
    - "Made by" pills as solid gradients;
    - coloured markers in the sidebar plus a small "Who made it" key;
    - kind icons on the filter buttons; "+ New set" the one solid button.
    - **Maker colours now:** Default graphite; School (SMT/Admissions-curated compared-against) orange; Head office bronze; Admissions sky; Victoria Consultancy rose; Mine an outline in the person's own phase colour. (Round 1 had SMT violet and head office orange.)

### F. School admin

26. **The School-Admin gets a plain account page, not a mid-tone home** (`admin_account.png`), Dark/Light only, opened from the account menu: Join requests, People and roles, Teams, School sets, Head office sharing, Sign-ins and devices, Membership, each with a one-line summary and a badge when something is waiting ("3 new", "1 flag"). Each row opens today's page where one exists (`/teacher/people`, `/teacher/teams`, `/sets`, the group sharing page). The admin's home stays the home of their other role (today a School-Admin lands on the Teacher home).
    - **The account menu shows a badge** when something on this page is waiting, so an admin whose home belongs to another role still notices.
   - **Sign-ins and devices** (F27) is Part 3: leave its row out of the account page (no "coming soon" row) and log the seam. **Join requests** shows today's requests; the on-domain/off-domain "exception" badge arrives with Part 3.
28. **The membership page** (`membership.png`), plain, opened from the account page:
    - **Your plan:** name, price per month and per year, what's included (ticked chips: unlimited staff, the school's phases, the dashboards, walkthroughs, sets and meetings).
    - **Renewal:** date, "renews automatically", the amount and card it will charge, the reminder emails (14 and 3 days before), "Update card", "Cancel renewal".
    - **Who uses it:** people, active this month, roles, link to People and roles.
    - **Billing:** billing contact, card on file ("Visa ending 4417" style only), optional purchase order number, invoice address.
    - **Invoices:** period, amount, status, PDF.
    - **Other states:** a primary school; a school in a group ("Covered by [group]": no billing, the group's billing contact); **a pilot school** ("Pilot · free for 6 months, until [date]", the price it will be, and from month 4 a friendly "Add a card to keep VicData after [date]").
29. **Pricing (for the page's wording and the data model only; no payments are built):**
    - Secondary school: £10 a month, billed annually (£120 a year), unlimited staff, every role.
    - Primary school: £5 a month (£60 a year).
    - Groups: a group rate, then schools at £10 a month each with bulk discounts (rates not set: model them, don't hard-code).
    - **Pilot schools and groups in the beta: free for 6 months.** Pilots add their card during the free months, not at joining.
    - **Payments are not set up.** Build the membership record (plan, price, status: pilot / active / covered-by-group / lapsed, pilot end date, renewal date, billing contact, purchase order, invoice address, card summary nullable) and the page reading it. "Update card", "Cancel renewal" and invoice PDFs are visible but disabled with "Coming before the pilot ends". Never store card numbers; the future payment provider holds them. Seed every current school account as a pilot from its join date (Guy sets real dates).

## G. Phone

At phone width (the shell's 358 px card, viewports 360–430), every new surface has a designed phone layout using the shell's existing patterns (tabs, bottom sheets, full screen); no phone-only copies of logic.
- **Welcome, setup** (Part 1): single column; the subject list as full-width rows with 44 px hit areas.
- **Homes** (Part 1): tiles stack one per row; the walk icon row wraps under the question; the arrow stays on the right.
- **Walks** (Part 1): question and answer, then the chart full width; the rail becomes a horizontal scroll of named chips above the chart; the mini-map moves under the chart; Back/Next in a sticky bottom bar.
- **Guided editor:** the map collapses to a 220 px strip with an "Expand map" button; "In your set" and "Add schools" become two tabs; "This set now" and Save sit in a sticky bottom bar.
- **Admin account and membership:** single column of cards.
- The landing page and the sign-in screens get theirs in Part 3.
- Rule test **R-FRONT-DOOR-MOBILE:** at 390 px each new surface renders without horizontal scroll and every control has a 44 px hit area.

## Milestones (commit at each; stop cleanly where you must)

1. **Guided sets** (D21–D23), including pointing Part 1's home sets cards at the guided editor.
2. **School admin** (F26, F28–F29): the account page, the badge, the membership record and page.
3. **Phone layouts** (G) for Part 1's and this part's screens.
4. **The report.**

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- **R-GUIDED-SETS:** the editor saves through the round-1 library with the same permissions; chips filter suggestions and the map; "This set now" is exact for a known set; the IGCSE count uses the shared constant.
- **R-MEMBERSHIP:** each state renders from the record; no card number column exists; disabled payment actions say why.
- **R-ADMIN-BADGE:** the account menu shows the badge exactly when the account page has something waiting, and only to a School-Admin.
- **R-FRONT-DOOR-MOBILE** (G). (Parts 1 and 2's surfaces.)
- **R-THEME-MID-SCOPE** (Part 1) covers the new sets and admin pages: under Mid they render Dark.
- **The existing rules still pass.** Update any rule that names the round-1 SMT violet or head office orange maker colours. Log every rule retired or rewritten, with why.

## Ground rules

- **Branch `v0.8-front-door-2` from current `main`** (after Part 1 is merged), fetched over HTTPS. Use worktrees for parallel parts if they help.
- **These must be clean at every milestone:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; every PGlite suite (run as their headers say; `view-as-pages.test.ts` with `--test-force-exit`); every parity harness.
- **Allowed differences in parity:** the new routes and pages (guided editor, admin account, membership); the sets library's colours; phone layouts of the new screens. **Figures never change.**
- **No database writes.** Migrations are written and tested in PGlite, and Guy applies them. Give each migration's step with the `schema_migrations` insert, per the template in `docs/FEEDBACK.md`.
- **Name new migrations after the latest one on `main` and in the live history** (today `20261122090000`; the unmerged group-sets branch holds `20261121100000`). Check both before naming.
- **Never put a server key in client code.** Stage files by name. Don't push or merge.
- **Log every call** under "2026-11-13: front door, part 2" in `docs/OPEN_QUESTIONS.md`.
- **Stay inside this part.** Where this part's work meets another part's decision, leave a clean seam (a constant, a prop, a hidden row) and log it; don't build the other part's piece.

## Report

Write `docs/v0.8/front_door_2_report_v1.md`. Include:
- how far you got, milestone by milestone, and anything left;
- the new tables and RLS (membership), the pilot seed, and the migrations with Guy's apply steps;
- whether the set menus' Edit should open the guided editor (your recommendation);
- screenshots, desktop and phone (390 × 844), Dark and Light (Mid where it applies): the guided editor (feeders and rivals); the sets library; the admin account page; membership (pilot and active states); and the phone layouts of Part 1's welcome, setup, each home and one screen of each GCSE walk;
- every rule added, rewritten or retired; tests and parity;
- the seams left for Part 3;
- **Guy's commands, in the template's order,** ending with a walk-through for: an Admissions lead (home → guided feeders editor → save), an SMT member (home → comparison set), a School-Admin (account page → membership), and a teacher on a phone (home → one walk).
