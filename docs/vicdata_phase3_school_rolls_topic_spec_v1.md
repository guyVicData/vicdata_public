# VicData — Phase 3: "School Rolls" Topic Spec (v1)
*Phase 3 of the platform build (roadmap §14). First topic fully spec'd against the your-school / your-context / school-in-context site structure — working template for academic results and social context once those are worked through the same way. Draft for review; several items below are explicitly marked provisional or open.*

---

## 1. Purpose and scope

Take the "school rolls" branch of the original site-structure sketch (`VC_website_structure_01.opml`) and turn it into a build-ready spec against what's actually in VicData's Phase 1 canonical schema — resolving data source, mechanism, and free/paid tier for every item, rather than leaving it as a topic outline.

**Explicitly not in scope here:** academic results, social context (next topics, same method); Phase 2 (VicDash, the consulting app — separate build, currently parked while this work proceeds); the lever model (consulting-only IP, never appears here).

---

## 2. Governing tiering principle

**Two axes, not one: subject (about the world / about this school) crossed with time (current snapshot / change over time).**

The original single-axis rule ("about the world is free, about you is paid") held for months but structurally couldn't offer a free page genuinely *about* the school someone searched for — it could only offer generic regional furniture next to it. Working through the actual public home-page/landing-page experience (a parent or head safety concern, worked through directly — see conversation history) surfaced the real rule underneath it:

| | Snapshot (now) | Trend (over time) |
|---|---|---|
| **About the world** | Free | Free |
| **About this school** | **Free** | Paid |

Only the **school-specific + trend-over-time** quadrant is paid by default. Everything else — world context regardless of time, and now also this school's own *current state* — is free **as a strong starting default, not an absolute floor**. Snapshot-vs-trend is the *signal* that a given fact is usually safe/appropriate to be free (low misreading risk, good for indexability); it isn't itself the justification, so a specific current-state fact can still be deliberately held back for an unrelated reason — competitive value to other schools, or simply working better as a conversion lever — decided per-item, same discipline as every other provisional tier line in this doc.

- Regional/national/local sector trends (any time axis) → **free**, unchanged from the original rule
- This school's own **current-year snapshot** (roll count, this year's shape, this year's gender/boarding split) → **free** — the new cell
- This school's own **historical line/trajectory** (roll trend, shape stability, gender/boarding trend over years) → **paid**, unchanged
- Market share, feeder pipelines, ranks, peer comparisons → **paid**, regardless of time axis — these sit outside the matrix entirely, tiered by curation effort (a built/saved comparator set is inherently a paid mechanism) rather than by subject or time. See §6.
- Smart-default comparator set (auto-suggested, not editable) → **free** carve-out, unchanged

**Why the new cell matters beyond tiering**: a current-state fact is structurally harder to misread as alarming than a trend line is — "450 pupils, shape: pyramid" states something, it doesn't imply a direction. This was decided partly *because* of that property, not just for growth-funnel reasons, in the course of working through what an anonymous (including parent) visitor should safely be able to see.

**Status: provisional**, same as before — this is the house rule now, but still due one holistic review pass once academic results, social context, and destinations are spec'd against it.

---

## 3. Topic breakdown: data source, mechanism, tier

### "Your school" — the school's own roll history

