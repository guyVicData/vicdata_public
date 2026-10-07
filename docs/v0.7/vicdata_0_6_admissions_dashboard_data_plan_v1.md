# VicData — Admissions dashboard: what data we can show (plan v1, updated with Guy's answers and layout)

7 Oct 2026. Guy's outline, checked against what vicdata-production actually holds. It covers two views: **Pipelines** and **Market share**. This is for design and wireframing; nothing is built yet.

## Framing (Guy, 7 Oct)

- **These are pipeline projections, not intake forecasts.** The pipeline is the *pool*: children in nearby schools, or born in the area, who will reach an entry point in a given September. It never claims who will come.
- **The intake side is framed as "the market share needed to hold numbers steady".** For example: if the pool shrinks 8% by 2030, the school's share would need to rise from 12.5% to 13.6% to keep the same intake. That is a decision-useful figure, not a prediction.
- **Uncertainty is honest and visible.** The method differs by distance from now:
  - real counts (census) are solid;
  - birth-based years show a range;
  - projections show a wider band, and only on request.
  - The range widens the further ahead it goes.
- **Modelled projections come later,** from MIS data and scenario modelling. They're a consulting deliverable for Victoria Consultancy clients only: extra rows, kept separate from the platform's public-data figures, and never mixed into them.

## What the data holds (checked on production, 7 Oct)

| Source | What | Grain | Years |
|---|---|---|---|
| **DfE school census** | pupils by **single age** (0–19) and **by gender**, full-time and part-time, every school, independents included | school | **2019/20–2025/26** (Jan census; ages at 31 Aug of the academic year) |
| | **year groups** (Reception, Y1–Y14), nursery and early years | school (state; independents report age only) | same |
| | boarders by gender (**not** by age) | school | same |
| **ONS births** | live births, **total only** (no gender split) | **local authority** (313) | 1992–2025 (calendar years) |
| **ONS population projections** | **age 10 only** | upper-tier LA (152) | 2022–2045 |
| ONS population | total only | LA | 2015–2024 |
| GIAS | location, type, phase, gender, boarding flag, age range, open/closed | school | current (refresh needed: last ingested 27 Aug) |

**Not available, so never claimed:**
- **Actual feeder relationships** (where pupils came from). Default sets are nearby schools; label them "nearby schools" until admissions confirm a set as their feeders.
- **Catchment-level births.** Births are by LA only; the postcode geography (NSPL / MSOA) has never been ingested.
- **Intake (new joiners).** The census gives cohort sizes, not joiners. Estimating joiners by following a cohort across census years (rolls spec §7) is unbuilt and would be an estimate.
- **Boarders by age, and international pupils.** International pupils are in the ISC data, not the census.
- **Births by gender,** so girls'/boys' 4+ pools from births are halved estimates (see below).

## The cohort ladder: one mechanism for every entry point

Every entry point traces its cohort back through whichever schools hold those children now, rung by rung. Ages are as at 31 Aug 2025 (the 2025/26 census). September 2026 entry has already happened.

| Entry (Sept) | 4+ (Reception) | 11+ (Y7) | 16+ (Y12) | Source / certainty |
|---|---|---|---|---|
| 2027 | age 2 in nurseries + births 2023 | age 9 in primaries | age 14 in secondaries | census: counted |
| 2028 | births 2024 (+ age 1 in early years where present) | age 8 | age 13 | census: counted (4+ from births) |
| 2029 | births 2025 | age 7 | age 12 | census: counted (4+ from births) |
| 2030 | projection¹ | age 6 | age 11 | census: counted |
| 2031 | projection¹ | age 5 | age 10 (primaries) | census: counted |
| 2032 | — | age 4 (Reception) | ages 9→ (primaries) | census: counted |
| 2033–2036 | — | births 2021–2024² | primaries ages 8→5 | census / births |
| 2037+ | — | projections¹ | births, then projections | range, then wider band |

¹ The projections we hold are **age 10 only**, so they suit the 11+ ladder (age 10 projected, then +1 year). For 4+ and further 16+ rungs they'd need new ONS projection ages: an ingest change, flagged.
² Calendar-year births straddle two school cohorts (Sept–Aug). Use 8/12 of year Y plus 4/12 of year Y−1, stated in the method note.

