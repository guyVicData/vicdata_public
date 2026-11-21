# VicData 0.8: top navigation consistency audit, and Send feedback (v1)

Guy, 21 Nov 2026. Two parts: (1) the top navigation the same on every page for every kind of user; (2) a
"Send feedback" button in that navigation for the beta testers. Branch **`t3/nav-consistency-feedback-button`**,
**rebased onto Stage 2** (`v0.8-front-door-3` at `da5a5324`, which sits on `main` at `f22b8834` with the hidden
`/schools` pages). The first audit and crawl ran on `main` at `6b7db90a`; the after-state was crawled again on
the combined build (below). Not merged and not pushed. Nothing was written to any database: the crawl only read
pages, and the feedback window was opened but never sent.

## In short

**Before:** there were **two navigation components** and **three more page-own headers**:

- the site bar (`NavBar.tsx`: VicData · Sets · Home · Account);
- the shell's `TeacherNav` (VicData · Home · phases · labels · role switch · View as · account menu · theme);
- People/Teams' `AdminHeader`, the School-Admin account pages' `AdminShell` header, and Admissions setup's frame.

The site bar was hidden on just seven `/teacher` routes, so it was stacked above the shell nav on **every SMT
page, both Admissions pages, every group (head office) page, the three first-visit pages and the dashboards
library**: two headers, two VicData wordmarks and two account controls. It was the *only* nav on Sets, Account,
Platform, the editors, the walks and the School-Admin pages. On those pages Home went to `/member`, not
`/teacher`, and there was no theme switch and no account menu.

On a phone the shell nav wrapped to three rows on every page except the Teacher dashboards. In View as, the site
bar ran off the side of a 390 px screen.

**After:** **one nav, the shell's `TeacherNav`, on every page.**

- **How each page gets it.** A page draws it itself, or the root layout draws the same component above a page that
  doesn't. `src/components/shell/nav-routes.ts` lists every page route, so a new page has to say which it is.
- **The rule test fails on drift.** It checks for a page missing from the list, a page that would get two navs, and
  a second VicData wordmark (R-NAV-ONE).
- **Walks are the one exception, as designed:** the walk's band is the top of the page, with its close button.
- **Send feedback is in that nav on every page** (and in a walk's band), as an amber pill with the dashboards' own
  feedback icon. It opens the existing page-feedback window (R-NAV-FEEDBACK).

The after-crawl found **no page with two navs, no page with the site bar, the same items in the same order
everywhere, the logo going to `/teacher`, one phone row, and no horizontal scroll at 390 px**.

## How I looked (method, per cell)

- **A local production build, crawled in a headless browser.** `next build`, then `next start` with
  `ACCESS_GATE_ENABLED=false`. The browser was headless Chromium (playwright-core 1.49.1).
- **Signed in as the preview agent.** I minted a real Supabase session for `preview-agent@vicdata.co.uk`, the
  preview-access account (a platform admin for demo week), the way `/api/testing/preview-session` does
  (`generateLink`, then `verifyOtp`), and put it in the page's storage.
- **Roles:**
  - **Teacher, SMT, Admissions, School-Admin and head office** were looked at with the **peek**
    (`?lookAs=…&as=…&peek=1`), at Leighton Park (110110). Head office used the Harris preview group account.
  - **School-Admin's People, Teams, account pages, home, Sets and Account** were looked at with **View as** (the
    `vicdata_view_as` cookie), because those pages aren't peeked.
  - **"Own"** is the preview agent as itself: a **platform admin with several roles** (School-Admin, Teacher,
    Admissions) at its own school.
  - **Signed out** is no session.
- **What each page load recorded:** 76 page × role cells, each at **1280 × 800 and 390 × 844** (152 loads). For
  each load:
  - every header with a VicData wordmark in the top 400 px, and which component drew it;
  - its links and buttons in order;
  - `aria-current`;
  - the logo's target;
  - the account menu's rows (opened by a click);
  - horizontal overflow at 390 px;
  - the Send feedback button and its size.
  - The crawler and job list are in the scratchpad, not committed; the tables below are their output.
