# VicData 0.7 — Admissions, round 2: the screens

Claude Code build prompt, written 12 Oct 2026. Round 1 (data layer, roles, shared lists, flags) is merged and applied on both databases. This round builds what people see.

## Read first, in full

- **The plan:** `docs/v0.7/vicdata_0_6_admissions_dashboard_data_plan_v1.md`, especially "Who builds and who sees", "Decisions", "Rivals and flags", "Shape and size", and **"Round 2 decisions (8 Oct)"**.
- **The wireframes:** `docs/wireframes/admissions/` (canvas "VicData Admissions dashboards"). **Build them pixel-perfect**, in both themes, using the app's real tokens and icons. The hexes in the boards are illustrative.

  | Board | What |
  |---|---|
  | `Main` | Pipelines |
  | `MarketShare` | Market share |
  | `Pipeline16` | 16+ cohort ladder, large view |
  | `ShapeView` | Shape and size, large view |
  | `RivalMomentum` | Rivals' momentum, large view |
  | `RivalSubjects` | Strengths and weaknesses, large view |
  | `Phone` | Phone layout |
  | `Onboard1`–`4` | Setup steps |
- **The round 1 report:** `docs/v0.7/admissions_r1_report_v1.md`: what exists, the routes, the logged calls. Use the round 1 libraries and `/api/admissions/*` routes. **Don't recompute anything in the client.**
- **The existing dashboard config system** (0.6 S2), the view editor (0.6.1, Data → View → Preview), View as, the comparison-set chooser, the ranking table (0.6.6), and the public school page's Roll by phase (XS–XL) and Shape card. Reuse them; don't build parallel versions.

## Ground rules

- **Branch `v0.7-admissions-r2` from `main`.** Commit per stage, with tsc, eslint, build, unit tests, rule tests and the parity harness all clean.
- **Nothing that exists may change:** Teacher, the Data View and the public page stay byte-identical in parity. Admissions is additive.
- **Never put a server key in client code.** Admissions data comes only through the round 1 routes and the caller's session.
- **Database changes are written and tested, never applied by you.** This round has one (D1). Apply commands are `&&` chains with the project-ref check and **no `exit`**. The app must work before and after it's applied.
- **Stage files by name; never `git commit -a`.** Leave Guy's untracked or modified files alone.
- **Long runs:** use statement timeouts and progress logs. Don't let anything wait silently.
- **Log calls** under "2026-10-12 — 0.7 admissions r2" in `docs/OPEN_QUESTIONS.md`.
- **Merge and push** if parity is clean, every stage passes, and D1 is left for Guy. **Stop before merging** for any RLS change beyond D1, or any change to an existing page. If a push fails, give Guy the command (he pushes over HTTPS).

## D1 — The `sync_membership_roles` fix (app database, separate migration)

- Apply the one-line `nullif` guard to the 0.6 S1 trigger's `''::jsonb` cast on an empty claims setting, as found in round 1's review (§4).
- It is **its own migration**, with a PGlite test showing the before/after behaviour. It is **not applied**.

## D2 — The Admissions dashboards in the config system

- **Two published dashboards,** `vicdata.admissions.pipelines` and `vicdata.admissions.market-share`, linked by the **Pipelines | Market share** switch, as GCSE Candidates | Results are.
- **Seed rows go in `scripts/dashboards-seed-sql.ts`,** with a code fallback copy as for Teacher. Give Guy the re-seed command.
- **The layout follows the wireframes:**
  - row 1: column 1 is the entry point now; **columns 2–3 are one spanning large view**, the centre of the page;
  - row 2: three panels;
  - on a phone, the large view stacks full width under the entry point, and its views become tabs (`Phone`).
- **The entry-point switcher** (4+ / 11+ / 16+ / custom age, then ±) works like Teacher's subject chips. Each view follows the focused entry point. The school's entry points come from `admissions_entry_points`.
- **The top bar filters:** Day + boarding; All pupils / girls / boys; State + independent. They pass through to the round 1 routes.
- **Access:**
  - Admissions (lead or not), SMT, School-Admin, and platform admins through View as (**read-only**);
  - a home-page tile for those roles;
  - Teachers don't see Admissions. **A list shared with someone shows the list only** (school names), never the computed views (decision 5).