**Rung sets:** each rung has its own default set, editable by admissions.
- **11+:** state primaries nearest the school; independent preps by fuzzy set.
- **16+:** local secondaries, **11–16 schools without a sixth form first** (their pupils must move), plus the school's own Year 11. Earlier rungs use the primaries feeding those secondaries' area.
- **4+:** births in a blend of nearby LAs (Q2), plus nurseries.

**Drift:** cohorts grow or shrink between census years as families move. For each set, measure the observed year-on-year cohort change from 2019/20 to 2025/26. Apply its spread as the range, never as a single point.

## View 1: Pipelines (what to show)

1. **The pool by entry year:** past pools 2020–2026 (from earlier censuses, the same method), then the forward pipeline.
   - Line style by certainty: solid (counted), dashed with a band (births), faint band (projection, off by default).
   - Hover: which rung, which schools or LAs, and the counts.
2. **Change in the pool:** e.g. "−8% by 2030 against 2026".
3. **"Share needed to hold numbers steady"** (shared with View 2):
   - the school's current entry-cohort size (its own count at the entry age), divided by the pool, each year;
   - the share required to keep that number, year by year;
   - stated as a requirement, not a forecast.
4. **The feeder set table:** each nearby school, its pupils at the relevant age(s) and their trend, distance, sector, gender.
   - Small cells follow the suppression discipline (rolls spec §5 GDPR note) if a single-age, single-gender count is very small. These are public counts, but avoid spotlighting tiny cohorts.
5. **Map:** feeder schools sized by pool contribution, coloured by trend (the Data View map patterns).

**Filters:**
- **Gender:** a real split for census rungs. For birth rungs, a 49/51 estimate, labelled as such.
- **Sector:** independent or state, for feeder sets.
- **Boarding:** filters schools only; the census has no boarders by age.

**Entry points:** 4+, 11+, 16+, plus custom ages (e.g. 7+, 8+, 13+). The census supports any age, so custom is cheap.

**Feeder sets:** reuse the comparison-set chooser:
- nearest 10 or 15 (with type: primaries for 11+, secondaries / 11–16 for 16+);
- regional;
- custom (add a school by name);
- **fuzzy set** (e.g. independent preps in chosen boroughs): the ranking population's filters (sector, gender, boarding, LA), saved as a set.

## View 2: Market share (what to show)

1. **Entry-age share among rivals:** the school's count at the entry age as a share of that age across rivals plus the school, 2019/20–2025/26.
   - For example: "14% of the 11-year-olds across these 12 schools, up from 11%".
   - It matches the Data View's group-share definition, and is labelled as a share of *this group*, not the local market.
2. **The whole age band too** (e.g. 11–16, 16–18), for a school whose entry isn't one year.
3. **Ranking of rivals** at the entry age, and their trends (existing ranking and table components).
4. **"Share needed to hold numbers steady"**, against the pipeline (from View 1).
5. **Later:** capture rate from the feeder pool ("of the children leaving these preps, what share joins you"). It needs the new-joiner estimate and is unbuilt.

**Rivals:** nearest 10/15, regional or custom; filters for boarding, gender, and state/independent.

## Guy's answers (7 Oct, 19:15)

1. **4+ geography:** blend nearby LAs automatically; admissions can adjust the blend.
2. **Custom entry ages:** yes, any age.
3. **Projections:** up to **10 years for 16+**. **Far less for Reception:** births give real figures to Sept 2029, so allow projection a year or two beyond at most. Hide it, or keep it very faint, beyond that.
4. **Building the feeder list is an onboarding step,** like the Teacher onboarding. When admissions first open the pipeline for an entry point, they build their feeder list from the nearby schools. **Boarding and day get two separate steps:**
   - day feeders: local and radius-led;
   - boarding feeders: wider, the preps that send boarders.
   The defaults are "nearby schools" until confirmed.
5. **Through-schools:** entry points work like a teacher's subjects. Admissions pick "my entry points" (one or several) and switch between them, the way a teacher with several subjects does.

## Layout (Guy's doc "Admissions Pipeline Trends", 7 Oct): the Teacher-style grid

Three columns. Row 1 is "current state"; row 2 is trends. Each view keeps the Teacher dashboard's rails, views and editor.