- **Where the code was read instead:** the head office's own pages (no head-office test sign-in), and the
  signed-out cells that the beta gate will make unreachable. Each is marked in the text.
- **The account menu in a peek is the platform admin's own.** Its rows are School account, People, Teams and
  Platform, not the peeked role's, because a peek is a look, not a change of user. View as shows the member's menu
  (no Platform).

## Findings (before), each with what was done

| # | Finding | Where | Fixed? |
|---|---|---|---|
| 1 | **Two headers**: the site bar above the shell nav (two wordmarks, two account controls, ~60 px lost; ~110 px on a phone) | SMT (home, Academic, Pupils, Context, and SMT opened by head office), Admissions (home, team), every group page (home, Overview, Academic, Pupils, Schools, groups, access), first visit (welcome, setup, what's new; a Teacher not yet set up is sent there from `/teacher/ks4`), the dashboards library | **Yes**: the layout draws nothing where the page draws the nav |
| 2 | **A different component**: the site bar was the only nav | Walks (above the walk band, which the design draws alone), Sets library and editors, Account, Member, Platform ×4, Sources, Join, a school's page, group join, a meeting, new/edit dashboard, School-Admin account pages | **Yes**: the same `TeacherNav`, drawn by the layout; walks get their band alone |
| 3 | **Page-own headers** with a second wordmark: People/Teams (`AdminHeader`: VicData + People\|Teams; **no account menu, no theme, no Home**), the School-Admin account pages (`AdminShell`: a V tile, VicData, the school, theme, account menu), Admissions setup (a third "VicData" in its frame, under the site bar) | `/teacher/people`, `/teacher/teams`, `/teacher/school-account/*`, `/teacher/admissions` on first visit | **Yes**: the wordmarks go; People\|Teams stays as the page's switch, the school's name stays as the page's context, the nav is the shared one |
| 4 | **Different items and order**: the site bar had Sets · Home · View as pill · Account (a link to `/account`); the shell had Home · phases · labels · role switch · View as pill · account menu · theme | everywhere the site bar was | **Yes**: one set, one order. Sets moved into the account menu (Q1) |
| 5 | **Home went to two places**: `/member` (site bar) and `/teacher` (shell) | — | **Yes**: `/teacher` (it sends each role to its own home). `/member` itself redirected the test account to `/schools/137625/data`, a public `/schools/` page: handed to the agent removing those links |
| 6 | **The logo went to `/`**, the public page (with Stage 2, the landing page, which redirects a signed-in visitor to `/member`); People/Teams and the account pages' logos went to `/teacher` | both navs | **Yes**: VicData goes to `/teacher` signed in, `/` signed out |
| 7 | **Active state**: only Teacher's phase tabs mark the current page. Home is never marked on a home, the site bar marked nothing, and SMT/Admissions/group mark their own dashboard switch below the nav | all | Not changed: Q4 |
| 8 | **Phone**: the shell nav wrapped to three rows (~170 px) on every page but the Teacher dashboards, which have the designed one-row `PhoneNav`; with the site bar above it, ~230 px of chrome before any content | every non-Teacher-dashboard page | **Yes**: one phone row everywhere (`NavPhoneRow`, the same row the Teacher dashboards' `PhoneNav` draws); it wraps the theme switch to a second line below ~375 px rather than scroll |
| 9 | **Horizontal scroll at 390 px** in View as: the site bar's View as pill doesn't shrink | `/sets`, `/account`, `/teacher/school-account/*`, and `/teacher` in View as | **Yes** (no overflow in the after-crawl). `/platform/catalogue` still overflows: its table, not the nav |
| 10 | **Signed out**: `/teacher/ks4` drew **no nav at all** (no way home); the site bar offered Sets, which says "Sign in to see your sets" | signed out | Moot with Stage 2 (the beta gate sends every such page to the landing page). The shared nav's signed-out form is VicData · Log in · theme |
| 11 | **The role switch** didn't show for the test account (Teacher and Admissions roles at its school) on any page. Not investigated further: it depends on `loadNavMember`'s lenses for that account | own | Not changed; the phone row now carries the role switch too (it had none) |
| 12 | **The phase switch appears on some pages and not others**: Recruitment, SMT (own) and the Teacher dashboards show the school's Teacher phases; Home, Meetings, the library and Admissions (depending on the school's onboarded phases) don't | various | Not changed: Q2 |
| 13 | **Sets doesn't honour a peek**: `/sets?lookAs=110110&as=smt&peek=1` shows the platform admin's own school's sets, not Leighton Park's (AGENTS.md lists no peek for Sets; View as works) | `/sets*` | Not a nav question. Send feedback on such a page names the school the page shows |

### Stage 2 (v0.8-front-door-3): this branch is rebased onto it

Stage 2 merges first, and this branch now sits on its tip (`da5a5324`). What it changed, and what this branch does
with it:

- **The signed-out screens are `bare`: no nav and no footer.** These are `/` (the landing page), `/login`,
  `/reset-password` and `/forgot-password`, plus the auth hand-offs `/auth/confirm` and `/auth/callback` (route
  handlers that redirect at once). They are `bare` in `nav-routes.ts`.
  - Stage 2's own list, `BARE_PATHS` in `BareRoutes.tsx` (which the footer reads), now includes the two `/auth`
    routes.
  - A test holds the two lists equal, and Stage 2's own beta-gate test still passes.
- **School-Admin account pages.** Stage 2 hid the site bar there, because it drew two headers. That left
  `AdminShell`'s own header, a third design. This branch replaces both with the one nav (finding 3), including
  on the new Sign-ins and devices page (`/teacher/school-account/sign-ins`, `host`).
- **`/teacher/welcome`.** Stage 2 noted that the old site nav still showed above it. Here it is `own`: the
  welcome page draws the shared nav itself and the layout draws nothing (crawled: one nav).
- **`/member`** now goes to `/teacher` signed in and `/` signed out, never to `/schools/…`. VicData and Home go
  to `/teacher` directly (crawled: `/` and `/member` signed in both land on `/teacher`).
- **The hidden `/schools` pages** redirect before they render, so they have no entry in `nav-routes.ts`.
  Listing their route names would itself break R-NO-PUBLIC-SCHOOL-LINKS. The nav test leaves out exactly the pages
  `next.config.ts`'s redirect catches.
- **Signed-out visitors** only reach the bare screens and `/join/<urn>`. `/join/<urn>` gets the nav's signed-out
  form: VicData (to `/`), Log in, theme.
- **Cookie sessions** change nothing here: the nav and the feedback button read the session through the same
  client. Log out is Stage 2's `signOutHere()`, kept.
- **Rebase conflicts**, as planned:
  - `NavBar.tsx`: this branch's version;
  - `src/catalogue/rules.ts`: both blocks of new rules;
  - the generated catalogue: regenerated. Stage 2's committed copy had been generated without `dashboards.md`.

## What the one nav is now

- **The order, left to right:** VicData (to `/teacher`) · Home · the phase switch (Teacher phases, where the page
  has them) · the label switch · the role switch (more than one role) · the View as pill (while viewing as
  someone) · **Send feedback** · Account (menu) · Dark · Mid · Light.
- **The account menu:** Your Account · Sets · the walkthroughs switch · School account, People, Teams (a
  School-Admin) · Platform (a platform admin) · View as… (a platform admin) · the school picker (more than one
  school) · Log Out.
- **Phone, one row:** VicData · Home · role switch · View as pill · Send feedback · Account · theme. On the
  Teacher dashboards the phase, measure and subject row sits under it, as before.
- **Signed out:** VicData (to `/`) · Log in · theme.
- **Theme.** Where the layout draws the nav (`[data-shell-nav]`), it takes `#teacher-root`'s tokens in the
  person's theme. The Sets, Platform, People/Teams and School-Admin pages draw in that theme too.
  **Account, Member, Join and Sources aren't themed pages**: they follow the system's light/dark, so there the
  nav's switch changes only the nav (Q5).

## Send feedback (part 2)

- **Who sees it.** Whoever the existing audience setting lets give feedback: `feedback_allowed()`, the
  `feedback_audience` setting, `"admins"` today. Anyone else would only get "Feedback isn't open to you yet" on
  Send, so it isn't drawn for them. **For the beta testers to see it, the setting must be `"beta"` (with their
  rows in `feedback_beta_testers`) or `"all"`** (Q3). The brief asks for every signed-in user; the setting is
  how that's switched on, and nothing new was built for it.
