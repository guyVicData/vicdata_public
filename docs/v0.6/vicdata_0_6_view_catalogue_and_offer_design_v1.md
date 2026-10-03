# VicData 0.6 — View catalogue & what we offer each group (design v1)

*Companion to `vicdata_0_6_scope_brief_v1.md`. Guy (3 Oct): "all this detail is key — when users build their own dashboards they are drawing on all this work — and as we develop / add new datasets we will continue doing this work… we are not building a full stats package, just ways to bring views together." This doc answers two questions: how we catalogue and document what we've built so it can be extended safely, and how we decide what each group is offered.*

---

## 1. The principle: the value is in the rules, and rules belong to the data

Look at the detail that makes the Teacher dashboards trustworthy:
- AS/AEA left out of comparison lists, but never out of the focused item's own figure
- England markers at Post-16 use the exact qualification or nothing, never a bucket fallback
- minimum-school-count suppression
- entries always counted, points only where a real challenge table exists
- the single-bucket fallback at exactly 100%, with no tolerance
- IB Core and Baccalaureate rows excluded from entries but not from points
- points comparable only within one qualification type
- trends only with 3+ years

**Almost none of that is about how a chart looks. It's about what a number is allowed to be.**

Today a lot of it lives inside the panel components (`CandidatesPanels`, `SubjectPanels`, `ComparisonsPanels`), mixed in with layout and view state. That was fine while each dashboard was hand-built. It stops being safe the moment a user can lift a view out of its panel and drop it somewhere else. A rule that lives in the panel gets left behind when the view moves.

**So the catalogue's first job is structural, before it's documentation: every rule moves down into the data layer.** A rule is applied wherever the measure is fetched, whatever renders it and wherever it sits. A user-built dashboard then inherits every rule automatically, because there's no way to reach the number without going through them.

That gives four layers, each catalogued separately:

```
RULES      named, numbered statements of what a number is allowed to be
  ↓ applied by
MEASURES   what is counted, at what grain, at which geographies, with which number types
  ↓ shown by
RENDERERS  chart/table/map components: shape requirements only, no rules
  ↓ combined into
DATAVIEWS  the registered recipes the chooser offers (measure × focus × compare × number type × date × renderer)
```

The chooser in the scope brief (§3) filters over **dataviews**. The editor places **dataviews**. Everything people have worked hard on lives in **rules** and **measures**, and that's where new work keeps landing as datasets are added.

---

## 2. The four catalogues

### 2.1 Rules

One card per rule, each with a stable ID.

| Field | Content |
|---|---|
| ID | e.g. `R-KS5-ASAEA-EXCL` |
| Statement | One plain-English sentence a non-developer can read |
| Why | The real failure it prevents (with the school/figure that exposed it, where we have one) |
| Applies to | Which measures and focuses |
| Enforced in | The function(s) and file(s), which also carry `// R-KS5-ASAEA-EXCL` in a code comment so a grep finds every enforcement point |
| Test case | A real school/subject/year whose figure proves the rule is working, with the expected value |
| Origin | The brief/round that introduced it |
| Status | active / superseded (by which rule) |

Rules we already know exist. **These IDs are illustrative; S0 confirms the real list.**

- `R-ENTRIES-NOT-POINTS`: entries count every qualification. Points only where a real challenge table exists. Suppress rather than borrow.
- `R-POINTS-SAME-QUAL`: a points figure is only comparable within the same qualification type.
- `R-KS4-POINTS-GCSE-FULL`: KS4 points come from GCSE (9-1) Full Course with a clean single grade only.
- `R-KS5-ASAEA-EXCL`: AS and AEA are left out of comparison lists, group totals and averages, never out of the focused item's own figure (with the self-inclusion follow-up from Part D still open).
- `R-KS5-ENGLAND-EXACT`: the Post-16 England marker is the exact subject × qualification figure or nothing. No bucket fallback.
- `R-MIN-SCHOOLS`: a benchmark is suppressed below the minimum school count.
- `R-SINGLE-BUCKET-100`: the unfiltered view borrows a bucket's points only when the category is 100% that bucket. No tolerance band.
- `R-IB-NONSUBJECT`: the Baccalaureate total and IB Core rows are excluded from entries and included in points.
- `R-FOCUS-NEVER-FILTERED`: the focused item is never filtered out of its own figures, only out of comparison lists.
- `R-TREND-3YR`: trend views need 3+ years; below that, show the table only.
- `R-ZERO-CANDIDATE`: special schools and zero-candidate schools are filtered out of comparison populations.
- `R-POINTS-WEIGHTED`: per-subject points are weighted by points-eligible entries, not flat-averaged across qualifications.

