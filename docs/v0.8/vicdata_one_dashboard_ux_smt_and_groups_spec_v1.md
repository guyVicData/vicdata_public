# VicData — One dashboard UX: Teacher, Admissions, SMT and groups

Written 12 Oct 2026, for Guy to review. Updated 13 Oct: a group as a comparison set (§3.5); Oxbridge inside Destinations. It sets out the shared layout and controls every role's dashboards use, and specifies the SMT dashboards and the group view to match. It follows Guy's round 3 principle: *the core UI is identical; only the column arrangement differs.*

Read with:
- `docs/v0.7/admissions_r3_report_v1.md` (the shared panel chrome, nav and edit bar);
- `docs/v0.7/admissions_editor_plan_v1.md` (the editor);
- `docs/v0.8/vicdata_school_groups_data_plan_v1.md` (group data);
- `docs/v0.7/vicdata_0_6_admissions_dashboard_data_plan_v1.md`, "SMT dashboards".

## 1. The shared shell: what every role's dashboard has

Teacher has all of these. Admissions has them after round 3 and the editor stages. SMT and groups are built on them from the start, **never with their own versions**.

| Part | What it is | Teacher | Admissions | SMT | Group |
|---|---|---|---|---|---|
| **Nav** | `TeacherNav`: VicData mark, role home, library, account. View as only while viewing as someone. | ✓ | ✓ (r3) | same | same |
| **Edit bar** | Platform admins only: Edit, View as…, publish state | ✓ | ✓ (r3) | same | same |
| **Dashboard switch** | Linked dashboards in one group, in the control bar | Candidates · Results | Pipelines · Market share | Overview · Academic · Pupils · Context | Overview · Schools · Academic · Pupils |
| **Focus chips** | What every view follows, like Teacher's subjects | Subjects | Entry points (4+ / 11+ / 16+ / age) | Level: Whole school · Phases · Subject areas (top-down, §2.2) | Phase: All · Primary · Secondary · Post-16, plus a school picker |
| **Filters** | Pills in the control bar; only where they apply | Qualification | Gender · sector · Day + boarding (boarding schools only) | Gender · phase | Group source · open/closed |
| **Compared with** | The comparison-set chooser (nearest 10, LA, region, saved sets, custom, `?set=`) | ✓ | Feeders / rivals lists | ✓, plus "your group(s)" | Other groups · the LA · the region · the sector |
| **Grid** | Rows × columns, accordion rows, spans | 3 columns, Current / Trends | Column 1 + a large 2–3 view; then 3 panels | Same as Admissions | Same as Admissions |
| **Column 1** | "Now": fixed headline tiles plus a rail | Subject now | Entry point now | The school now (§2) | The group now (§3) |
| **Large view** | Columns 2–3 merged, a rail of views, full screen as focus mode | — (available) | ✓ | ✓ | ✓ |
| **Panel chrome** | One header: ⋯ menu (export, data, copy to slides), full screen, collapse; reserved slots | ✓ | ✓ | same | same |
| **Notes** | The notes icon; honesty wording from one notes file per product, locked by rules | ✓ | ✓ | `SMT_NOTES` | `GROUP_NOTES` |
| **Phone** | Column 1, then the large view as tabs, then rows | ✓ | ✓ | same | same |
| **Editor** | Data → View → Preview, one catalogue, no new dialogue | ✓ | ✓ (stages 1–4) | new families only | new families only |
| **Meetings** | Copy any panel or view to a slide | ✓ | ✓ | same | same |

**The rule for building SMT and groups:** an SMT or group view is a **catalogue entry plus a component** inside the shared shell. If a build needs a new piece of chrome, the round stops and reports.

**Before either product, one small round should extract the shell:**
- move the nav, control bar, grid, large view, panel and phone layout out of Teacher and Admissions into `src/components/shell/`;
- Teacher and Admissions then import from there;
- Teacher stays byte-identical in parity, and Admissions matches its own parity pass.

That way SMT and groups start on the shared parts and can't drift.

## 2. SMT dashboards

### 2.1 Who and why

SMT (heads, deputies, bursars where given SMT) ask how the school is doing overall, where that's coming from, and what's changing around it.

**SMT reads top-down** (Guy, 3 Oct): whole school first, then phases or subject areas, then into a subject, where the subject explorer (Teacher) takes over with the same comparison set, via r2b's `?set=`.

**Every SMT dashboard uses the same grid** (Admissions data plan, "SMT dashboards"):
- **row 1:** the position now, with total, nearest-10 rank, county or region rank, national rank and a trend summary;
- **row 2:** trends **indexed to 100** against the LA and England.

### 2.2 The focus chips: levels, not subjects