- **What it looks like.** It uses the dashboards' own `FeedbackIcon` (imported from `FeedbackButton.tsx`, not
  redrawn), on a traffic-light amber pill: fill `#ffbf00`, ink `#1f1300`.
  - **The icon's contrast:** ink on amber is **11.0:1** in both themes.
  - **Standing off the bar:** in Light the pill has a darker amber edge (`#a16207`: **4.6:1** on the light bar, 4.9:1 on white);
    in Dark the amber itself is **12.0:1** on the dark bar.
  - The test checks every pair.
- **Accessibility.** It is a `<button>` named **"Send feedback"** (visible text on desktop, icon only on a
  phone), with a focus ring.
- **Size.** On a phone it is a **44 × 44** hit area (measured: 44 × 44 on every page in the after-crawl), drawn
  as a 34 px pill so the row keeps the nav's rhythm. On desktop it is 34 px tall.
- **What it opens.** The **existing page-feedback window** (R-FEEDBACK-PAGE). The store, `/api/feedback`, the
  `feedback_items` table and its columns are all unchanged.
  - **On a page that already says what it is** (every dashboard, the role homes, the group home, the Data View,
    a meeting), it opens exactly what the footer's "Feedback on this page" opens: that page's own surface, with
    its dashboard, state, entry point or level, and set.
  - **On any other page** (Sets, Account, Platform, People, Teams, the School-Admin pages, the editors, the
    walks), the button describes the page from its address. See "What is recorded" below.