### 2.2 Measures

One card per measure. This is where "Rolls / Academic › Results / Candidates / Social context › Live births" in the chooser actually resolves to.

| Field | Content |
|---|---|
| ID / VicData name | e.g. `M-KS5-ENTRIES` / "Post-16 candidates" |
| Plain definition | What is counted, in a sentence |
| Grain | e.g. school × subject × exact qualification × year |
| Source(s) | Registry source IDs, and DfE/ONS names for the sources page only (VicData terms in the UI, per your brief) |
| Years available | e.g. 2021/22 → 2024/25 |
| **Geographies available** | school · subject area · set · LA · region · England, each ✓ or ✗ with a reason. This is where real gaps like *Grade 4+ has no LA/region/England benchmark* are recorded, so the chooser can't offer something that doesn't exist |
| **Honest number types** | Which of Totals / % change / % market share / Indexed (start = 100) make sense (see §3) |
| Rules applied | List of rule IDs |
| Fetched by | The one data function/RPC every view must go through |
| Known gaps / open items | e.g. Mathematical Studies collision in the background aggregate |
| Briefing doc | Link to the repo's `briefing_*_what_is_measured` doc |

### 2.3 Renderers

One card per chart/table/map component. These hold no rules, only shape requirements:
- **Accepts**: e.g. part-of-whole only (donut); needs geography (map); needs a series of ≥2 years (trend line); needs a set (ranking)
- **States**: empty, suppressed and partial-coverage states, and the wording used for each
- **Sizes**: the minimum panel height it works at (the 68px problem from round 8), and its fullscreen and print behaviour
- **Phone behaviour**

### 2.4 Dataviews (registry entries: what the chooser offers)

One entry per registered recipe:

| Field | Content |
|---|---|
| ID | e.g. `DV-CAND-SHARE-DONUT` |
| Measure × focus × compare × number type × date mode × renderer | the capability declaration the chooser filters on |
| Default title template | with placeholders: `Entries in [subject] as a proportion of [comparison-group]` |
| Rail icon | |
| **Audience tags** | e.g. `subject-level`, `whole-school`, `market` (see §4) |
| Status | `draft` → `live` → `deprecated` → `retired` (§2.6) |
| Verified at | Real schools and phases checked, with dates |
| Origin | Round/brief that built it |
| Used on | Which VicData dashboards (generated, not hand-kept) |

### 2.5 Where the catalogue lives

**Source of truth: the code.** Each rule, measure, renderer and dataview is a typed object in the repo (`src/catalogue/…`), carrying the fields above as metadata. The registry the chooser reads *is* the catalogue, so they can't drift apart.

Three outputs are generated from it:

1. **An in-app Catalogue page** (super-admin only). Pick a school, phase and subject, and every registered dataview renders live with its card alongside: measure, rules, status, verified-at, origin. This one page does three jobs:
   - the documentation you browse
   - the regression/parity check after any data or code change: walk it at two schools
   - the source of the chooser's live preview, using the same rendering path
2. **Generated markdown** (`docs/catalogue/*.md`): rules, measures and dataviews as tables. These get pushed to the project after each round, so planning conversations here work from the real current list, not from memory. This is the fix for the round-8 problem of briefs asserting the wrong codebase state.
3. **A rule test file**: each rule's test case runs as an automated check against the real data (expected figure at the named school). A data or ingest change that breaks a rule then fails loudly instead of quietly shipping.

The existing human-written docs stay as they are: the knowledge-and-lessons doc and the three `briefing_*` docs. Measure cards link to them rather than duplicating them.

### 2.6 Lifecycle and change policy

- **draft**: super-admin only. Visible on the Catalogue page, not in anyone's chooser.
- ~~**beta**~~: dropped (decided 3 Oct). There are no pilot schools, and none are planned until the build reaches 1.0. If a pilot stage is wanted at 1.0, it can be added then.
- **live**: offered according to the audience rules (§4).
- **deprecated**: still renders wherever it's already placed, with no warning to users, but is no longer offered in the chooser.
- **retired**: replaced. A mapping (`DV-OLD → DV-NEW`) rewrites saved dashboards on load, so no user dashboard breaks.