| Item | Data source | Status | Tier |
|---|---|---|---|
| Current roll (latest year, total + by age band) | DfE school census | Backfilled | **Free** |
| Roll trends (historical line, by age band) | DfE school census | Backfilled | Paid |
| Current shape classification (this year's snapshot) | DfE census, reshaped (see §4) | Classifier not yet built | **Free** |
| Shape stability / trajectory (multi-year) | Same, tracked across years | Not yet built | Paid |
| Current gender split | DfE census — **confirmed**: full breakdown by age, gender, full-time/part-time status | Data confirmed available | **Free** |
| Gender trend (multi-year) | Same | Data confirmed available | Paid |
| Current boarding split (day/boarder headcount) | DfE census — **confirmed**: total boarding roll + gender split, 7-year series, real movement (not just presence-confirmed). GIAS's own boarding fields are categorical only (see §8) and can't drive a trend. | Data confirmed available; **fix path confirmed** — needs a new helper in `dfe_school_census.py`'s own mapping dict, not a `source_field_mappings` row (§10) | **Free** |
| Boarding trend (7-year series) | Same | Same | Paid |

**Data ceiling, confirmed not a gap to fix:** no weekly/full/flexi boarding-type split exists anywhere in the source, mapped or not — "boarding trends" can only ever be a boarder/day figure, never finer boarding-type detail.

**Correction from original framing:** classification runs on **age bands, not year groups**. DfE census gives year-group breakdown for state schools only — independents report age only. Since the platform has to work across both sectors, age is the universal axis; state schools' extra year-group data is a bonus, not the standard. This also makes the shared school/geography taxonomy (§4) fully coherent, since geography-level population data is age-banded too.

### "Your context" — sector/geography trends, genuinely public

Unaffected by the two-axis split (§2) — this is "about the world" content, free regardless of time axis, both under the old rule and the new one.

| Item | Data source | Status | Tier |
|---|---|---|---|
| Regional shape/trends | DfE census aggregate, by region | Buildable now — **no ONS needed** | Free |
| National shape/trends | DfE census aggregate, national | Buildable now — **no ONS needed** | Free |
| Catchment trends — primary schools ("birthrate for primaries") | ONS births + postcode→MSOA | Still blocked — the one case that genuinely needs the original geography-engineering bottleneck (§5 of the Phase 1 ingest doc) | Free |
| Catchment trends — senior schools ("4-10s for seniors") | **Reframed** — see §5. No longer a raw-population question. | Depends on feeder-set mechanism | Free |

### "School in context" — comparative, sits outside the two-axis matrix

Tiered by curation effort, not by subject or time — a built/saved comparator set is inherently a paid mechanism regardless of whether it's shown as a current snapshot or a trend. Stays paid across the board even under the new tiering rule (§2).

| Item | Mechanism | Tier |
|---|---|---|
| Market share | DfE census entries ÷ ONS birth pool (public-data version); MIS-based version stays consulting-only | Paid |
| Feeder pipelines | Feeder Set mechanism (§5) | Paid |
| Ranks (roll-size, later academic) | Comparator Set mechanism (§6), filtered/self-selected — **not** a public leaderboard | Paid |
| Peer group trends | Comparator Set (§6) | Paid |

**Resolved**: the "how big are surrounding schools" free public snapshot (State of the School page) is the same Comparator Set geography-primary candidate-generation logic, consumed automatically and uncuratedly as an aggregate statistic — not a separate mechanism, and not the member-facing curated feature itself. See §4 and §6.

---

## 4. Shape typology

**Status: provisional throughout** — names, thresholds, and even the category boundaries are expected to move once run against real school profiles. Treat with the same discipline as `breakdown_taxonomy_versions` elsewhere in the schema: documented, versioned, not fixed in advance of real data.

- **Names**: descriptive, kept as-is — tube, pyramid/funnel, mushroom, wineglass, irregular. Decided deliberately over coined/branded names, even though the taxonomy is expected to become real product IP.
- **Axis**: age bands (not year groups — see §3 correction).
- **Granularity**: single-year snapshot for "shape" itself; a separate multi-year **stability trajectory** (sequence of yearly classifications) answers "is this deep-seated," not a smoothed average.
- **Applies in four contexts, one shared classifier**: the school's own age-band profile; a geography's age-band population profile (regional/national, LA-level); **local shape — the aggregate age-band profile of nearby same-type schools within catchment** (new, resolved below); each school in a comparator set.
- **Shared taxonomy** — same five labels for school and geography, confirmed deliberately, so "your shape vs your region's shape" is a direct label comparison, not a translation between vocabularies (school shapes vs. classic demography's expansive/constrictive/stationary).
- **Classification method reference**: a 2026 demography methods paper's bucket-transition approach (classify by the sequence of increase/decrease/stationary moves between age bands, not just start-to-end gradient) is a solid starting technical reference for the actual rule — worth Claude Code reviewing directly when building the classifier.
- **Precedent check**: no existing tool applies a named shape typology to school rolls specifically — genuine white space. The underlying metaphors are borrowed from established fields (demography's pyramid/column typology; organisational design's "hourglass" concept, structurally identical to "wineglass"), so they carry pre-existing intuitive recognition without needing new coined branding.

**Resolved:**
- **Headcount, not FTE-adjusted**, for the classifier at all age bands — matches DfE's own standard NOR metric (consistent with roll trends, §3, which already uses headcount), avoids inventing an unsupported FTE-conversion assumption on top of already-estimated data, and a genuinely large part-time nursery intake is treated as a real enrolment pattern rather than distortion to correct for.
- **Local/catchment-level shape classification is needed and meaningful** — genuinely different question from regional/national shape: "what's the shape of the total population of local schools" (e.g. birth-rate decline showing up as a narrowing base almost everywhere, a real pattern worth the classifier catching directly, not just a scalar trend number). **Public-tier mechanism, simple and fixed, distinct from the member-tier Comparator Set (§6)**: DfE census aggregate over the nearest 20 schools matching this school's own age band/phase and sector (state/independent), same simple candidate logic used for the State of the School page's "surrounding schools" stat — no adaptive radius, no sector-union, no member curation. **Exclusion filter, confirmed**: special schools are clean — `establishment_type_group = 'Special schools'` catches every one in a single filter. PRU/alternative provision is **not** clean — scattered across three different top-level groups (Academies, Free Schools, LA-maintained), needs substring matching on `establishment_type` instead of the group field. **Known edge case, not resolved**: "Secure units" (48 rows, structurally AP-like but named differently) slip through either filter as currently defined. **6th-form/FE data gap, confirmed and refined** — three-way split, not a single blanket gap: genuine FE-corporation-status institutions (Further education, HE institutions, sixth-form centres, special post-16 — 502 combined) have zero census facts, a real and permanent gap only closed once the academic-results topic (post-16 performance tables) is built; sixth-form colleges that converted to academy/free-school status have census coverage that varies a lot by establishment type and is **not** the clean "35/42, 35/36, 8 remaining timing-gap exceptions" this used to say — see §10 item 7 (corrected 2026-08-22) for the real, verified numbers: most Academy 16-19 converters (32/42) have real census data that stops at 2021 regardless of conversion date, not a small timing-gap exception set; most Free schools 16 to 19 (31/39) genuinely are current. GIAS lists all of these regardless of census coverage, so identification/location is never blocked, only roll-figure availability. Worth deciding how the nearest-20 count handles a candidate with no roll data available (skip and backfill to a 21st, or just show as fewer than 20). Worth an early classifier test case regardless: a recent-years narrowing specifically at the youngest band, driven by falling birth rates, doesn't cleanly match any of the five current shape names as defined — a real stress-test for the still-provisional taxonomy once built.

---

## 5. Feeder Set — replaces simple catchment radius for senior schools

**Reframe, not a refinement**: senior-school catchment isn't a geographic radius at all — it's the aggregate of confirmed feeder schools. This removes the ONS/MSOA geography-engineering dependency entirely for senior schools; that machinery is now only needed for primary schools' birth-rate catchment (§3), which has no feeder institution to substitute for the raw birth cohort.

**Mechanism:**
- **Adaptive target-count search**: radius expands until a target number of candidate feeder schools is found, rather than a fixed km lookup table per category (there's real ground truth for exactly two schools — LP and Woldingham — not enough to safely set a general-purpose static table).
- **Target count scales with the receiving school's own intake size** at that entry point (bigger senior schools need a bigger candidate net).
- **Run separately per sector** (independent candidates, state candidates), each converging at its own natural radius given very different densities, then unioned into one candidate list.
- **Separate per entry point** (Y7, 6th form, etc.) — not one catchment per school. Each entry point gets its own candidate search and its own confirmed feeder set. Schema implication: a feeder-link needs an `entry_point` field, not just `feeder_urn`/`receiving_urn`.
- **Two discovery modes**: the geographic candidate list (default) plus manual search/add, for known relationships the geographic net wouldn't surface (a known distant boarding feeder, a word-of-mouth relationship).
- **Self-correction**: school opens up or closes down the radius, then confirms which candidates are genuinely theirs.
- **Boarding**: no special-case mechanism needed — real UK boarding catchments are tighter than commonly assumed, so the same target-count search should surface a realistic radius on its own; self-correction handles genuine outliers.
- **Free side benefit**: "nearby schools not currently feeding you" is close to free, since it's just the candidate list minus confirmed feeders — a genuine admissions insight, worth surfacing as its own named view rather than treating as incidental.
- **Intake-size input is itself an estimate, not a published fact** — see §7.

**GDPR read**: confirmed safe at the relationship level — "School A feeds School B" isn't personal data, and every input (DfE census counts) is already independently public. The one caveat carried forward: if this ever surfaces raw pupil *counts* per feeder link rather than a relationship or percentage, the same small-number suppression discipline used elsewhere in the schema applies.

---

## 6. Comparator Set

Same underlying UX pattern as Feeder Set (candidate generation → curate into a named, saved set → multiple sets), deliberately reused rather than inventing a separate interaction model — but with different candidate logic and no directionality.

| | Feeder Set | Comparator Set |
|---|---|---|
| Candidate generation | Radius-first (adaptive target-count) | Attribute-filter-first by default: sector, phase, boarding status, size band — **geography can also be the primary filter** ("local rivals" — same schools within catchment as peer comparators, not feeders) |
| Geography | Primary axis | Usually optional narrowing filter; primary axis for the "local rivals" use case |
| Entry point | Yes — separate set per entry point | No — whole-school comparison |
| Relationship | Directional (feeds into) | Symmetric (measured against) |

**Resolved: two genuinely separate mechanisms, tier-divided, not one reused across both.** "Local rivals" as a **member-tier** Comparator Set configuration (adaptive target-count search, geography as primary filter, self-curated and saved) stays exactly as designed above — unchanged. The **public/free tier** gets its own, deliberately simpler mechanism instead — nearest 20 schools matching age band/phase and sector, no adaptive radius, no curation, no member action (full detail in §4's local shape resolution and the State of the School page spec). Correction from an earlier draft of this section: the public statistic does **not** reuse Comparator Set's candidate-generation logic — "simple for the public tier" was an explicit, deliberate instruction, not an implementation detail assumed to fall out of the member-tier mechanism.

**New direction, not yet spec'd**: rather than a single auto-suggested default set, the plan is **multiple suggested starting sets** (e.g. "local rivals," others by size band or boarding profile) that a member can pick up and then customise/save — an evolving part of the product, not fully designed yet. Worth revisiting the existing "smart default" language below once this is worked through properly, since it may end up being one of several suggestions rather than the only one.

- **Framing**: self-directed, not a public leaderboard. No default "vs everyone" view, no sortable national ranking — the product answer is "how do you sit against schools *you've* chosen," never a newspaper-style table. This is a deliberate UX constraint, not just a tone note.
- **Consumers**: roll-size ranks now; academic ranks later (once that topic is spec'd); peer group trend overlays; an alternative "share of this set's combined intake" framing for market share.
- **Security read, confirmed**: using only already-public per-school aggregates (DfE census counts) for ranking/comparison sits outside the roadmap's parked "cross-school aggregation" hard-line — that item was written for the case of combining schools' *private* submitted data (e.g. MIS-derived numerators) into a new benchmark, which is a different risk category (k-anonymity + controller-status) from re-displaying independently public numbers side by side.

**Resolved (previously listed as open here, closed out later in the same working session — see membership spec §5 for the full account-level detail):**
- Free-tier default set / geography-by-default question: effectively moot once the public/member split was corrected above — the public tier never uses Comparator Set's candidate logic at all, so there's no "free-tier default set" living inside Comparator Set to configure.
- Paid-tier caps: **3 personal sets per individual member, editable; unlimited for admin-owned/school-shared sets.** A separate school-admin role (distinct from account holder) can create and manage shared sets on top of members' personal ones.

---

## 7. Intake-size estimation (new, needed by both §5 and market share)

DfE census gives **whole-school age/year totals only — no entry-specific intake figure** (e.g. no direct "Y7 entrants this year" field). This affects both the Feeder Set target-count scaling (§5) and the public-data version of market share (§3).

**Working method**: cohort-progression — track a specific age cohort across consecutive census years; growth beyond what natural year-on-year continuity would predict is the net external intake at that transition (e.g. a jump from 85 ten-year-olds to 140 eleven-year-olds a year later implies roughly 55 external joiners).

**Must be presented as an estimate, not a fact** — consistent with the roadmap's existing "ranges not point estimates" honesty principle for the free tier. This also reinforces the platform/consulting boundary cleanly: the public-data version gives a good estimate; the precise figure is exactly what MIS data provides, and that's consulting work, correctly outside this project's scope.

**Status: not yet built or validated** — this is new engineering, not a data check.

---

## 8. Data-quality notes and a child-protection design principle

Three findings from checking boarding data against real schools (Charterhouse, Woldingham, Leighton Park), worth carrying forward as standing rules rather than one-off notes.

**GIAS's boarding fields are categorical only, not a trend source.** `Boarders` is a fixed 6-value enum (N/A, no boarders, children's home, boarding school, college/FE residential, blank); `BoardingEstablishment` is a simpler 3-value flag. Neither carries a number — all three test schools show identically as "Boarding school / Has boarders" regardless of whether they have 130 boarders or 900. Confirmed role: GIAS is a static routing flag (does this school board at all, so should it get a boarding-trends section); DfE census is the only source that can actually drive the trend chart. Not two candidates for the same job.

**GIAS's numeric fields appear to refresh ahead of their own `CensusDate` metadata** — `NumberOfPupils` matched none of the three test schools' figures for the year its recorded `CensusDate` implied, but matched all three exactly against DfE census's most recent year instead. Worth a `known_limitations` entry on the GIAS source generally, not just for boarding — anywhere else in the schema that assumes a GIAS field is "as of" its recorded date could be similarly wrong.

**Woldingham's DfE census data has a small internal inconsistency** (male + female boarders occasionally sums to one more or less than the published total) — confirmed as a pre-existing source quirk, not a vicdata ingestion bug. **Decision: trust `total` over summing the gender split.** Logged as an unexplained arithmetic inconsistency in `known_limitations` — deliberately **without** a hypothesis attached, even a plausible one, per the principle below.

### Child-protection design principle: single-sex-school gender-count suppression

**Scoped specifically to this case, not a general schema-wide small-number rule** — deliberately, so the reason for the rule stays legible to anyone reading the spec later, rather than being buried in generic technical hygiene.

**The risk:** at a nominally single-sex school, a small non-dominant-gender count in an age band — whether from an arithmetic inconsistency or simply a real, small, non-conforming enrolment — can narrow down to a specific pupil. This applies to day numbers as much as boarding, and applies even when the underlying data reconciles perfectly; the count itself is the risk, not just discrepancies in it.

**Documentation discipline (applies now):** any such arithmetic inconsistency gets logged as an unexplained source quirk only. Never with a causal hypothesis attached, even an accurate and clinically-phrased one — a documented theory about *why* a number doesn't add up is itself a disclosure risk if the document is ever seen more widely than intended (future hires, an ICO query, due diligence).

**Display discipline — proposed, not yet built (to-do):** suppress a small minority-gender count in an age band based on its **proportion** within that band, not its absolute count. Absolute thresholds would wrongly suppress small schools' genuinely structural cohorts (e.g. a real, deliberately mixed sixth form at an otherwise single-sex school, which can legitimately be 10-40%+ of that age band). Working hypothesis: a very low percentage (1-2% range) in an age band the school is otherwise single-sex in reads as individual rather than structural — needs empirical validation against real DfE census data before a threshold is fixed, not set from first principles. Needed specifically for the "your school" gender-breakdown display (§3); not yet built.

---

## 9. Presentation export — pattern to reuse from VicDash

VicDash (Phase 2) already has a working, verified presentation-export feature (Milestone 10): `window.print()` + a `@media print` stylesheet, not a PDF-generation dependency — keeps the export local-only, nothing rendered server-side. Scoped to whichever single view/tab is currently open, not a combined multi-section report (that was deliberately left as a bigger, unattempted job). Real lessons worth carrying forward: a timing bug where the print-palette revert raced `window.print()`'s return (fixed via the `afterprint` event, not immediately after calling print), and a print-only summary line added so an exported view shows what assumptions/filters produced the numbers, not just the numbers themselves.

Worth reusing this exact pattern for Phase 3's own presentation-ready export (roadmap §5), including the "show your filters/assumptions on the exported view" lesson — directly relevant once comparator sets and feeder confirmations mean an exported chart's meaning depends on a school's own curated selections.

---

## 10. Claude Code checks — resolved and outstanding

**Resolved this round:**

1. **GIAS location data** — better than scoped: real Easting/Northing (BNG, directly convertible, no geocoding step needed at all), plus **pre-computed MSOA/LSOA already keyed the way VicDash's existing lookup expects.** Removes an entire piece of previously-assumed engineering (the postcodes.io geocoding step). Not yet mapped into `school_entities` — a mapping gap, not a source gap.
2. **GIAS attribute fields** — confirmed present in the raw file, none mapped except sector/type: phase, boarding (`Boarders`, `BoardingEstablishment` — both categorical, see §8), age range (`StatutoryLowAge`/`StatutoryHighAge`), and size (four separate fields: capacity, total pupils, boys, girls).
3. **Boarding status as a DfE census breakdown value** — confirmed present in the raw file (total + gender split, real 7-year movement). **Fix path now confirmed** (see item 5) — needs a new helper in `dfe_school_census.py`'s own mapping dict, not a `source_field_mappings` row.
4. **Part-time/FTE handling** — resolved: classifier uses headcount, not FTE-adjusted, at all age bands (§4).
5. **`source_field_mappings` — confirmed a genuine gap, not a deliberate bypass**, with a clear practical consequence. Traced directly: `dfe_school_census.py` calls neither `check_field_mappings` nor `edit_field_mapping` in either era — no documented exception exists, and the schema's own build-plan doc names DfE census by name as the example this table exists to serve. **Practically**: both eras build column mapping as a plain in-process Python dict, which never queries `source_field_mappings` at all — inserting a row there would have **zero effect**. The boarding mapping (item 3) needs to go into the module's own dict directly, alongside the existing age/year-group helpers.
6. **Non-mainstream exclusion filter for the "nearest 20" mechanism (§4) — confirmed, with one open edge case.** Special schools: clean, single-field filter (`establishment_type_group = 'Special schools'`). PRU/alternative provision: not clean — scattered across three top-level groups, needs `establishment_type` substring matching instead. Open edge case: "Secure units" (48 rows) are AP-like but named differently, and slip through either filter as currently defined.
7. **6th-form/FE census coverage — corrected 2026-08-22.** The original "35/42, 35/36,
   8 remaining timing-gap exceptions" framing (this item's earlier text, and the shorter
   duplicate of it in §4) was wrong; both are superseded by the real numbers below.
   Investigated for real (Worcester Sixth Form College, URN 144888, surfaced this while
   chasing an unrelated "no surrounding schools section" bug — see the vicdata ingest
   repo's `docs/OPEN_QUESTIONS.md`, 2026-08-21/22 entries, for the full trail) by querying
   real current census coverage for every one of the 81 real institutions across both
   converted-sixth-form-college establishment types, not assumed from the original
   headline ratio:

   | Establishment type | total | fully current (2025) | stale (has data, but &lt;2025) | zero census data |
   |---|---|---|---|---|
   | Academy 16-19 converter | 42 | 3 | 32 | 7 |
   | Free schools 16 to 19 | 39 (not 36) | 31 | 6 | 2 |

   **The real picture is the opposite of what "35/42 covered" implied.** For Academy
   16-19 converters specifically, only 3 of 42 have census data through the current year
   -- the other 32 (the large majority of the whole establishment type, not a handful of
   exceptions) have real census data that stops dead at 2021 (one at 2020), regardless of
   how long ago they converted (Shooters Hill converted 2012, still stops at 2021 -- this
   is not correlated with conversion recency the way the old framing assumed). Free
   schools 16 to 19 are the opposite case -- most (31/39) genuinely are current. The
   7 Academy 16-19 converters with zero census data at all are genuinely all 2024-2025
   conversions (Queen Elizabeth Sixth Form College, The Sixth Form College Colchester,
   Long Road Sixth Form College, The Blackpool Sixth Form College, Hills Road Sixth Form
   College, The College of Richard Collyer In Horsham, Franklin Sixth Form College) --
   this part of the old framing (a genuine, benign timing gap for very recent conversions)
   was correct, just miscounted (7 real cases, not 8 -- Durham Sixth Form Centre,
   converted 2023-11, was likely miscounted into this group before; it actually has full
   current coverage since it opened, 2023-2025).

   **A real, checked, not-yet-actioned option for closing the 32-institution stale-data
   gap**: cross-referenced all 47 stale/zero institutions' UKPRNs directly against the
   real `dfe_fe_participation` source's underlying file (the same ILR-derived "Further
   education and skills" `national_provider_summary` file, built 2026-08-21 for the
   genuine FE-corporation gap) -- **42 of the 47 have real, plausible, smoothly year-on-
   year-trending `education_and_training`/Under-19 figures for exactly the years their
   census data goes missing** (2022/23 onward). This is a real, available data option,
   not wired into this topic or any display -- deliberately not blended into the roll
   figure these institutions already show (mixing a school-census point-in-time headcount
   with an ILR participation count for the same "roll" label would be exactly the kind of
   silent conflation this project has avoided everywhere else). A genuine product decision
   for Guy, not decided here.

   GIAS lists all of these regardless of census coverage, so identification/location is
   never blocked, only roll-figure availability -- unchanged from the original framing.

**Still outstanding:**

- Mapping GIAS's confirmed-present fields (items 1, 2) into `school_entities`.
- Adding the boarding mapping to `dfe_school_census.py`'s own dict (items 3, 5 — fix path now known, not yet done).
- The proportion-based single-sex suppression threshold (§8) — flagged as a to-do, not yet built or validated.
- The Secure Units edge case in the exclusion filter (item 6) — flagged, not resolved.

---

## 11. Summary of what changed from the original OPML sketch

- "Your context" catchment trends move from Membership to **Free** (tiering principle, §2) — a deliberate revision from the OPML's own original tag.
- Senior-school catchment is **feeder-based**, not radius-based — removes the ONS/MSOA dependency for that case entirely (§5).
- Regional/national shape needs **DfE census only**, not ONS — a real scope reduction from the original assumption.
- "Ranks" (originally undefined) resolved as a **Comparator Set consumer**, not a standalone feature (§6).
- Shape classification runs on **age bands**, not year groups — a correction driven by real data coverage (independents report age only).
- GIAS geography data confirmed **better than scoped** — real BNG coordinates plus pre-computed MSOA/LSOA, removing the geocoding step entirely (§10).
- Boarding data source confirmed: **GIAS is routing-only, DfE census is the only trend source** (§8) — resolves an item that was open at first draft.
- A **child-protection design principle** (single-sex-school gender-count suppression, proportion-based) added as a direct result of a real data-quality check, scoped deliberately rather than generalised (§8).
- **The governing tiering principle became two-axis, not one** (§2) — the single biggest structural change since first draft. Every "your school" row now splits into a free current-state version and a paid trend version. Directly enables a new artifact: a free, cross-topic "State of the School" public landing page — see the companion spec, `vicdata_phase3_state_of_school_page_spec_v1.md`.
