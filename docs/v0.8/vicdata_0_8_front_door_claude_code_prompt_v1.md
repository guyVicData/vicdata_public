# VicData 0.8: The friendly front door. Beta access, homes and walkthroughs, guided sets, account security, school admin

A Claude Code prompt for the app repo (`~/dev/vicdata_public`) and the app database (`lnhulykjlxmoneappnsp`). Written 13 Nov 2026 from Guy's decisions, 9–13 Nov, made on the design canvas "VicData walkthroughs — GCSE mockup". The decision records are in the project: `claude/vicdata_walkthroughs_decisions_v1.md` and `claude/vicdata_beta_access_and_security_decisions_v1.md`. Where this prompt and those records differ, this prompt wins.

**This runs as one straight-through build, unattended.** Work through the milestones in order. Each one ends in a commit, with tests and parity clean. If a milestone can't be finished cleanly, stop there, log why in the report, and leave the branch at the last clean milestone. Don't ask Guy anything: take the most reasonable reading, log the call in OPEN_QUESTIONS, and carry on.

## Why

A teacher shown the GCSE dashboards found the information "incredible" but the interface threw him: the multi-panel layout, open/closed rows, the small rail icons. What worked was the onboarding's last screen: simple questions that made sense. He expected each to be a button.

Guy wants VicData friendlier for staff who aren't stats-minded, and ready for **a few schools to see it in December and a private beta from January 2027**. Five pieces, built together:

1. **Beta access:** a private landing page instead of the sitewide password; school pages never indexed; a welcome screen and a shorter setup; a "New since your last visit" strip.
2. **Homes and walkthroughs:** every role lands on a home of plain question tiles; each question starts a full-screen walk that teaches the dashboard; a friendly mid-tone theme; clearer panel layering; new role colours.
3. **Guided sets:** Admissions and SMT edit their feeders, rivals and comparison sets on one friendly screen; the sets library uses colour where it carries meaning.
4. **Account security:** new-device codes, a device cap, "Where you're signed in", joining on the school's own email domain.
5. **School admin:** a plain account page and a membership page (no payments yet).

**Design files:** the folder `walkthroughs_design_inbox/` is at the top level of the repo, `~/dev/vicdata_public/walkthroughs_design_inbox/` (no dot in front of the name; already committed on `main`). **Move it** (`git mv`, not copy) to `docs/v0.8/front_door_design/` on your branch and commit that move first. Its `README.md` maps every screen to a PNG (`png/`) and its source board (`dc/*.dc.html`). They are design references (layout, wording, colour, behaviour), not code to port. **Every figure, school name and date in them is illustrative.** Use real data everywhere.

## The decisions (Guy, 9–13 Nov)

### A. Beta access

1. **A private-beta landing page replaces the sitewide password.** Today `src/proxy.ts` puts Basic Auth in front of every route. Replace it:
   - A visitor who isn't signed in can reach only: the landing page (`/`), `/login`, the auth callback and password-reset routes, `api/health`, `api/version`.
   - Everything else, including `/schools/...`, `/join/...` and `/sets...`, redirects to the landing page (API routes return 401).
   - The preview-access route (`api/testing/preview-session`, `docs/vicdata_phase3_agent_preview_access_*`) keeps working: it must now satisfy the signed-in check instead of the Basic Auth gate, with the same safety posture (off by default, secret-gated, fails closed).
   - Remove the Basic Auth code and its env vars from the gate; log any env var Guy can now delete.
2. **The landing page: logo, "Private beta", Sign in. Nothing else.** No school search, no school names, no description, no "request access", no Open Graph or Twitter metadata, no analytics or tracking scripts, a plain `<title>` ("VicData"), and `X-Robots-Tag: noindex, nofollow`.
3. **School pages are never indexed, whatever `ALLOW_INDEXING` says.** Today `src/app/robots.ts` and `layout.tsx` metadata follow one switch for the whole site.
   - Every school-specific route (`/schools/...`, `/join/...`, set pages, anything carrying a URN) **always** sends `X-Robots-Tag: noindex, nofollow` and page-level `robots: { index: false, follow: false }`, independent of `ALLOW_INDEXING`.
   - `sitemap.ts` never lists them; add a comment saying so and why.
   - **Do not** add `Disallow` rules for them in `robots.ts`: a crawler that can't fetch a page never sees its `noindex`, and the bare URL can still be listed.