## D3 — Pipelines (`Main`, `Pipeline16`, `ShapeView`)

- **Row 1, column 1 · the entry point now:**
  - tiles: entry cohort, change since 2019/20, girls/boys, day/boarding (whole school, no age split);
  - **size by phase, XS–XL**, reusing the school page's badge row and caption;
  - the shape line and mini profile.
- **Large view, rail: Pipeline · Funnel · Map of feeders · Feeder table · Shape and size.**
  - **Pipeline:** past pools, then the ladder with certainty styling: **counted** solid, **births** dashed with a range band, **projection** off (11+ only, toggle).
    - Rung labels go under the axis.
    - "Pool ▼ x% by year" uses `ADMISSIONS_NOTES`.
    - **Feeder flags:** green **focus** for rising or stable; red **red flag** for falling faster than the area. Hovering shows the figures.
    - The header has the feeder list and LA-blend chips; the lead can edit them, everyone else sees them read-only.
  - **16+:** the ladder runs through secondaries (11–16 schools first), then primaries, then births. Each stage of the ladder has an "Edit list" for the lead (`Pipeline16`).
  - **Funnel:** births → Y6 / Y11 pools in the set → entry.
  - **Map:** feeders sized by pupils at the relevant age, coloured by trend. Reuse the existing map component **through new optional props only**, so the Data View is unchanged.
  - **Feeder table:** each school with its pupils at the age, trend, flag, distance, sector, gender and XS–XL.
  - **Shape and size:** your profile by gender, the **local shape** of the set, and rivals' shapes described **but not ranked** (`ShapeView`).
- **Row 2:**
  - your entry-cohort trend;
  - pool trends, indexed (feeders, LA, England), with the area population trend (ages 5–15) on the rail;
  - **the share needed to hold numbers steady**, labelled "a requirement, not a forecast".
- **Wording:** every honesty label comes from `ADMISSIONS_NOTES` (pool, not intake; share of this group; estimate; requirement).

## D4 — Market share (`MarketShare`, `RivalMomentum`, `RivalSubjects`)

- **Row 1, column 1:** rank at the entry age among rivals, market share, change in share, whole-school rank.
- **Large view, rail: Donut · Ranked bars · Map of rivals · Table · Rivals' momentum · Strengths and weaknesses · Shape.**
  - **Ranked bars:** each rival's pupils at the entry age, share and trend, plus **results rank in its region and in England** (headline). A rival that isn't ranked shows why ("IGCSE", "no published results").
  - **Rivals' momentum:**
    - a scatter of pupil change against results change since 2022/23, in four quadrants;
    - a list of flags (results rising fast, gaining or losing pupils, three falls in a row, Year 7 shrinking, new sixth form, shape changed);
    - every flag shows its figures on hover. With thresholds missing, show "flags not available yet", never guessed flags.
  - **Strengths and weaknesses:**
    - each subject area with your rank among the rivals who teach it, the gap to their average (diverging bars) and its direction since 2022/23;
    - flags: Strength, Strength growing, Weakness, Weakness widening;
    - a link to the subject explorer with these rivals;
    - the overall rank and England rank above.
- **Row 2:**
  - your entry trend against rivals' average;
  - the **academic panel by entry point** (4+ → KS2, 11+ → GCSE, 16+ → Post-16): overall rank, then where you lead and trail;
  - roll and market-share trends (line · numbers · ranks · % change).
- **FE colleges** (decision 6): their own 16+ intake and shares come from the existing FE participation data, **labelled as FE participation data**, a different source from the census. If it can't be matched honestly, show the empty state and log it. Don't invent figures.

## D5 — Setup (`Onboard1`–`4`), lead only