**Saved dashboards reference dataviews by ID, live.** A rule fix or data correction therefore reaches every dashboard that uses that view immediately, including users' own. That's the right default, because it's how a correction to a published figure should behave. Where a fix visibly changes a figure (e.g. Part D's donut shares roughly doubling), the generated changelog records it. That changelog could later feed the "NEW" pill/notice mechanism from the Teacher view brief §13.

### 2.7 Definition of done for any new view or dataset

This is the checklist that keeps the catalogue honest as we extend. A new view or dataset isn't done until:

1. Any new rule has a card, an ID, an enforcement point (with the comment tag) and a real-school test case.
2. The measure card states its geographies (with gaps), honest number types, years and rule list.
3. The renderer card states its shape requirements and its empty/suppressed states, if the renderer is new.
4. The dataview is registered with title template, icon, audience tags and status `draft`.
5. It has been checked on the Catalogue page at ≥2 real schools of different types, and *verified at* is filled in.
6. It has been promoted to `live` by you.
7. The generated catalogue markdown has been pushed to the project.

Claude Code prompts for future rounds should cite this checklist rather than restate it.

---

## 3. A finding from doing this: "Type of numbers" depends on the measure

Your chooser's step 4 (Totals / % change / % market share / Indexed) fits **counts** perfectly: entries, rolls, births. It doesn't fit **results**, which are averages and rates:

| Measure kind | Totals | % change | % market share | Indexed (=100) |
|---|---|---|---|---|
| Entries / candidates | ✓ | ✓ | ✓ share of school, category or set | ✓ |
| Rolls | ✓ | ✓ | ✓ share of LA/area | ✓ |
| Live births | ✓ | ✓ | ✗ (*capture rate* = intake ÷ births is a future measure, not a share) | ✓ |
| Average points | ✗ an average has no total; show as **Points** | ✗ % change of an average misleads; show as **Change in points** | ✗ | ✗ |
| Grade 4+ rate (a %) | ✗; show as **Rate** | ✗; show as **Change in percentage points** (the existing pp-bar) | ✗ | ✗ |