4. **Sign-in stays email and password. No public sign-up.** Testers arrive by invitation (existing join and approval flows).
5. **First login opens with a welcome screen.** One friendly full-screen page: what VicData is for, that this is a private beta and their feedback shapes it, and where the feedback button lives. Then setup, then home. Shown once per person.
6. **Setup is shorter.** Today (`TeacherDashboard.tsx`) it runs per phase in four steps: qualifications → subjects (live count) → results preview → the question screen. New:
   - **One screen, "Which subjects do you teach?"**, with qualifications as headings within the list (not a separate step) and **the live entry count kept**.
   - **Drop the results preview** (walks and home figures now do that job).
   - **The question screen becomes the home page** (section B).
   - A teacher at a school with both phases sees **GCSE and Post-16 lists on the one screen** and lands on a home with both sections ready. (Guy didn't confirm this; it's the working assumption. Log it.)
   - Roles without subjects (SMT, Admissions, head office, School-Admin) skip setup: welcome → home.
7. **Later logins: a slim "New since your last visit" strip** at the top of home: one line naming what's new, linking to a short changelog page. It shows only when an entry is newer than that person's last visit, and goes once seen. Entries are written by Guy (a small table, edited through the existing platform-admin pages or a seed file; your call, logged). An entry can credit feedback ("Your feedback on X led to this").

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

### E. Account security

24. **New-device codes and a device cap, built now** (easy to troubleshoot with a few users; ready before parents arrive later, where password sharing will be endemic).
    - **A device VicData hasn't seen** asks for a 6-digit code sent to the account's email after the password. The device is then trusted for 60 days (a long-lived, httpOnly, signed device cookie). Use Supabase Auth's own email OTP or reauthentication to send the code if it can; if no route exists without a new email provider, build the flow behind a flag (`DEVICE_CODES=off` by default), log exactly what Guy needs to switch it on, and carry on.
    - **A cap on devices signed in at once,** per kind of account (staff: 3, in one config constant per account kind). Signing in on one more signs out the oldest, with a one-line notice on the next page.
    - **"Where you're signed in"** for the user (account page): device, browser, rough place (from IP, city level at most), last active, "Sign out" per device and "Sign out of all devices". The School-Admin sees the same for their staff (decision 27).
    - **A quiet alert to platform admins** (a row in the existing platform-admin area, no email) when one account is used from more than N places in 24 hours (constant, start at 4).
    - New tables with RLS: devices/sessions per profile; codes (hashed, short-lived, attempt-limited). No device binding beyond this.
25. **Joining a school needs an address on the school's own email domain,** with admin-approved exceptions.
    - Each school account holds its email domains (new table). The first School-Admin's domain seeds the list; the admin can add or remove domains (trust schools often use the trust's domain; GIAS gives the website, not the email domain).
    - A join request from an address outside the list is held as an **exception** for the School-Admin to approve or refuse explicitly (governors, consultants, staff on personal addresses), and shows as such in Join requests.
    - Existing members are unaffected.

### F. School admin

26. **The School-Admin gets a plain account page, not a mid-tone home** (`admin_account.png`), Dark/Light only, opened from the account menu: Join requests, People and roles, Teams, School sets, Head office sharing, Sign-ins and devices, Membership, each with a one-line summary and a badge when something is waiting ("3 new", "1 flag"). Each row opens today's page where one exists (`/teacher/people`, `/teacher/teams`, `/sets`, the group sharing page). The admin's home stays the home of their other role (today a School-Admin lands on the Teacher home).
    - **The account menu shows a badge** when something on this page is waiting, so an admin whose home belongs to another role still notices.
27. **Sign-ins and devices** (from decision 24) for the admin: their staff's devices, last active, "Sign out" per person; flagged accounts first.
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

## Milestones (commit at each; stop cleanly where you must)

1. **Beta access** (A1–A7): the gate, the landing page, noindex rules, welcome, the one-screen setup, the changelog strip.
2. **Account security** (E24–E25) and the admin's Sign-ins page (F27).
3. **Theme, layering and colour** (C18–C20): the Mid theme tokens, the ladder on every dashboard, SMT orange, head office bronze.
4. **Homes** (B8–B10) for Teacher, SMT, primary SMT, head office, Admissions; the multi-role stack; hide walkthroughs.
5. **Walks** (B11–B17): the walk shell, the GCSE walks, then Post-16, then SMT, Admissions, head office; the answer templates; the dumbbell view; peer lines; HTML labels.
6. **Guided sets** (D21–D23).
7. **School admin** (F26, F28–F29): the account page, the badge, the membership record and page.
8. **Phone layouts** for every new screen (G below), then the report.