**Key layout decision (Guy, 7 Oct 19:20):** in both views, **row 1 columns 2 and 3 merge into one large data view**. The smaller panels sit around it: row 1 column 1, and the three panels in row 2. The large view is the centre of the page.

### View 1: Pipelines

| | Col 1 | Cols 2–3 (merged: the large data view) |
|---|---|---|
| **Row 1 (current)** | **The entry point now:** size of this year's entry cohort, gender split, growth, LA context (S/M/L size badges) | **Funnels / the pipeline:** the cohort ladder from births through Y6 / Y11 pools to the entry year; the feeder set (nearest 10/15, regional, custom, fuzzy, e.g. preps in SW London or schools with big leaving numbers at 16); international context (ISC) for boarding. It switches between views like a rail: pipeline chart (certainty styling), funnel, map of feeders, feeder table. |

| | Col 1 | Col 2 | Col 3 |
|---|---|---|---|
| **Row 2 (trends)** | **The school's entry-point trend:** line or bars, table | **Pool trends:** e.g. Y6 numbers; nearest 10, LA, national | **Share needed to hold numbers steady:** the forward requirement, year by year |

### View 2: Market share

| | Col 1 | Cols 2–3 (merged: the large data view) |
|---|---|---|
| **Row 1 (current)** | **The entry point now:** rank in the nearest 10 at the entry age | **Rivals' rolls and market share:** donut or bar, ranking, map of rivals; sets as View 1 |

| | Col 1 | Col 2 | Col 3 |
|---|---|---|---|
| **Row 2 (trends)** | **The school's entry-point trend** against the nearest-10 rivals | **Academic ranking of rivals** (new): **4+ → KS2**, **11+ → GCSE**, **16+ → Post-16**; numbers, ranks, % change | **Roll and market-share trends:** line, numbers, ranks, % change |

**The academic overview of rivals reuses the Teacher dashboard's machinery:**
- Comparisons and rankings, with 0.6.6's whole-population ranks;
- whole-school headlines (Attainment 8, A-level points per entry, KS2 measures), with a subject drill-down linking to the subject explorer.

**Data checks for the academic overview:**
- **KS2 is thin for independent rivals.** Only 12 of a sample of 400 boarding schools have KS2 results, since most preps don't sit SATs. A 4+ academic view of independent rivals will mostly say "no published results". Be honest about this, or use GCSE as the proxy for through-schools.
- **GCSE:** IGCSE-heavy independent schools are excluded from GCSE comparisons (an existing rule). Say so per rival.
- **Post-16:** fine for A level and IB; vocational rivals follow the 0.6.5 exact-qualification rules.

**International (ISC):** what we hold is **national new joiners by country/region, 2018–2024**. That's sector context ("new joiners from Hong Kong to ISC schools have fallen 30% since 2018"), **not** a per-school pipeline. Show it as context in the funnel for boarding entry points only.

**"Schools with big leaving numbers at 16"** (a fuzzy-set criterion) can be computed from the census: the drop from age 15 to age 16 at each school (100% for 11–16 schools).

### SMT dashboards (from the same doc; later)

Rolls, admissions, academic results (with a link to the subject explorer) and social context, each on the same grid: a row 1 with total population, nearest 10, rank in the county and a trend summary; a row 2 indexed to 100 against the LA and national. These come after the admissions dashboard.

## Shape and size (Guy, 7 Oct 19:22–19:27): reuse what's built

- **Size:** the school page's **XS–XL badges by phase** (`sizeBadgeForValue`, quintiles; `PhaseBreakdownCard` "Roll by phase"), never new words. These appear in the entry-point panel and the feeder and rival lists.
- **Shape:** the shared classifier (Tube, Pyramid, Top step, Funnel, Mushroom, Wineglass, Irregular; `ShapeCard` / `ShapeIcon`):
  - the school's own shape and its stability since 2019/20;
  - the **local shape** of the feeder area (a narrowing base = smaller cohorts coming);
  - rivals' shapes, **described, never ranked** (rule from the Data View brief).
- **Reused from the public school page and the advanced Data View:**
  - Roll by phase; Shape (age and gender profile);
  - Population trends in the area (ages 5–15);
  - Nearest matched schools;
  - market share (group share) and market-share growth/decline;
  - combined roll; target versus region/nation/sector trends.

## Rivals and flags (Guy, 7 Oct 19:32–19:33)