The chips are **Whole school · Phase (Primary / GCSE / Post-16, only the phases the school has) · Subject area**. They do the job Teacher's subject chips do: every view follows the level in focus.

- Choosing a subject area narrows the Academic views to it. Its subjects appear in the large view, each with "Open in the subject explorer".
- The chips are part of the dashboard's config, so the editor's "Shows for" lists levels for SMT, as it lists entry points for Admissions.

### 2.3 The four dashboards

**Overview**, the one-page answer for a governors' meeting.

| | Column 1 | Columns 2–3 (large view) |
|---|---|---|
| Row 1 | **The school now:** roll and its change, XS–XL by phase, shape, headline results by phase (Attainment 8; A-level points per entry; KS2 where published), each with its national rank. Value added where published: A-level VA for every school; Progress 8 for state schools only; "not published for independent schools" otherwise. | Rail: **Scorecard** (each headline, its rank among the comparison set, in the region and nationally, and its direction), **Map** (you and the comparison set), **Flags** (Admissions-style flags on the school itself: roll falling three years, results rising fast, entry cohort shrinking) |

| | Column 1 | Column 2 | Column 3 |
|---|---|---|---|
| Row 2 | Roll trend, indexed to 100 against the LA and England | Headline results trend against the comparison set | Market share at the main entry point (from Admissions) |

**Academic**, top-down.