**Recommendation:**
- The measure card declares its honest number types.
- The Numbers options (now in the chooser's Customise screen) adapt to the measure: counts show your four; results show *Points / Change in points* or *Rate / Change in pp*.
- **One term: "points"** (decided 3 Oct). "Score" is not used in the UI. "Points" always means points per entry on that qualification's own challenge-table scale; the IB Diploma's 0–45 total keeps its own label, "Diploma total points". **Decided**: the Results measure switcher's "Average point score" is renamed "Average points" (include in the 0.6 build).
- Combinations that aren't honest are simply never offered.

This is the same "suppress rather than fabricate" discipline the Academic Results phase ran on, applied to the chooser.

---

## 4. What we offer each group

### 4.1 Three separate things, often conflated

1. **Curated**: the VicData dashboards a role gets by default, built by you and assigned by role.
2. **Palette**: what the dataset chooser lets that person add to their own dashboards.
3. **Powers**: what they can create, save, share or assign.

Plus a fourth axis we already have: **tier** (free / individual / school single / school all, from roadmap §2). What a person actually gets is *role × tier*.

### 4.2 Gating is about relevance, not security

Every measure is school-level public data. Nothing in the palette is sensitive in itself. So:
- Role gating is a **product decision** (relevance, simplicity, the commercial ladder), enforced in the app, not in RLS.
- RLS stays for things that are genuinely owned: personal dashboards, team shares, saved sets, notes, Recruitment, Meetings.
- This keeps the offer cheap to change. Moving a view from SMT-only to Teacher is a tag edit, not a migration.

### 4.3 Offer by tag rules, not per-view lists

Each dataview carries **audience tags** (§2.4), and each role's palette is a rule over tags. Proposed tags:
- `subject-level`: focus is a subject, subject area or custom area
- `whole-school`: focus is the school
- `academic`, `rolls`, `social`: the data domain
- `market`: market share and rankings against local rivals
- `geography`: LA/region/England comparisons

A new view registered with the right tags then appears for the right people automatically, which is the scaling property you're after. Per-view exceptions are allowed but should stay rare.

### 4.4 Proposed starting offer (for you to change)

| | Curated (VicData dashboards) | Palette (chooser) | Powers |
|---|---|---|---|
| **Teacher** | GCSE and Post-16 Candidates/Results (phases the school has data for) | **No additional datasets** (decided 3 Oct): exactly the measures already on their curated dashboards (academic, subject-level, with the existing geography/set comparisons). Their dashboards needed editing, and that editing is done | Own dashboards *(once user editing ships)*; Recruitment; Meetings |
| **SMT** | **None yet**: SMT dashboards to be built by you in the 0.6 editor (likely whole-school academic + rolls + births) | Everything `live` | Own dashboards. **No team sharing** (decided 3 Oct): only School-Admin shares, and an SMT member who is also School-Admin shares in that capacity |
| **Admissions** | **None yet**: an Admissions dashboard to be built by you (rolls, births, market share against nearest 10/LA, headline results) | `rolls`, `social`, `market`, `academic` × `whole-school` | Own dashboards |
| **School-Admin** | Powers only: an admin, not a lens. Gets the union of the roles they hold | Union of their roles | People, roles, teams; share to teams |
| **Super-admin** | Everything | Everything incl. `draft` | Edit VicData dashboards; assign to roles |

The point worth noticing is that **0.6's editor is how SMT and Admissions get their curated dashboards.** You build them visually from the catalogue, rather than going through another hand-coded round each. That makes S5 (editor) more valuable, and is a reason to give the S0 catalogue audit time to be thorough.

### 4.5 Tier: deliberately left open

Roadmap §2 tiers sell *role views* ("Individual: one role view; School All: all role views"). The cleanest mapping is:
- **tier decides which role views a person can activate**
- **role decides curated, palette and powers**

The free tier's offer (the roadmap says free = "genuinely useful context data") needs its own decision, especially since the Teacher view brief made all standard views paid. Not needed for the 0.6 build, because the tags make it a configuration change later. Flagged so it isn't forgotten.

---

## 5. Changes to the 0.6 scope brief

- **S0 audit output** follows this doc's four-catalogue format (rules, measures, renderers, dataviews), not a single flat view inventory. For each rule it records *where it's enforced today*. Any rule enforced only inside a panel component is flagged as **must lift**.
- **S2** lifts every must-lift rule into the measure's fetch function before wrapping any view. This is the real engineering heart of 0.6. If a lift can't be done without changing a figure, it's a **stop** (it would change what the live dashboards show).
- **S2/S3** builds the **Catalogue page**. It replaces the separate "parity route" in the scope brief §6, and the parity check runs on it.
- **S4 chooser**: Customise's Numbers options come from the measure's honest number types (§3). Steps 1–2 and Pick only offer geographies the measure card marks ✓.
- **New**: rule test cases run as an automated check (§2.5 item 3).
- **New**: generated catalogue markdown, pushed to the project at the end of the build.

---

## 6. Decisions for Guy

| # | Decision | Recommended default |
|---|---|---|
| C1 | Adopt the four-layer catalogue with code as source of truth plus generated docs and an in-app Catalogue page | **Accepted (3 Oct):** Yes |
| C2 | Saved dashboards follow live dataview IDs, so fixes propagate everywhere | **Accepted (3 Oct):** Yes, with the changelog |
| C3 | Results get their own number types rather than your four count types | **Decided**: yes. One term, "points" (Points / Change in points; Rate / Change in pp). Switcher renamed "Average point score" → "Average points" |
| C4 | Role offer by tag rules, as the starting table in §4.4 | **Accepted (3 Oct):** Adopt as v1 and adjust once SMT/Admissions dashboards exist |
| C5 | Can **SMT** share to teams, or only School-Admin? | **Decided**: only School-Admin (who may also hold SMT) |
| C6 | Does **Teacher** get extra datasets in their palette? | **Decided**: no additional datasets; palette = what their curated dashboards already use |
| C7 | Lifecycle with `beta` offered to flagged schools | **Decided**: no. There is no beta stage, because there will be no pilots until 1.0; the lifecycle is draft → live → deprecated → retired |
| C8 | Tier × role mapping | **Accepted (3 Oct):** Defer; not needed for the 0.6 build |