- **On first visit,** a lead with no entry points is taken into setup. Anyone else sees the dashboards with a note that "the Admissions lead hasn't set these up yet", plus the defaults where they exist.
- **The four steps:**
  1. **Entry points:** one or several, plus a custom age; day and boarding, or day only.
  2. **Day feeders:** the nearest 15 (or within x km / by LA / add by name), state and independent, on a map, with ticks, flags and XS–XL.
  3. **Boarding feeders:** preps by area and type (independent, with boarders, ages to 11 or 13, LAs). Either pick schools or **keep it as a fuzzy set**. Show the international (ISC) context note.
  4. **Rivals:** nearest 10/15, regional, saved set or custom, with narrowing filters and the academic note.
- **Saving** writes `admissions_entry_points`, `admissions_lists` (day, boarding, rivals, rungs) and the LA-blend overrides through `/api/admissions/lists`. It shows "last changed by [name], [date]".
- **A School-Admin without the flag** can do the same (the override). Every change goes in the audit log, and the screen says "changed by School-Admin".

## D6 — People: lead, team and sharing (decisions 1–4)

- **The School-Admin's People page:**
  - an **Admissions lead** badge and a "Make lead" action;
  - the lead's grants (who and when);
  - the admissions **history** from `platform_audit_log`;
  - an override that removes or restores any grant.
- **The lead's "My team":** a small page the lead opens from Admissions to add or remove **Admissions** staff from the school's members, through `admissions_set_member()`. Nothing else can be granted from it.
- **Sharing a list:** the **lead and SMT** can share it with roles, teams or people (decision 2). SMT changes only its own shares (round 1 RLS). **The person shared with sees the list only.**
- **Platform admins** read everything through View as, read-only (decision 4).
- **RLS:** no changes beyond round 1 (and D1). If the UI needs one, **stop and report**.

## D7 — The editor's catalogue entries

The existing editor (Data → View → Preview), with no new dialogue:

- **Step 1, Data:**
  - new families: *Pupils by age*, *Pipeline*, *Market share*, *Rivals' results*;
  - new compare options: *Day feeders*, *Boarding feeders*, *Both*, *Rivals*, *Area (LA / region / England)*;
  - **the entry point plays the part the subject plays for Teacher.**
- **Step 2, View:**
  - new kinds of view, with look-only options: pipeline chart, momentum scatter, strengths bars, shape small multiples, flag list;
  - **the certainty styling, honesty wording, flag thresholds and "shapes not ranked" can't be edited** (catalogue rules);
  - the spanning large panel uses the editor's existing span.
- **Step 3, Preview, and the rail menu's "Shows for":** these list **entry points** for Admissions where Teacher lists result types.
- **Every new view and family has an R-* rule with a test,** as round 1's rules do.

## D8 — Export and meetings

- Large views and panels export and **copy to meeting slides** as Teacher views do.
- Check that a large view fits a 16:9 slide, and record any that need a different layout.

## Parity, checks and report

- **Parity:**
  - Teacher, the Data View and the public page are byte-identical against `main`;
  - Admissions screenshots against every wireframe board, both themes, 1440 and 390, with a written list of every deliberate difference.
- **Real-data click-through** (screenshots in the report):
  - The Chase 137625 at 11+ and 16+;
  - King's Worcester 117037 at 11+ and 16+;
  - an independent prep with boarders (4+ and 11+);
  - an 11–16 school;
  - an FE college at 16+.
  For each, the pipeline, the market-share large view, momentum, strengths, shape, and setup as a lead.
- **Roles walk** (screenshots):
  - lead: setup, edit, My team;
  - Admissions member: read-only;
  - SMT: read, share;
  - teacher with a shared list: the list only;
  - School-Admin: override, recorded;
  - platform admin through View as: read-only.
- **Speed:** time the Admissions page on a warm server (first draw, entry-point switch, large-view switch). It should draw in under 1.5 s warm.
- **Report: `docs/v0.7/admissions_r2_report_v1.md`.** Include:
  - what was built;
  - the screenshots;
  - the deliberate differences from the wireframes;
  - the roles walk;
  - D1's apply command and the dashboards re-seed command;
  - logged calls;
  - a click-through for Guy.

**Merge if clean:**

```
git checkout main && git pull && git merge --no-ff v0.7-admissions-r2 -m "0.7 Admissions round 2: the screens" && npm run build && git push
```

Tell Guy to wait for Render's "Deploy live", re-seed the dashboards, apply D1, then do the click-through.