- **Column 1:** headlines and value added for the level in focus.
- **Large view rail:**
  - **Subject areas** (Admissions' strengths and weaknesses view, against the comparison set instead of rivals);
  - **Subjects** in the area in focus, with ranks and the link to the subject explorer;
  - **Value added** (A-level VA by qualification type, and subject-level VA from `dfe_ks5_subject_value_added`; Progress 8 where published);
  - **Grade profile** (Teacher's grade bands, whole school).
- **Row 2:** results trend, value added trend, entries mix (the share in each subject area over time).

**Pupils**, reusing Admissions.

- **Column 1:** roll now, by phase, XS–XL, girls and boys, day and boarding (boarding schools only).
- **Large view rail:**
  - shape and size (yours, the local shape, the comparison set's, described but not ranked);
  - entry points at a glance (each entry point's cohort, its pool and the share needed, from Admissions; read-only, with a link into Admissions);
  - leaving at 16;
  - market share.
- **Row 2:** roll trend indexed, the pool trend for the main entry point, and the area's population (ages 5–15, ONS).

**Destinations** (later, after value added and SEND): DfE 16–18 destinations for every school (university, apprenticeships, further education, employment, not sustained), top third for state schools and colleges, and **Oxbridge** from the universities' apply-centre files, as ranges. **Oxbridge lives here, inside Destinations,** not as a separate view.

**Context**, the area around the school.

- **Column 1:** the area now: births trend, population projection, the school's LA and region.
- **Large view rail:** a map of the area, population by age, births and projections.
- **Data gap, to decide:** VicData holds **no deprivation or free-school-meals data yet**.
  - What we hold: ONS population, births and projections; postcode geography down to LSOA and MSOA; GIAS; ISC international recruitment.
  - "Social context" in the SMT plan needs at least two more sources:
    - **the English Indices of Deprivation** (LSOA level, joined through `postcode_geography`);
    - **DfE's school-level free-school-meals and pupil-characteristics data** (state schools).
  - Both are public. They need an ingest round before Context can do more than population.

### 2.4 Access

- **Who sees it:** SMT and the School-Admin. Platform admins see it through View as, read-only. Teachers don't.
- **Admissions inside SMT:** SMT's Pupils dashboard shows Admissions figures read-only. SMT can already read Admissions.
- **No new RLS:** everything is public data, or the school's own Admissions lists, which SMT can already read.

## 3. The group view

### 3.1 What a group is here

Any group in the groups plan:
- a MAT, federation or sponsor (from GIAS);
- an independent group (company or charity, from Club ISS, Companies House or the Charity Commission);
- a **self-declared** group a school has made.

Each view says where the group came from (its source label) and how sure we are of its membership (confirmed / likely).

### 3.2 Who sees it (to decide, §5)

- **First:** platform admins, and the SMT or School-Admin of **any member school**, for its own groups. A Cognita school's SMT sees Cognita; a MAT school's SMT sees its trust.
- **Later:** a **group account** for a trust's or group's central team, covering all its schools. That's a commercial product, a membership tier above the school, so it needs its own decision.
- **Self-declared groups:** only the school that made them, plus whoever it shares them with (the groups plan's privacy rule).

### 3.3 The four dashboards

**Focus chips:** All phases · Primary · Secondary · Post-16, plus **a school picker** that highlights one member school across every view.

**Overview**

| | Column 1 | Columns 2–3 (large view) |
|---|---|---|
| Row 1 | **The group now:** number of schools by phase, combined roll and its change, the XS–XL spread, regions covered, source label and last-checked date | Rail: **Map** of member schools (sized by roll, coloured by trend), **Group against group** (size, results, growth, ranked among groups of the same type), **Joined and left** (a timeline: dated where the source dates it, "last seen" where not) |

| | Column 1 | Column 2 | Column 3 |
|---|---|---|---|
| Row 2 | Combined roll trend, indexed to 100 against the LA mix and England | Combined results trend (pupil-weighted, by phase) | Share of the region's places (independent groups: share of independent places) |

**Schools:** the large view is a **schools table**, with roll, phase, XS–XL, shape, headline results, national rank, value added where published, and trend. Each row opens that school's public page, or its SMT view for a member. Alongside: shape small multiples, and a size and results scatter of the member schools.

**Academic:**
- headline results across the group, each school's rank within the group and nationally;
- subject areas across the group (strengths and weaknesses, group average against the national average);
- value added (A-level VA for all schools; Progress 8 for state schools; independents labelled "not published").

**Pupils:** combined roll by age (the group's shape), entry cohorts across schools, leaving at 16, and each school's market share in its own area.

### 3.5 A school's group as a comparison set (Guy, 13 Oct)

For a member school, **its group becomes a comparison set** in the existing chooser, everywhere a comparison set works: Teacher, Admissions, SMT, and the public page's rankings.
- **Labels:** "All Dukes schools", or for a MAT, "All Harris Federation schools".
- **The school's rank within its group** appears beside its local, regional and national ranks: "3rd of 26 Dukes schools on A-level points".
- **Phase:** the set filters to the schools that share the phase or measure in view. Dukes' preps don't count in a GCSE ranking, and the count says so ("3rd of 9 Dukes schools with GCSE results").
- **Sources:**
  - **official groups** (GIAS, Club ISS, Companies House) are offered automatically to their members;
  - **likely memberships** (Companies House only) are included with the source label;
  - **self-declared groups** are offered only to the school that made them.
- **A school in several groups** (a MAT and a different sponsor, say) sees each as a separate set.
- **Built on** `school_groups_lookup` / `group_schools_lookup`, through the same custom-set path as `?set=`. No new chrome.

### 3.4 Honesty wording (`GROUP_NOTES`)

- **"Membership as of [date], from [source]."**
- **Combined figures:** "Combined figures add up the schools listed. A school that joined recently counts for every year shown." An option shows "only years the school was a member" where join dates exist.
- **Group against group:** compares only groups of the same type and a similar size band. **A self-declared group is never ranked against official groups.**
- **Missing results:** schools without published results (IGCSE-heavy schools, preps with no KS2) are listed and labelled, never left out silently.

## 4. Build order

1. **Admissions editor stages 1–2** (prompt written, 12 Oct).
2. **Extract the shell** (§1): Teacher byte-identical, Admissions on its own parity pass.
3. **SMT wireframes** on the canvas, in the style of the Admissions boards (Overview, Academic, Pupils, Context, Phone, both themes). Guy reviews them.
4. **SMT data and views, round 1:** Overview and Academic. These reuse 0.6.6 ranks, value added already in production, and Admissions' strengths view.
5. **SMT round 2:** Pupils, plus Context with population only.
6. **Groups data, stage 1** (GIAS group records), which can run alongside 3–5, and **stage 2** (Club ISS).
7. **Group view wireframes,** then **group view round 1** (Overview and Schools), then round 2 (Academic and Pupils).
8. **Ingest deprivation and free-school-meals data,** then complete SMT Context.

**Editor families:** each new SMT or group view family arrives with its catalogue entry, R-* rules and tests, as Admissions' did. Stages 3–4 of the editor plan (moving views between rows; preview sizes) then apply to all four products at once.

## 5. Questions for Guy

1. **SMT's dashboards:** are Overview · Academic · Pupils · Context the right four? Or should Pupils and Admissions be one?
2. **SMT focus chips:** levels (Whole school · Phase · Subject area), as above? Or phases only, with subject areas inside the Academic large view?
3. **Value added on SMT's front page:** show A-level VA and Progress 8 on the Overview tiles, with "not published for independent schools" where it applies?
4. **Context data:** ingest the Indices of Deprivation and the free-school-meals data before SMT Context, or launch Context with population only?
5. **Who sees the group view:** a member school's SMT and School-Admin first? And is a group account for central teams a product you want to plan now?
6. **Group against group:** rank groups only against groups of the same type (MAT against MAT, independent against independent)? Or offer a mixed comparison with a clear label?
7. **Wireframes:** draw SMT and the group view on the canvas before any build, as we did for Admissions?
