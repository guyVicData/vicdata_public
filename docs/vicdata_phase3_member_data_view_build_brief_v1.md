# VicData — Phase 3: Member Data View — Claude Code Build Brief v1

*This is the execution brief for an autonomous Claude Code build session. It consolidates `vicdata_phase3_member_data_view_spec_v1.md` (the design spec), `vicdata_phase3_school_rolls_topic_spec_v1.md`, `vicdata_membership_area_ideas_v1.md`, `vicdata_phase3_membership_onboarding_spec_v1.md`, `vicdata_ingest_schema_and_build_plan_v2.md`, `roll pipileine geolocation.md`, and `vicdata_shape_panel_wording_sharpening_v1.md` into one build-ready document, against the real repo. Where those documents disagree with anything below, this brief wins — it was written last, specifically to be handed to a coding session.*

**Visual/interaction reference**: the wireframe (5 artboards: Dashboard shown twice with two different comparator-list types, Map, Rankings, plus a rejected alternative-structure sketch kept for comparison) — published as a Claude artifact. Read it before writing any UI code; it settles layout, card treatments, and the shared-filter architecture that this brief describes in prose.

---

## 0. How to run this build (read this first)

**This is an autonomous session. Guy will not be available to answer questions while you work.** Do not stop and wait for clarification at any point. Instead:

1. When you hit a genuinely ambiguous decision (the brief and the linked specs don't settle it, or two parts of the source material disagree), make the most reasonable call you can, consistent with: (a) this brief's explicit resolutions, (b) existing codebase conventions — check how similar things are already done before inventing a new pattern, (c) the product principles restated in §1 below.
2. Log every such decision to `docs/vicdata_data_view_open_questions.md` (create it if it doesn't exist) as you make it — not batched at the end. Each entry: what the question was, what you decided, why, and one line on what would need to change if Guy decides differently later. Keep building on top of your own decision; don't revisit it later in the same session unless new information directly contradicts it.
3. Do the same for anything you discover mid-build that isn't a design ambiguity but a real finding — a bug, a data-quality issue, a missing field, a repo convention this brief didn't anticipate. Log it in the same file under a "Findings" section, distinct from "Decisions."
4. Keep going until the full scope in §3 is built, wired to real data, and passing whatever this repo's existing checks are (typecheck, lint, tests, build) — "get to the end," not "stop at the first fork." If something in scope turns out to be genuinely blocked (a hard external dependency, missing credentials, a decision only Guy can make because it's irreversible or high-stakes — e.g. a schema choice that's expensive to migrate away from later), say so explicitly in the log, do as much of the surrounding work as you safely can, and move on to the next thing rather than stalling the whole session.
5. At the end, produce a summary: what was built, what's in `docs/vicdata_data_view_open_questions.md`, what's left (if anything), and how to verify it manually (which schools to look at, what to click).

This protocol matters more than any individual decision below — a wrong-but-logged, reversible guess that let the build keep moving is the right outcome; a stalled session waiting on an answer nobody's there to give is the wrong one.

---

## 1. Product principles (carry these through every decision)

- **Two products, one foundation, kept apart**: this build is the membership platform (broad, low-friction, no pupil-level data). Victoria Consultancy's bespoke modelling is a separate, small, high-touch service — nothing here should couple to it, and branding must stay genuinely separate (§9).
- **No leaderboard, ever**: no default "vs everyone" view, no sortable national ranking. Every comparison is against a set the member chose (a VicData-recipe default, or self-curated). This is a hard UX constraint, not a style note.
- **Self-directed, tick-list-driven**: one tick-list per comparator set is the single mechanism for both "show me context" (all ticked) and "compare me to just these" (unticked down to a few) — never build a separate "compare to" control.
- **Trend over shape**: real 2019→present trend data is the headline story now available; shape classification is real but minor — one inline fact, never a comparison axis, never its own card or ranked list.
- **No free individual tier**: the whole Data View is paid-member content as a unit. Don't build a "free preview" state for it.
- **Never assert what the data can't support**: every caption/label discipline already decided in the spec (market-share's group-share caveat, the through-school phase recompute, the shape-change explanatory text gap) must survive into both the live UI and the exported PDF (§9).

---

## 2. Prerequisite fixes — do these first, before building the filter bar or any default list

These are called out in the source docs as things that will silently corrupt member-facing output if not fixed before phase/boarding become directly clickable filters. Fix and verify each with real data before starting §4.

1. **Wire `effectivePhaseTags()` into the matching pipeline.** `findSurroundingSchools()` (`src/lib/surrounding-schools.ts`) and any comparator-list logic currently reason from raw `phaseTags()`, which nominal-tags a through-school like Woldingham (statutory age 10–19, but zero real pupils below age 11) as `["Junior","Senior"]` instead of the real `["Senior"]`. Wire `effectivePhaseTags()` in wherever a *target* school's own phase is being determined for list-building purposes. Verify against Woldingham (URN 125369) and Stockport Grammar School (a genuine through-school) directly.
2. **Fix the through-school candidate-pool bug in `findSurroundingSchools()`.** It currently admits a candidate on "shares at least one phase tag with the target" — for a 2-tag through-school target this lets a single-tag Senior-only candidate in via the shared tag alone. Fix: when the target has more than one phase tag, also require the candidate to have more than one phase tag. Keep this on raw `phaseTags()` for candidates (per the existing scoping note in `vicdata_shape_panel_wording_sharpening_v1.md` — this module doesn't fetch per-candidate census data, so it can't compute `effectivePhaseTags()` per candidate cheaply); this is a deliberate scoping choice, not an oversight — log it as a decision carried forward, not a new one.
3. **Apply the nursery/PRU exclusion at source**, not per-recipe. `phaseTags()` currently assigns `"Junior"` to any school with `lowAge<=10 && highAge<=11`, without checking the low end, so age-0-5 nursery schools and PRUs collide with genuine age-3-11 primaries on the same tag. Exclude `establishment_type` "Local authority nursery school" and "Pupil referral unit" (confirm exact GIAS category strings against the real data) inside `phaseTags()`/`sectorTag()` itself so every consumer gets it for free, per the "fix at the source" instinct already decided for the through-school case. Verify against Yerbury Primary School (URN 100429) — the nearest-10 query for it must not return Margaret McMillan Nursery, Kate Greenaway Nursery, North Islington Nursery, or New River College Primary (a PRU).
4. **Investigate the boarding-ratio anomalies before wiring any boarding-ratio filter.** Downe House shows a 104% boarding ratio, Benenden 111% — a boarders headcount exceeding the whole-school roll, which is impossible. This round's default lists (List 3 for boarding schools, §6 below) genuinely depend on boarding ratio, so this is now load-bearing, not cosmetic. Check whether it's a period mismatch between the boarders figure and the age/gender total in the DfE census ingest, or a genuine source inconsistency. If you can't fully resolve the root cause in-session, apply an interim safeguard (cap displayed/used ratio at 100%, and flag any school whose raw computed ratio exceeds 100% for manual review) and log it as a finding — don't let one unresolved data-quality issue block the rest of the boarding-list logic.

---

## 3. Scope for this build round

**In scope**: the Rolls-topic member Data View — shell, shared filters, Map, Dashboard, Rankings, the full default-comparator-list generation logic (§6 of the spec), and PDF export for these three views. Both Dashboard wireframe examples (Charterhouse on a boarding-quintile set, Acland Burghley on a plain nearest-10 set) are the same view — build one Dashboard, prove it against both kinds of list during verification.

**Explicitly out of scope, do not touch**: Academic/Destinations/Context topic content (tabs render, greyed, non-clickable, with submenu chevrons where the public page already shows them — no actual content behind them yet), the Custom view (a real, visible, dashed "+ Custom" menu slot — not built, not hidden, not clickable), account pages, the join/onboarding flow, admin/role views, the Sets-page redesign (a separate, already-scoped piece of work in the ideas doc — don't merge it into this build even though it touches the same `saved_sets`/VicData-sets table question in §6.1 below).

---

## 4. Shell and shared state

- **Topic tabs**: Rolls (active), Academic / Destinations / Context (greyed, chevron submenus where the public page pattern already has them).
- **Sidebar — comparator set**: named set (VicData-recipe or self-curated) + tick-list of member schools + sort indicator (e.g. "sorted by distance (km)", showing the value driving that sort) + "more in this set" overflow (ticked-off, expandable) + search-to-add (reuse `SchoolSearch.tsx` — no new search UI) + "Edit set" action.
- **Tick-list is the only comparison mechanism.** No separate "compare to" control anywhere in Dashboard, Rankings, or Map.
- **Shared filter state — one state, three consumers.** Phase/age, gender, and boarding-status filters live above Map/Dashboard/Rankings, not inside any one of them; switching views must never reset or diverge the active filter. This was confirmed necessary (not just convenient) by the through-school/sixth-form case in §7.
- **Phase filter reuses the existing phase mechanism** (Early Years / Junior / Senior / 16+), with individual ages as an expandable drill-down nested under a selected phase band (same pill styling, an expand affordance) — not a separate flat age filter.
- **View switcher**: Map | Dashboard | Rankings | **+ Custom** (visible, dashed/reserved, disabled).
- **Default landing state on login**: Map view, with the member's school's **Nearest 10 (any LA)** set (List 1, §6) pre-selected — not a specialised list like a boarding quintile, which a member navigates to deliberately.
- **Map's filter bar is a floating, collapsible overlay** (it must not permanently consume the full-height map), consolidated with the view switcher in one overlay bar per the wireframe. Dashboard and Rankings show the same filter bar in-flow, not floating (they don't have the map's vertical-space constraint).
- **Tier**: the whole Data View requires an active paid membership. There's no free/individual-tier variant of any of this to build.

---

## 5. Dashboard

| Card | Behaviour |
|---|---|
| Current roll | Headline stat + real ▲/▼ trend badge since 2019 + spread/dot-strip of the ticked group by roll, target marked as a distinct reference dot. Shape folded in as one inline line here (see below) — no separate card. |
| Roll trend | Two-line chart: target (solid) vs. average of the ticked group (dashed), since 2019. |
| Gender split | Trend badge + spread/dot-strip by % girls, target marked. |
| Boarding split | Trend badge + spread/dot-strip by % boarding, target marked. For a day school (0% boarding), state plainly that boarding isn't a meaningful axis for this school rather than rendering a degenerate/empty chart. |
| Market share | Target's roll as a % of the ticked group's *combined* roll (segmented bar, target's segment highlighted) — **not** the ONS-birth-pool definition from the rolls topic spec. Caption must state explicitly that this moves with the member's own selection and isn't a claim about the total local market. No ONS dependency. |

**Shape**: a single inline fact on the Current Roll card only — e.g. "Tube-shaped (unchanged since 2019)" or "Pyramid → Tube since 2019." Never a dedicated card, never a grouped/ranked comparison. Explanatory copy for a shape-change event is a real follow-up task, not required to ship this round — if you reach it and don't have good copy, ship a plain factual line and log the gap rather than inventing marketing copy.

**Through-school / sixth-form behaviour**: with no phase filter active, show whole-school totals (two through-schools' totals are genuinely comparable). Setting the phase filter to Senior/Junior/16+ must recompute *every* school's value in the set to just that phase's headcount — a through-school collapses to just its relevant department's number. A compact size-band label (e.g. "Large overall · Medium as a Senior school") is a good way to surface the discrepancy when it's non-trivial.

---

## 6. Default comparator lists

Every school gets defaults built on `findSurroundingSchools()` (post-§2 fixes) — same phase and sector as matching criteria on every list, plus the relaxed gender rule (coed accepts any gender; single-sex accepts its own sex plus coed, never the opposite single-sex). Independent Junior-phase schools are labelled **"Prep"** in the UI even though the match is just phase=Junior + sector=Independent.

| School type | List 1 — nearest 10 (crosses LA boundaries) | List 2 — in Local Authority | List 3 |
|---|---|---|---|
| State (any phase) | Same phase, state only | Same phase, all sectors | — |
| Independent, day (inc. Prep) | Same phase, independent only | Same phase, all sectors | — |
| Independent, boarding (Senior) | Same phase, independent only | Same phase, all sectors | National boarding-population quintile: quintile the national boarding-Senior population (candidate pool per the Charterhouse recipe below) by real boarding headcount, take the 10 nearest within the target's own quintile (top 2 quintiles: unbounded catchment) or a combined lower-quintile group within 30km (bottom 3 quintiles) |
| Independent, boarding (Prep) | Same phase, independent only | Same phase, all sectors | Same quintile approach, but quintiled by **% boarders (ratio)**, not raw headcount — prep-scale boarding numbers are too small for absolute quintiling to differentiate |
| State boarding | Same phase, state only | Same phase, all sectors | State-boarding population — **not yet sized**; do a real count first (see §8), and if the population turns out too small/structurally different to quintile sensibly, log that finding and ship without List 3 for this type rather than forcing a bad recipe |
| FE college | FE only | **All 16+ provision in the borough** (not "all sectors" — an FE college isn't comparable to a primary school) | — |

List 2 is always LA-bounded and open to all sectors *except* FE colleges' List 2, which is phase-scoped (16+) instead of sector-open.

### 6.1 The boarding-quintile recipe (List 3, Senior) — proven shape, real data

This is the Charterhouse-tested recipe; reuse it exactly rather than re-deriving:

1. Candidate pool: `establishment_type_group = 'Independent schools'`, not closed, `boarders_name` not null and not "No boarders" (GIAS categorical) — real-world size ≈403.
2. Nominal same-phase pre-filter (Senior, through-school-aware, using the post-§2 fixed logic) before the expensive per-school census fetch — cuts to ≈264.
3. **Batch the per-school census fetch in chunks of 40.** A live, unbatched fetch at ≈264 candidates hits a real Postgres statement timeout — this is a known, already-diagnosed limit, not a new bug to rediscover. Batching in chunks of 40 was already proven to work; don't reach for a precomputed table for this round (that's a real, separate piece of engineering — see §8) unless batching alone genuinely can't keep this responsive at production concurrency, in which case log that finding rather than silently shipping something slow.
4. Filter to genuinely Senior-only (effective phase) with a real, non-zero boarding population — real-world size ≈103.
5. Quintile by real boarding population (`boarders_total`), not whole-school roll — ranking "biggest as boarding schools specifically," which whole-school roll doesn't capture.
6. Within the target's own quintile, sort by real distance; top 2 quintiles get an unbounded catchment, bottom 3 quintiles combine into one group and cap at 30km.

### 6.2 VicData Sets — schema decision needed

"VicData sets" (platform-provided recipe templates, as opposed to a school's own saved sets) don't exist in the schema yet — every `saved_sets` row today requires a `school_account_id`. This needs a real table design (a set that isn't owned by any one school, and is a *recipe* — profile-matched, e.g. by boarding-population quintile — rather than a fixed curated list of URNs). This is exactly the kind of decision §0's protocol is for: make the call, document the schema and why, log it to the open-questions file, and move on. Don't block the rest of the build on getting this "approved" first.

---

## 7. Rankings

Same cards as Dashboard, re-rendered as ranked lists, same tick-list/filter scope. Target's row highlighted in place (not pulled out of order) plus a one-line "ranks #N of M" summary. **Shape does not appear here at all.**

- **Small/medium sets** (the normal case — every default list above runs ~10; self-curated sets can be larger): literal ranked list.
- **Large sets** (regional/national scale — not reachable through any default list built this round, since none of them are unbounded/national in a way a member browses directly, but build this defensively since a large self-curated set is possible): switch the headline from raw rank to **percentile** ("top 28%"), and show a **window of neighbours around the target's own position** rather than the whole set. At real scale this converges with Dashboard's spread/distribution treatment (same spread-with-reference-marker visualization, percentile label instead of "spread of your ticked group") rather than inventing a separate large-N UI.
- **Ties**: shared rank (standard sports-table convention — two schools both "#3," next is "#5").
- **Sort direction**: fixed sensible default per metric (bigger roll / higher growth / higher boarding % all descending) — no per-metric toggle this round.
- **No minimum set-size floor** — even a small, deliberately curated set is worth ranking against.

---

## 8. Map

- **Bivariate encoding**: marker **size** = current count of whatever's currently filtered, rescaled to that filtered metric's own range (a narrow filter like "11-year-old girls" must not render illegibly small against a scale calibrated for whole-school rolls). Marker **colour** = trend in that same filtered count, 2019→present. Filtering never changes what colour means — only what the trend is measured on.
- **Two required legends, both visible at once**: the colour/trend key and a separate size key.
- **Colour-by modes** (exclusive, one at a time): **Trends** (default — colourblind-safe blue↔red diverging scale, blue = growing, grey neutral midpoint; wire this into project-level colour tokens, not hardcoded per-component, so a later design pass can retune it) and **Sector** (for the wide/unfiltered browsing case — building a new set from scratch). No third "shape as icon" mode — dropped, consistent with de-emphasising shape.
- **Target marker** needs a ring/outline treatment independent of fill colour, since fill colour is doing real encoding work.
- **Filter bar floats over the map and must be collapsible** (see §4).

---

## 9. PDF export

- **Reuse VicDash's existing pattern** (`window.print()` + a `@media print` stylesheet — no PDF-generation dependency, nothing rendered server-side; Phase 2 Milestone 10). **Repo-check first**: confirm this is still the live pattern, and specifically whether it's been proven against a map view (VicDash's original scope was a single view/tab, not necessarily a map) — the print-palette/`afterprint`-timing bug from that build is a known gotcha to carry forward, not rediscover.
- **Branding**: this must render as VicData, never Victoria Consultancy or VicDash. If the existing exporter's output currently carries either of those, this needs a genuinely separate identity — not a shared template with a swapped logo. Check this directly against the real output before assuming a simple logo swap is enough.
- **Gating**: paid members only, applies to Map, Dashboard, and Rankings.
- **Carry forward the "show your assumptions" lesson**: the exported view must include a print-only summary line stating which comparator set and filters produced the numbers on the page — and every caption discipline already live in the UI (the market-share caveat, the through-school recompute note, etc.) must survive into the PDF, not just the screen.

---

## 10. Follow-ups — real, but not blockers to shipping this round

Log these to the open-questions file as known-outstanding rather than trying to resolve them all in this session:

- **Precompute/materialised table** for regional/national-scale ranking or map rendering. Small/medium curated sets (a few dozen) can stay live-computed as designed; the batched-fetch approach in §6.1 is the interim answer for now.
- **State-boarding population** is genuinely unsized — do a real count as part of building that row of §6's table; if it's too small to quintile sensibly, ship without a List 3 for that type and say so.
- **Small-number territory**: fine-grained filters (single age × gender × boarding status) will hit genuinely small or zero counts at some schools — both a map-legibility problem and a candidate for the suppression discipline already applied elsewhere (feeder-link counts, single-sex gender-count suppression in the rolls spec). No rule decided yet for the Data View specifically — if you hit this in testing, apply the same proportion-based instinct used elsewhere rather than an absolute threshold, and log it as a decision, not a silent choice.
- **Religious character** as a third list dimension stays blocked on a real ingest gap (GIAS publishes it, never mapped) — don't attempt to work around this by inferring it from a school's name or any other proxy.

---

## 11. Reference documents (for context, not to be re-derived)

- `vicdata_phase3_member_data_view_spec_v1.md` — the design spec this brief is built from.
- `vicdata_phase3_school_rolls_topic_spec_v1.md` — tiering rules, Feeder Set vs. Comparator Set distinction, the free/public "surrounding schools" mechanism this must stay distinct from.
- `vicdata_membership_area_ideas_v1.md` — the real-data recipe investigations (Woldingham, Charterhouse, Yerbury, Acland Burghley) this brief's §2 and §6 are drawn from directly.
- `vicdata_phase3_membership_onboarding_spec_v1.md` — account/role model, join flow (not in scope this round, but the Data View sits behind it).
- `vicdata_ingest_schema_and_build_plan_v2.md` — canonical schema, `school_entities`, GIAS/DfE census access patterns.
- `roll pipileine geolocation.md` — geography/distance mechanics (note: the consulting pipeline's postcode→MSOA machinery is a different, heavier-weight system than what this build needs — this build's "nearest by distance" is straight-line distance between school coordinates, already how `findSurroundingSchools()` works, not a new geocoding step).
- `vicdata_shape_panel_wording_sharpening_v1.md` — the exact bugs referenced in §2.