## G. Phone

At phone width (the shell's 358 px card, viewports 360–430), every new surface has a designed phone layout using the shell's existing patterns (tabs, bottom sheets, full screen); no phone-only copies of logic.
- **Landing, welcome, setup:** single column; the subject list as full-width rows with 44 px hit areas.
- **Homes:** tiles stack one per row; the walk icon row wraps under the question; the arrow stays on the right.
- **Walks:** question and answer, then the chart full width; the rail becomes a horizontal scroll of named chips above the chart; the mini-map moves under the chart; Back/Next in a sticky bottom bar.
- **Guided editor:** the map collapses to a 220 px strip with an "Expand map" button; "In your set" and "Add schools" become two tabs; "This set now" and Save sit in a sticky bottom bar.
- **Admin account and membership:** single column of cards.
- Rule test **R-FRONT-DOOR-MOBILE:** at 390 px each new surface renders without horizontal scroll and every control has a 44 px hit area.

## Tests (add to the rules catalogue; regenerate `docs/catalogue/*.md`)

- **R-BETA-GATE:** signed out, only the allowed routes respond; `/schools/[urn]`, `/join/[urn]` and `/sets` redirect to `/`; API routes 401; the preview route still works with its secret and fails closed without it; no Basic Auth remains.
- **R-NOINDEX-SCHOOLS:** with `ALLOW_INDEXING=true`, a school page still sends `X-Robots-Tag: noindex, nofollow` and page-level noindex; `sitemap.ts` lists none; `robots.ts` has no Disallow for them.
- **R-LANDING-MINIMAL:** the landing page has no search input, no school names, no OG/Twitter meta, no third-party scripts.
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
- **R-GUIDED-SETS:** the editor saves through the round-1 library with the same permissions; chips filter suggestions and the map; "This set now" is exact for a known set; the IGCSE count uses the shared constant.
- **R-DEVICE-CODES** (behind the flag if needed), **R-DEVICE-CAP** (the oldest signs out), **R-SIGNINS-RLS** (a user sees their own devices; an admin their school's staff; nobody else).
- **R-JOIN-DOMAIN:** an on-domain request is ordinary; off-domain is an exception needing explicit admin approval; existing members unaffected.
- **R-MEMBERSHIP:** each state renders from the record; no card number column exists; disabled payment actions say why.
- **R-FRONT-DOOR-MOBILE** (G).
- **The existing rules still pass.** Update any rule that names the old Step 4, the Basic Auth gate or SMT's violet. Log every rule retired or rewritten, with why.

## Ground rules

- **Branch `v0.8-front-door` from current `main`** (it already holds this prompt and the design files), fetched over HTTPS. Commit the design folder's move first. Use worktrees for parallel parts if they help.
- **These must be clean at every milestone:** tsc, eslint and build; the unit, rule, RLS and usage-log tests; every PGlite suite (run as their headers say; `view-as-pages.test.ts` with `--test-force-exit`); every parity harness.
- **Allowed differences in parity:** the new routes and pages; the gate; the panel ladder (every dashboard); SMT and head office colours; the set creator colours; the theme switch. **Figures never change.**
- **No database writes.** Migrations are written and tested in PGlite, and Guy applies them. Give each migration's step with the `schema_migrations` insert, per the template in `docs/FEEDBACK.md`.
- **Never put a server key in client code.** Stage files by name. Don't push or merge.
- **Log every call** under "2026-11-13: front door" in `docs/OPEN_QUESTIONS.md`.

## Report

Write `docs/v0.8/front_door_report_v1.md`. Include:
- how far you got, milestone by milestone, and anything left;
- the gate (allowed routes), the noindex rules, the env vars Guy can remove;
- the new tables and RLS (devices, codes, email domains, changelog, membership), and the migrations with Guy's apply steps;
- whether device codes are live or behind the flag, and exactly what Guy must do to switch them on;
- the final colour tokens and the contrast table;
- screenshots, desktop and phone (390 × 844), Dark, Light and Mid where it applies: landing; welcome; setup; each home; one screen of each GCSE walk; the dumbbell; a dashboard with the ladder (open and shut panels); the guided editor (feeders and rivals); the sets library; the admin account page; membership (pilot and active states);
- every rule added, rewritten or retired; tests and parity;
- **Guy's commands, in the template's order,** ending with a walk-through for: a teacher at a two-phase school (first login → setup → home → one walk), an SMT member, a head-office user, an Admissions lead (guided feeders editor), and a School-Admin (account page → membership).