- **The window itself.** A page with a surface already draws the one feedback window. On any other page the
  button draws it, and only the first nav on the page does.

### What is recorded (a page without its own surface)

An item sent from the nav's button on, say, `/sets/guided?kind=feeders` records the same row any page item
does:

| Field | Value |
|---|---|
| `product` | by section: `smt`, `admissions`, `group`, `meeting`, `teacher`, `custom` (dashboards), `dataview`, else **`home`** (the column's own list; no new product) |
| `dashboard_id` / `dashboard_name` | **`nav:/sets/guided`** / "Sets · guided" (the path in words; an id in the path reads "one") |
| `view_key` | `page:nav:/sets/guided` (a page item: no panel, view or dataview) |
| `school_urn`, `school_name` | the school the page is for: a peek's on a `/teacher` page; otherwise View as's, else the person's own school. The Sets, Account and Platform pages don't honour a peek (they show the person's own school), so an item from those pages names that school. |
| `role` | the peek's or View as's role, else `member` |
| `view_as` | true in a peek or View as |
| `state` | `{ page: "/sets/guided" }` |
| `page_path`, `page_query` | the address, as the window records it |
| device, width, theme, app version, body, kinds, area, importance… | as every item (the window's own form) |

**Head office** has no school on its own pages. The group's dashboards and home already have their surface. The
group library and access pages don't, and there the button isn't drawn for a head-office user with no school
membership (Q3).

## Questions for Guy (each with a recommendation)

1. **Sets in the nav.** The retired site bar had "Sets" for everyone. It is now a row in the account menu, so no
   page loses its way to Sets, but it is one click deeper. Should it be a top-level item, and should head office
   see it? **Recommendation:** keep it in the menu for everyone, head office included (`/sets` shows a head
   office its group sets). Sets are reached mostly from the homes' sets panels and the dashboards' "Compared
   against" menus.
2. **The phase switch outside Teacher pages.** Teacher's GCSE/Post-16 tabs show on Recruitment and SMT (and on
   Admissions where the school has Teacher phases), but not on Home, Meetings or the library. **Recommendation:**
   show them only on Teacher's own pages (the phase dashboards and Recruitment). An SMT or Admissions user
   reading their dashboard doesn't expect Teacher tabs there.
3. **Who sees Send feedback.** It follows the existing audience setting (`"admins"` today). **Recommendation:**
   set `feedback_audience` to `"beta"` and add the testers to `feedback_beta_testers` before they start; `"all"`
   once every member should see it. For head office's group library and access pages, give them a page surface
   (a small follow-up) so the button shows there too.
4. **Active state.** Only Teacher's phase tabs show where you are. **Recommendation:** mark Home as current on
   the person's home (`aria-current="page"` and the filled icon) and leave the rest to each page's own dashboard
   switch, which already shows it. It is small, but it is a visual change, so it isn't in this branch.
5. **Theme on Account, Member, Join and Sources.** These pages follow the system theme. The nav above them
   follows the person's choice, so in Dark on a light system the nav is a dark band over a light page.
   **Recommendation:** draw those pages in the shell's theme (`#teacher-root`), as Sets and Platform already are.
   A follow-up after the freeze.
6. **Walks.** The walk's band is the whole top of the page, as designed (`walk_*.png`), with Send feedback
   added to it. **Recommendation:** keep it so. The close button is the way home.

## Screenshots

`docs/v0.8/nav_consistency_screenshots/`, from the local build with real data at Leighton Park. Test-account
email addresses are cropped out.

| What | Before | After |
|---|---|---|
| SMT, desktop: two headers → one | `before_smt_desktop.png` | `after_smt_desktop.png` |
| SMT, phone: two headers, three rows → one row | `before_smt_phone.png` | `after_smt_phone.png` |
| A walk: the site bar above the band → the band alone, with Send feedback | `before_walk_desktop.png` | `after_walk_desktop.png` |
| Sets in View as, phone: overflowing site bar → the one nav | `before_sets_viewas_phone.png` | `after_sets_viewas_phone.png` |
| People: own header, no account menu → the one nav | `before_people_desktop.png` | `after_people_desktop.png` |
| Admissions setup: a third wordmark under the site bar → the one nav | `before_admissions_setup_desktop.png` | `after_admissions_setup_desktop.png` |
| Send feedback, Dark / Light, desktop / phone | | `feedback_{dark,light}_{desktop,phone}.png` |
| Send feedback focused (keyboard) | | `feedback_dark_desktop_focus.png` |
| The window it opens: on SMT (the page's own surface), on Sets (described from the address) | | `feedback_open_smt_desktop.png`, `feedback_open_sets_phone.png` |
| On Stage 2: the welcome page (one nav), Account, the School-Admin's account page (phone, in View as: the row wraps, no overflow) and Sign-ins | | `stage2_welcome_desktop.png`, `stage2_account_desktop.png`, `stage2_school_account_phone.png`, `stage2_signins_desktop.png` |
| On Stage 2, signed out: the landing page (bare), a school's join page (the nav's signed-out form) | | `stage2_landing_signed_out_desktop.png`, `stage2_join_signed_out_phone.png` |

## Tests

- **R-NAV-ONE and R-NAV-FEEDBACK** are in the rules catalogue, with runners `navOne` and `navFeedback`. Their tests
  are `src/lib/nav-consistency.test.tsx` (11 tests). They check:
  - every page is listed in `nav-routes.ts`, except the hidden `/schools` pages, which never render;
  - the `bare` routes are exactly Stage 2's `BARE_PATHS`;
  - an `own` page draws `TeacherNav` and a `host` page doesn't (no second header);
  - the layout's `NavBar` draws only `TeacherNav`;
  - there is one VicData wordmark, and it goes to `/teacher`;
  - Sets is in the menu;
  - the hosted nav's tokens equal `#teacher-root`'s;
  - Send feedback is in both the desktop nav and the phone row, before Account, and in a walk's band;
  - it uses the same `FeedbackIcon` svg;
  - it isn't drawn for those not let in, and it is named and 44 px;
  - the contrast pairs pass;
  - the item a page without a surface sends passes the server's own `feedbackRow` check.
- **The whole unit suite:** see the hand-back.

## The matrix

Each cell is one page × role, at desktop (1280) and phone (390). The tables are generated from the crawl:

- **Nav:** the component behind each VicData wordmark in the top 400 px.
- **Items:** the nav's links and buttons in order, after the wordmark.
- **Account menu:** its rows, opened by a click.
- **Active:** the items with `aria-current="page"`.
- **Phone overflow:** horizontal scroll at 390 px.

Head office's own pages, as a head-office user rather than a peek, were read in the code: they are the same
components as the peek.

The first two tables come from the full crawl on `main` (`6b7db90a`): before, and this branch's first after. The
third is the representative re-crawl on the combined build (Stage 2's tip plus this branch).

- **How the re-crawl signed in.** A cookie session in `@supabase/ssr`'s own format, minted the same way.
- **Device check.** The local server ran with `DEVICE_SESSIONS=off`, Stage 2's documented emergency switch. The
  gate still verified the session (signed out, `/teacher/smt` redirected to `/`), but the crawl wrote no device
  rows to the production database.

### Before (main at 6b7db90a)

| Role | Page | Lands on | Nav desktop | Nav phone | Items (desktop, after VicData) | Active | Logo | Account menu | Phone overflow | Send feedback |
|---|---|---|---|---|---|---|---|---|---|---|
| Teacher (peek) | `/teacher` | same | TeacherNav | TeacherNav | Home, Show labels, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Teacher (peek) | `/teacher/walk/post16-well` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Teacher (peek) | `/teacher/ks4` | /teacher/setup?next=%2Fteacher%2Fks4 | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Show labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Teacher (peek) | `/teacher/recruitment` | same | TeacherNav | TeacherNav | Home, GCSE, Post-16, Show labels, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Teacher (peek) | `/teacher/ks5` | /teacher/setup?next=%2Fteacher%2Fks5 | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Show labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Teacher (peek) | `/teacher/meetings` | same | TeacherNav | TeacherNav | Home, Hide labels, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Teacher (peek) | `/teacher/walk/gcse-many` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| SMT (peek) | `/teacher/smt/academic` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| SMT (peek) | `/teacher/walk/smt-academic` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| SMT (peek) | `/teacher/smt/pupils` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| SMT (peek) | `/teacher/smt/context` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| SMT (peek) | `/teacher/smt` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| SMT (peek) | `/teacher/walk/smt-overview` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Admissions (peek) | `/teacher/admissions` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Admissions (peek) | `/teacher/admissions/team` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Admissions (peek) | `/teacher/walk/admissions-pipeline` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| School-Admin (peek) | `/teacher/smt` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| School-Admin (peek) | `/teacher/admissions` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| School-Admin (View as) | `/teacher/teams` | same | other:body | other:body | (page-own header: People | Teams switch; no account menu, theme or Home) | — | /teacher | — | no | — |
| School-Admin (View as) | `/sets` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | **yes** | — |
| School-Admin (View as) | `/teacher/school-account` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, View as…, Log Out | **yes** | — |
| School-Admin (View as) | `/account` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | **yes** | — |
| School-Admin (View as) | `/teacher` | same | TeacherNav | TeacherNav | Home, Hide labels, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, View as…, Log Out | **yes** | — |
| School-Admin (View as) | `/teacher/school-account/membership` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, View as…, Log Out | **yes** | — |
| School-Admin (View as) | `/teacher/people` | same | other:body | other:body | (page-own header: People | Teams switch; no account menu, theme or Home) | — | /teacher | — | no | — |
| School-Admin (View as) | `/teacher/school-account/head-office` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, View as…, Log Out | **yes** | — |
| Head office (peek) | `/teacher/group/academic` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/group/access` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/group/pupils` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/walk/group-overview` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Head office (peek) | `/teacher/group` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/group/schools` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/smt?headOffice=110110` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/group/overview` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/teacher/group/groups` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Head office (peek) | `/sets` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher` | same | TeacherNav | TeacherNav | Home, Show labels, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/teacher/group` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/teacher/school-account` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/schools/110110` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher/setup` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Show labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/dashboards` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Hide labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/join` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher/ks4` | same | TeacherNav | PhoneNav | Home, GCSE, Post-16, Show labels, Account | GCSE | / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/teacher/group/join` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/platform` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/sets/edit` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher/whats-new` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Show labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/dashboards/new` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/sources` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher/admissions` | /teacher/admissions?view=pipelines&setup=entry | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher/people` | same | other:body | other:body | (page-own header: People | Teams switch; no account menu, theme or Home) | — | /teacher | — | no | — |
| Platform admin, own (multi-role) | `/platform/feedback` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/sets` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/account` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/teacher/smt` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, GCSE, Post-16, Show labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/teacher/teams` | same | other:body | other:body | (page-own header: People | Teams switch; no account menu, theme or Home) | — | /teacher | — | no | — |
| Platform admin, own (multi-role) | `/platform/catalogue` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | **yes** | — |
| Platform admin, own (multi-role) | `/teacher/welcome` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Home, Account / Home, Show labels, Account | — | /, / | Your Account, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | — |
| Platform admin, own (multi-role) | `/sets/guided` | same | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Platform admin, own (multi-role) | `/member` | /schools/137625/data | NavBar(site) | NavBar(site) | Sets, Home, Account | — | / | — | no | — |
| Signed out | `/join` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/teacher/smt` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Join your school, Log in / Home, Hide labels, Account | — | /, / | Log in | no | — |
| Signed out | `/account` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/sources` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/teacher/admissions` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Join your school, Log in / Home, Hide labels, Account | — | /, / | Log in | no | — |
| Signed out | `/member` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/teacher` | same | TeacherNav | TeacherNav | Home, Hide labels, Account | — | / | Log in | no | — |
| Signed out | `/teacher/group` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Join your school, Log in / Home, Hide labels, Account | — | /, / | Log in | no | — |
| Signed out | `/schools/110110` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/login` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/teacher/ks4` | same | **none** | **none** |  | — |  | — | no | — |
| Signed out | `/sets` | same | NavBar(site) | NavBar(site) | Sets, Join your school, Log in | — | / | — | no | — |
| Signed out | `/teacher/welcome` | same | NavBar(site) + TeacherNav | NavBar(site) + TeacherNav | Sets, Join your school, Log in / Home, Show labels, Account | — | /, / | Log in | no | — |

### After (this branch, on main at 6b7db90a)

| Role | Page | Lands on | Nav desktop | Nav phone | Items (desktop, after VicData) | Active | Logo | Account menu | Phone overflow | Send feedback |
|---|---|---|---|---|---|---|---|---|---|---|
| Teacher (peek) | `/teacher` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Teacher (peek) | `/teacher/walk/post16-well` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| Teacher (peek) | `/teacher/ks4` | /teacher/setup?next=%2Fteacher%2Fks4 | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Teacher (peek) | `/teacher/recruitment` | same | TeacherNav | TeacherNav | Home, GCSE, Post-16, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Teacher (peek) | `/teacher/ks5` | /teacher/setup?next=%2Fteacher%2Fks5 | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Teacher (peek) | `/teacher/meetings` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Teacher (peek) | `/teacher/walk/gcse-many` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/smt/academic` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/walk/smt-academic` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/smt/pupils` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/smt/context` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/smt` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/walk/smt-overview` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| Admissions (peek) | `/teacher/admissions` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Admissions (peek) | `/teacher/admissions/team` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Admissions (peek) | `/teacher/walk/admissions-pipeline` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| School-Admin (peek) | `/teacher/smt` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (peek) | `/teacher/admissions` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/teams` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/sets` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/school-account` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/account` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/school-account/membership` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/people` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/school-account/head-office` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/academic` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/access` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/pupils` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/walk/group-overview` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/schools` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/smt?headOffice=110110` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/overview` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/groups` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/sets` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/group` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/school-account` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/schools/110110` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/setup` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/dashboards` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/join` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/ks4` | same | TeacherNav | PhoneNav | Home, GCSE, Post-16, Show labels, Send feedback, Account | GCSE | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/group/join` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/platform` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/sets/edit` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/whats-new` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/dashboards/new` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/sources` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/admissions` | /teacher/admissions?view=pipelines&setup=entry | TeacherNav | TeacherNav | Home, GCSE, Post-16, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/people` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/platform/feedback` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/sets` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/account` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/smt` | same | TeacherNav | TeacherNav | Home, GCSE, Post-16, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/teams` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/platform/catalogue` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | **yes** | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/welcome` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/sets/guided` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/member` | /schools/137625/data | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Signed out | `/join` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/teacher/smt` | same | TeacherNav | TeacherNav | Log in | — | / | — | no | no |
| Signed out | `/account` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/sources` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/teacher/admissions` | same | TeacherNav | TeacherNav | Log in | — | / | — | no | no |
| Signed out | `/member` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/teacher` | same | TeacherNav | TeacherNav | Log in | — | / | — | no | no |
| Signed out | `/teacher/group` | same | TeacherNav | TeacherNav | Log in | — | / | — | no | no |
| Signed out | `/schools/110110` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/login` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/teacher/ks4` | same | **none** | **none** |  | — |  | — | no | no |
| Signed out | `/sets` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/teacher/welcome` | same | TeacherNav | TeacherNav | Log in | — | / | — | no | no |

### After, on Stage 2 (combined build: da5a5324 + this branch)

| Role | Page | Lands on | Nav desktop | Nav phone | Items (desktop, after VicData) | Active | Logo | Account menu | Phone overflow | Send feedback |
|---|---|---|---|---|---|---|---|---|---|---|
| Teacher (peek) | `/teacher/walk/gcse-many` | same | walk band (by design) | walk band (by design) | close, Send feedback | — |  | — | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/smt` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| SMT (peek) | `/teacher/smt/academic` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Admissions (peek) | `/teacher/admissions` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/school-account` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/people` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/school-account/membership` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/teams` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| School-Admin (View as) | `/teacher/school-account/sign-ins` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Head office (peek) | `/teacher/group/overview` | same | TeacherNav | TeacherNav | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/member` | /teacher | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/sets` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/platform` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/sets/guided` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/` | /teacher | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/teacher/welcome` | same | TeacherNav | TeacherNav | Home, Show labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Platform admin, own (multi-role) | `/account` | same | TeacherNav(host) | TeacherNav(host) | Home, Hide labels, Send feedback, Account | — | /teacher | Your Account, Sets, Walkthroughs, School account, People, Teams, Platform, View as…, Log Out | no | yes (133×34; phone 44×44) |
| Signed out | `/reset-password` | same | bare (by design) | bare (by design) |  | — |  | — | no | no |
| Signed out | `/` | same | bare (by design) | bare (by design) |  | — |  | — | no | no |
| Signed out | `/join/110110` | same | TeacherNav(host) | TeacherNav(host) | Log in | — | / | — | no | no |
| Signed out | `/login` | same | bare (by design) | bare (by design) |  | — |  | — | no | no |
