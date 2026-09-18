# VicData — Phase 3: Academic Results — Front-End Spec v1

*Companion to `vicdata_phase3_academic_results_topic_spec_v1.md` (data/tiering spec),
`vicdata_phase3_academic_results_summary_wordings_v1.md` (sentence wording draft),
`vicdata_phase3_member_data_view_spec_v1.md` (the Rolls Data View precedent this
reuses/extends), and `vicdata_phase3_state_of_school_page_spec_v1.md` (the free-page
precedent). Captures the full front-end design conversation held 2026-09-12, covering
both real integration points found in the live `vicdata_public` code — not designed
from scratch, grounded in what's actually there.*

**Real integration points, confirmed directly in code, not assumed:**
- Free: `src/app/schools/[urn]/page.tsx` line ~1017, `<ComingSoonCard title="Academic
  snapshot" />`, sitting inside the State of School page's `DashboardGrid` alongside
  `RollCard`/`GenderSplitCard`/`BoardingCard`/etc.
- Paid: `src/components/data-view/DataViewShell.tsx`'s `TOPIC_TABS` array, `{ label:
  "Academic", active: false }` — a greyed pill with a colour already reserved for it
  (`TOPIC_COLOURS.Academic`, purple, `tag-colours.ts`), no content behind it yet.

**Real, load-bearing dependency — this round cannot start until the backend follow-up
round is built, reviewed, and committed** (per Guy's own sequencing decision,
2026-09-12): `academic_headline_snapshot` and `academic_geography_aggregate`
(`vicdata_phase3_academic_results_backend_followup_brief_v1.md`, Part A) are what
"your context" groupings read from; the nearest-schools/Comparator Set read-path
wiring (Part B) is what lets the comparator-set selection already built for Rolls
carry over here unchanged. `academic_subject_family_rollup` is already built and
committed (`7b80596`) and doesn't block anything. This spec is written now, ready to
hand to Claude Code the moment backend lands — not before.

**Scope decision (Guy, 2026-09-12): plan both integration points together in one
spec, launch all three key stages (KS2, KS4, KS5) together**, rather than phasing free
before paid or GCSE before A-level/KS2 the way Rolls itself was staged.

---

## 1. Purpose and scope

Build the front end for the Academic Results topic across both its real homes: the
free State of School snapshot card and the paid Member Data View's Academic tab.
Comparator-set selection (tick-list, named default lists, button row, "Add/subtract
schools" window) carries over from Rolls unchanged — same real mechanism, re-pointed
at academic data, not rebuilt. New comparator-set *types* specific to academic
outcomes (a GCSE-results quintile, a BTEC-heavy mix, a niche A-level offering) are
explicitly out of scope here — flagged in the topic spec §8 as a future round once the
platform's different user types are built.

---

## 2. Key stage as the top-level switcher, not a shared filter

**Corrected from the original "Key stage + subject family" filter framing (Guy,
2026-09-12): key stage isn't one filter among several, it's the primary navigational
axis.** A school offering KS2, GCSE, and A-level defaults to a switcher that moves
between all three headline views; most senior schools have two (GCSE + A-level), most
primary schools have exactly one (KS2). Which key stages a school has is already
determined by the existing shape typology (inherited unchanged, topic spec §8) — no
new gating logic needed, just reading what's already used to decide which sections
render on the public page.

**Below key stage, a second filter narrows by subject**: Category (subject family, the
8 real families from `subject_families`) → Subject area (an individual subject,
nested under a selected category) — the same UI pattern already built for Phase →
individual-age drill-down (an expand arrow, same pill/button styling), not a new
control shape.

The filter bar's job at all times: show which exam is currently in view, and which
others exist for this school.

---

## 3. Map — three depth levels, same component, narrower each time

Building Map first, mirroring how Rolls itself was built.

### 3a. Headline level (a key stage selected, no category/subject narrowed)

- **Circle size — population, not candidates (Guy's own explicit framing, 2026-09-12,
  chosen deliberately over entries or candidate counts because it's honest about what
  the number actually is)**: the single relevant age's population at that school —
  age 10 for KS2, age 15 for GCSE, age 17 for A-level/BTEC — read from the per-age
  census data already powering Rolls' own map (`ageGenderCounts`), not from the
  academic ingest, which has no candidate/cohort headcount field at all (checked
  directly against the real ingested columns — confirmed absent from both modern and
  historic KS4/KS5 headline sources). Legend caption always visible: "Circle size
  shows the number of [age]-year-olds at each school, not the number who sat exams."
- **Colour — two modes**:
  - **Trend** (default): change in the active headline metric since 2021/22
    (Attainment 8 / average points per entry / % meeting expected standard, depending
    on key stage), same validated diverging blue/red scale as Rolls.
  - **Grade band**: the real, already-ingested threshold field for that key stage —
    grade 9-4/9-5 at GCSE, AAB+ at A-level (`aab_percent`), expected/higher standard
    at KS2. No new computation needed for this mode at headline level — see §9 for the
    one open question this raises (which GCSE threshold is the default).

### 3b. Family level (a category selected, e.g. Sciences & Maths)

- **Circle size**: `entries_total` for that family at that school (already built into
  `academic_subject_family_rollup`) — a genuinely different quantity from population,
  and the legend must say so: "Circle size shows the number of exam entries in
  [family], not pupils — a pupil taking more than one subject in this group is
  counted once per entry."
- **Colour — two modes**: trend in the family's average point score since 2021/22
  (already computable from what's built); or % of entries in a grade band — **not yet
  buildable, flagged in §9**, since only average point score was computed, not a
  grade-band percentage.

### 3c. Subject level (one individual subject — paid, flat tier per topic spec §2)

Same mechanism as family level, one level narrower: circle size = entries for that one
subject; colour = trend in average point score, or % in a grade band (same open item
as family level, finer grain). This is where the "local competition" use case lands
hardest, per Guy's own framing: a head of department filtering straight to their own
subject sees the real map of nearby schools' results in it — directly answers the
"heads of department" persona flagged as blocked on this in the membership onboarding
spec.

---

## 4. Graphs — four sections, mirroring Rolls' shipped structure section-for-section

Not a new shape invented for this topic — the same skeleton Rolls actually ships,
adapted metric-for-metric.

1. **Overview** — the active headline metric (whichever key stage is selected) as a
   big stat, trend badge since 2021/22, spread/dot-strip of the ticked comparator
   group with this school marked. Direct swap-in for Rolls' "Current roll" card. Once
   a subject is drilled all the way down, this section also gains a real subject-level
   table (see §6) rather than living as its own separate page.
2. **Growth/decline since 2021/22** — same diverging bar chart, one bar per school in
   the ticked set, measuring change in the active headline (or family/subject) metric.
3. **Context over time** — replaces Rolls' market-share section, which has no
   academic-results analogue (schools don't have a "share" of exam results). Two
   charts instead: a trend line (target vs. ticked-group average since 2021/22 — the
   direct analogue of Rolls' "Roll trend") and a same-year bar comparing this school
   against every ticked school, target highlighted (also previews Rankings visually).
4. **Subject/family breakdown** (only once a category is in view) — an entries-share
   donut of this school's own mix across families (echoes the gender donut), a bar
   chart of average point score across the ticked set for the selected family (echoes
   "gender split across this set"), and a trend line of this school's own average
   point score in that family since 2021/22. Low-coverage families (Health & Care,
   Enterprise & Applied Studies — see the backend build's own `points_coverage_percent`
   finding) show entries-share and entries count normally; only the point-score figure
   is withheld, with the honest caption drafted in the summary-wordings doc §6.

---

## 5. Rankings

Matching Rolls' own cleaned-up single-metric shape (after its follow-up round dropped
girls_pct/boarding_pct/market_share and kept just `roll`): one ranked metric at a
time — the active headline measure — same Top 10 / Around this school / Bottom 3
chunking, target highlighted in place, same percentile/neighbour-window degradation at
Region/Nation scale (needs a new academic-specific RPC analogous to
`region_nation_rank()`, once `academic_geography_aggregate` exists).

**Explicitly named by Guy: rank-over-time, not just this year's snapshot** — reusing
Rolls' existing `rankAcrossPeriods` machinery to show whether this school's rank in
the group has climbed or fallen year over year since 2021/22.

**Open question, not assumed (see §9)**: whether a selected subject family becomes its
own separate Rankings entry, or family/subject metrics live only in Graphs — leaning
toward keeping Rankings to the one headline metric, consistent with Rolls' own
deliberate cut-down to a single ranked metric, but this is Guy's call.

---

## 6. Subject-level table — folded into Graphs' Overview, not a separate page

Once drilled to one individual subject (paid, flat tier), Overview gains a real table:
subject, entries, average grade/point score, value-added (KS5 only, with the same
confidence-interval framing discipline as everywhere else in this topic — never a bare
score). Small-cohort caveat below the project's minimum-N threshold (not yet decided,
same open status as the topic spec's own §6). This is the one place Academic Results
needs a genuinely new UI element Rolls has no equivalent of (a "list of things," not a
stat or a chart) — folding it into Overview rather than a sixth section/separate page
keeps a head of department's whole picture (number, trend, full comparator list) in
one place.

---

## 7. Free State of School page — "Academic snapshot" card

Snapshot only, no trend, no comparator context, no map — matches the page's own
governing rule (`vicdata_phase3_state_of_school_page_spec_v1.md` §2). Mirrors
`RollCard`'s shape directly: one line per key stage the school actually has (omitted
entirely for a key stage it doesn't have, same discipline as every other gated
section on this page), this year's headline figure only, plus a "become a member to
see how this compares" link-through. Exact candidate sentences are in the
summary-wordings doc §1.

---

## 8. Sentence and summary wording

Full candidate wording for every view above — free snapshot, Overview stat/trend,
spread-vs-comparator, growth/decline and context-trend captions, family/subject
breakdown, map legends, rankings, suppression/small-cohort caveats — is already
drafted in `vicdata_phase3_academic_results_summary_wordings_v1.md`, written ahead of
the build deliberately so Guy can edit wording on paper rather than in code once real
output exists.

---

## 9. Open items, flagged rather than guessed — needs a decision before or during build

- **Grade-band percentage at family/subject level doesn't exist as a computed field
  yet** — only average point score was built in the backend round. Needs its own
  small aggregation pass (group real entries by grade, divide) before the map's
  "grade band" colour mode can work below headline level. Not a blocker to building
  everything else — ship headline-level grade-band colouring first, add
  family/subject-level once this exists.
- **Which GCSE grade-band threshold is the map's default** — English & Maths
  (`engmath_94_percent`/`engmath_95_percent`) and EBacc
  (`ebacc_94_percent`/`ebacc_95_percent`) are two separate real fields; the map's
  colour-mode selector may need a third dimension (which basket) rather than picking
  one silently.
- **Whether subject-family metrics get their own Rankings entry** (§5) or live only in
  Graphs — leaning toward the latter, not assumed.
- **Minimum-N threshold** for small-cohort display suppression (topic spec §6) — still
  undecided.
- **KS5 qualification-mixing** (topic spec §4) — still open, affects whether the
  subject-level table (§6) splits by qualification type or shows them together.

---

## 10. Explicitly not in this round

- Vocational/BTEC point-score conversion (deferred — needs a new external Ofqual/UCAS
  tariff-table fetch, out of scope here and in the backend round alike).
- Any new comparator-set grouping type (results-quintile, BTEC-heavy mix, niche
  A-level offering) — future round, per topic spec §8.
- The Destinations topic.
- Touching hosted/production, or any change to existing Rolls behaviour beyond
  re-pointing the shared comparator-set mechanism at academic data.