- **Strengths and weaknesses against rivals:**
  - your rank among rivals by **subject area** (and drill-down to subject), with the gap to the rivals' average and its direction since 2022/23;
  - flags: Strength, Strength growing, Weakness, Weakness widening;
  - only rivals with that subject area are ranked, small entries are left out, and each area links to the subject explorer;
  - the overall rank stays: e.g. 2nd of 8 rivals and the England rank, on 0.6.6's ranking function.
- **Rivals' momentum:**
  - a scatter of pupil change (entry age) against results change since 2022/23, in four quadrants (growing and improving, and so on);
  - a list of **flags**: results rising fast, gaining pupils, losing pupils three years running, Year 7 shrinking, new sixth form, shape changed.
- **Feeder flags** (pipeline schools):
  - a **drop bigger than the area's** is a **red flag**;
  - **rising or stable numbers mark schools to focus on**.
  - They're shown in the pipeline's large view and in the feeder lists during setup.
- **Where local schools sit regionally and nationally** (Guy, 19:35): each rival, and you, carries its **regional and national rank**, using 0.6.6's whole-population ranking function:
  - on results: the whole-school headline, or the subject or subject area in view;
  - on size: XS–XL and the rank by roll.
  - It appears in the rivals list, and in the strengths view per subject area.
  - The same ranks are available for feeders (KS2 for state primaries, where published).
- **Flag rules:** fixed and documented thresholds, a change that is large and lasting (e.g. over two or more years), never from one small cohort. Hovering a flag shows the figures behind it. Every flag is a catalogue rule with a test.

## Who builds and who sees (Guy, 7 Oct 19:38)

- **A new role, Admissions lead,** granted by the School-Admin. Only the lead builds and edits:
  - entry points;
  - day and boarding feeder lists;
  - rivals;
  - the LA birth blend.
  The lead also runs setup.
- **Admissions** (others in the team) see everything and can suggest changes, but don't edit.
- **The Admissions lead can add staff to their team** (Guy, 19:39), within strict limits:
  - **delegated granting:** the lead can invite or approve people from the school's own members into the **Admissions** role, and remove them;
  - the lead **can't** grant Admissions lead, SMT or any other role, can't act outside the school, and can't remove the School-Admin's grants;
  - the School-Admin sees every change in People and can override it;
  - every grant and removal is recorded in the audit log;
  - this needs a server-side check (RLS or a security-definer function) that allows only `admissions` and only within the lead's own school.
- **SMT** see the admissions dashboards and the school's lists.
- **SMT can share with teachers** through the existing teams and assign mechanism, read-only.
- **The lists are school-level and shared, not personal,** with a note of who last changed them and when.
- **Already exists** (vicdata-public migrations):
  - roles `admissions` and `smt`, both School-Admin granted;
  - automatic teams `smt` and `admissions`;
  - Assign / share to roles and teams.
- **New:** an `admissions_lead` role value, or a lead flag on `admissions`. It's a small change to the roles check constraint and to `roles.ts` (`ADMIN_GRANTED_ROLES`), plus "lead only" write rules (RLS) on the shared lists table.

## Decisions (Guy, 7 Oct 19:40)

- **Flag thresholds are set nationally for now, and adjusted later.**
  - A flag fires when a school's change is in the top or bottom fifth of the national distribution for its phase.
  - The change must last two or more years, with a minimum cohort size.
  - The thresholds are constants kept in one place, so Guy can tune them without touching the logic.
- **Admissions comes with the whole-school package.** It isn't sold separately, so no separate paywall: access is by role only.

## Wireframes

Design canvas "VicData Admissions dashboards" (7 Oct):
- Pipelines (11+);
- Market share (11+);
- the 16+ cohort-ladder large view;
- the Shape and size large view;
- phone;
- four setup steps: entry points → day feeders → boarding feeders → rivals;
- Rivals' momentum and Strengths and weaknesses large views.

## Next

1. Wireframe both admissions views in the design canvas, plus the onboarding steps:
   - pick entry points;
   - build the day feeder list;
   - build the boarding feeder list;
   - choose rivals.
2. Then the build:
   - the data layer: cohort ladder, drift ranges, LA-blend births, share needed to hold numbers steady, entry-age shares, 16+ leaving numbers;
   - views in the dashboard config system.
