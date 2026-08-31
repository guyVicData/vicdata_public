# VicData — Phase 3: "Current State of the School Roll" Narrative Generator (v1)
*Companion to `vicdata_phase3_state_of_school_page_spec_v1.md` and `vicdata_phase3_school_rolls_topic_spec_v1.md`. Draft spec for the free, public "current state" text block on the State of the School page. Worked throughout against Malvern College as the running example, using real figures from the shape-classifier audit doc where available and clearly bracketed placeholders elsewhere.*

---

## 0. What this is, and what it explicitly is not

**Programmatic, rules-based sentence generation — not an LLM call per page view.** Guy's explicit instruction (2026-08-30): "we need it to be generated programmatically - not via AI - for each school using what we know from the profile." Every sentence below is a fixed template with slots filled from computed fields (most already existing in the schema; a few new ones specified here), so the same inputs always produce the same wording — auditable and testable the same way `classifyShape` itself is, not a generative black box.

This block sits inside the page's governing content rule (state-of-school spec §2): **current-state facts only, no trend lines, no historical charts.** Every template below is written as a pure snapshot statement. Topic 8 (questions to explore) is the one deliberate exception in spirit — it names paid trend features without displaying any trend data itself, exactly as the page spec's §4 describes routing a free-page visitor to a paid topic page.

**Two decisions taken before drafting, both by Guy (2026-08-30):**
1. **Shape narrative is explicitly scoped to "statutory school ages (5 to 17)."** The classifier's [5,17] clamp (Round 3 of the shape-classifier audit) still excludes real post-17 cohorts from shape computation — flagged as a live, unresolved data question back in Round 5 (Malvern's real 76-pupil Upper Sixth at age 18 is invisible to the classifier, even though the chart displays it). Rather than fixing the clamp as part of this work, the narrative always states its own scope explicitly, so a reader comparing the sentence to a chart that also shows an 18+ cohort sees a consistent story rather than an apparent contradiction. The clamp itself remains open, carried forward as unfinished business from Round 5 — not resolved by this spec.
2. **The gender-variation clause (topic 4) is being built and calibrated in this round**, not deferred — but "build now" still means characterize against real data before fixing a threshold, the same discipline every constant in the shape-classifier project has earned. The candidate threshold below is explicitly provisional.

---

## 1. Cross-cutting style rules

- **Word-form numerals specifically for "one of X" framing** ("one of fifteen," not "1 of 15") — a numeral in that position reads as a ranking, which it isn't. Every other number (percentages, roll counts, ages) stays numeric as normal.
- **Single-sex suppression principle applies directly** wherever a sentence would state or imply a gender count (topics 2, 4, 6) — per rolls spec §8, suppress a small minority-gender count by *proportion* within its age band, not absolute count, and never attach a causal explanation to an unexplained arithmetic inconsistency.
- **Member-gating footer, reused verbatim from the existing SURROUNDING SCHOOLS copy** wherever a sentence draws on a hidden peer list: "The [word_number] schools behind this comparison are visible to verified members."
- **No trend language anywhere in topics 1–7** — no "has grown," "is rising," "compared to last year." Snapshot verbs only ("is," "has," "currently shows").
- **Any new threshold is characterized against real national data before being fixed**, and disclosed as chosen-not-discovered if no natural break exists — matching every constant already shipped in `shape-classifier.ts`.

---

## 2. Topic 1 — Sector, in context

**Data**: GIAS sector + LA aggregate counts (already powers the existing live copy).

**Template**: "{{school_name}} is one of {{word_number}} {{sector_adjective}} schools in {{LA_name}}, and its pupils are {{pct}}% of the county's {{sector}} pupils. (GIAS figures)"

**Change from current live copy**: spell out the count as a word only in the "one of X" position — the percentage stays numeric.

**Malvern example** (real figures, from the existing live copy): *"Malvern College is one of fifteen independent schools in Worcestershire, and its pupils are 9.5% of the county's independent-sector pupils. (GIAS figures)"*

---

## 3. Topic 2 — Phase / gender

**Data needed**: phase tag (already exists: Junior/Senior/Post16) + a new **gender-composition category**, derived from the school's overall (not per-age-band) gender split:

| Category | Rule |
|---|---|
| Single-sex (boys) / Single-sex (girls) | non-dominant gender's overall share falls inside the single-sex suppression band (rolls spec §8's proportional threshold, not yet fixed — reuse whatever value that principle ultimately sets) |
| Co-educational, roughly balanced | dominant gender's overall share is within a symmetric band around 50% (candidate: 45–55%, provisional) |
| Co-educational, mostly {gender} | dominant gender's overall share exceeds the balanced band but the school isn't single-sex |

**Template**: "{{school_name}} is a {{phase_word}} school ({{age_range}}), and is {{gender_composition_phrase}}."

**Malvern example** (illustrative — Malvern's real overall gender split isn't in this session's data; Malvern is known to be co-educational): *"Malvern College is a senior school (ages 13 to 18), and is co-educational."* — the balanced/skewed distinction needs a live query to render precisely.

---

## 4. Topic 3 — Size of phases, contextualized

**Reuses, rather than reinvents, the mechanism already live in the SURROUNDING SCHOOLS copy** ("55% above the average roll of 404 for the 10 nearest independent senior schools") — the only change is applying it **per phase** (e.g., sixth-form headcount vs. other schools' sixth-form headcounts) rather than whole-school roll, and adding a categorical small/medium/large band on top of the existing percentage-above-average figure.

**New field needed**: size band (small/medium/large) per phase, defined against the same nearest-peer comparator set already spec'd (rolls spec §4's nearest-20, matched by age band/phase and sector) — candidate banding: roughly even terciles of that comparator set's own phase-headcount distribution, characterized against real data before fixing the cut points (same discipline as everything else here — not asserted from first principles).

**Template**: "The {{phase_name}} ({{roll_count}} pupils) is {{size_band_word}} — one of the {{word_number}} {{size_word}} {{sector}} {{phase_name_plural}} in {{region_name}}. The schools behind this comparison are visible to verified members."

**Malvern example** (illustrative — exact sixth-form headcount, regional rank, and comparator count need a live query): *"The sixth form (around 310 pupils, ages 16 to 18) is large — one of the largest independent sixth forms in the West Midlands."*

---

## 5. Topic 4 — Shape (described/explained, including gender variations)

### 5a. Plain-language shape description, scoped to ages 5–17 per the decision in §0

| Label | Template |
|---|---|
| Tube | "{{school_name}}'s year groups are broadly similar in size all the way through the school's statutory age range (5 to 17) — a Tube shape." |
| Pyramid | "{{school_name}}'s year groups gradually narrow from the youngest statutory ages to the oldest (5 to 17) — a Pyramid shape, typical of a school where pupils leave gradually across several year groups rather than all at once." |
| Top Step | "{{school_name}}'s year groups stay a similar size until one point, where the roll steps down and then holds steady at the new size, across the statutory age range (5 to 17) — a Top Step shape, typical of a school where a group of pupils leaves together at one specific transition." |
| Funnel | "{{school_name}}'s year groups gradually widen from the youngest statutory ages to the oldest (5 to 17) — a Funnel shape, typical of a school that gains pupils gradually across several year groups rather than all at once." |
| Mushroom | "{{school_name}}'s year groups stay a similar size until the oldest statutory ages, where the roll grows sharply — a Mushroom shape, typical of a school with a large sixth-form-style intake." |
| Wineglass | "{{school_name}}'s roll broadens substantially from its narrowest point to its widest across the statutory age range (5 to 17), without needing to grow in every single year — a Wineglass shape, typical of a school with staged joining points across several year groups." |
| Irregular | "{{school_name}}'s year groups vary in size, across the statutory age range (5 to 17), in a way that doesn't fit one of the platform's standard shapes — genuine movement, not just ordinary year-to-year variation (see below)." |
| Unclassified | "There isn't enough current census data to classify {{school_name}}'s shape." |

**Malvern example** (real: Malvern is a shipped Wineglass, 4.00x ratio, per Round 17): *"Malvern College's roll broadens substantially from its narrowest point to its widest across the statutory age range (5 to 17), without needing to grow in every single year — a Wineglass shape, typical of a school with staged joining points across several year groups."*

### 5b. Gender-variation clause — new mechanism, built this round per Guy's decision, calibration still pending real data

**What it detects**: whether the shape's dominant real transition (the `domShare` move for domShare-resolved shapes; the largest real net-change segment for Thornton-mechanism resolutions) is disproportionately made up of one gender, relative to that gender's overall share of the school.

**Proposed mechanism** (design only — needs a Claude Code characterization pass before any cut is fixed, same as every other threshold in this project):
1. Compute the gender split *within* the dominant transition (of the pupils added/lost at that step, what share are girls vs. boys).
2. Compare against the school's *overall* gender split.
3. Flag "concentrated in {gender}" if the two shares diverge by more than a candidate margin — **provisionally 15 percentage points**, chosen only by analogy to the existing 15%-relative-move threshold elsewhere in `shape-classifier.ts`, explicitly **not yet validated against a real histogram**. Disclosed as a placeholder, not a finding.
4. Apply the single-sex suppression principle before rendering: never surface this clause if either gender's count anywhere in the relevant age band sits inside the suppression zone.

**Template (conditional — only renders if the check fires)**: "The main change, between ages {{age_a}} and {{age_b}}, is concentrated more among {{gender}} than the school's overall gender balance would suggest."

**Malvern example**: real per-gender age-band data for Malvern isn't available to this session, so this can't be worked through concretely yet — flagged as the first thing to check once this is handed to Claude Code (Charterhouse is the one real named precedent, per Round 7 of the classifier audit: a +38.8% jump specifically in girls at its dominant transition — a good first real test case for calibrating this mechanism once it's built).

---

## 6. Topic 5 — Regularity (or otherwise) of year-group sizes

**No new mechanism needed** — this is a plain-language reading of data the classifier already computes: the `moves` array (how many transitions are "real" vs. flat under the existing floor logic) and the reversal count (built for the Round 17 Wineglass gate).

| Case | Template |
|---|---|
| Regular | "Year-group sizes are broadly consistent from one age to the next, with no unusual jumps." |
| Irregular, structural | "Year-group sizes vary more than ordinary year-to-year noise between some ages — {{real_move_count}} genuine change(s) beyond normal variation." |

**Malvern example** (real, from the audit's move data: +37, +45, +28, +10 — four real, same-direction moves, zero reversals): *"Year-group sizes vary more than ordinary year-to-year noise between some ages — four genuine changes beyond normal variation, all in the same direction."*

---

## 7. Topic 6 — Boarding / day

**Data**: GIAS `Boarders`/`BoardingEstablishment` (routing flag only, per rolls spec §8) for whether to show this section at all; DfE census boarding headcount for the actual current-year number — **this second field is confirmed present in the raw source but not yet mapped** (rolls spec §10, item 3, still listed as outstanding). This sentence is blocked on that mapping for its precise form; the categorical version is buildable now.

**Template (categorical, buildable now)**: "{{school_name}} is a {{boarding_day_phrase}} school." (boarding & day / boarding only / day only)

**Template (once the census boarding-headcount mapping is done)**: "{{school_name}} is a {{boarding_day_phrase}} school, with {{pct}}% of pupils boarding."

**Malvern example** (real, from the existing SURROUNDING SCHOOLS copy: "boarding & day"): *"Malvern College is a boarding and day school."* — the percentage version needs the outstanding field mapping resolved first.

---

## 8. Topic 7 — LA and region context (corrected 2026-08-31 — was wrong in the original draft)

**Correction (Guy, 2026-08-31): this does NOT reuse the six-shape school taxonomy.** The original draft of this section assumed LA/region-level classification shares the same tube/pyramid/top-step/funnel/mushroom/wineglass labels as the school-level classifier, following the rolls spec's stated design intent (§4: "Shared taxonomy — same five labels for school and geography, confirmed deliberately... a direct label comparison, not a translation between vocabularies"). **That assumption is wrong in practice.** Guy: "we already categorise LA and regions differently... Worcs. is steep decline, and West Midlands is decline." A separate, already-built decline-tier system exists for LA/region-level classification — not the school shape labels. This is corroborated independently in this project's own shape-classifier audit (Round 6): "82.3% of all English LAs already sit in some 'decline tier'" — a tier system was already being referenced and used as of that round, just never documented in a doc available to this session.

**This is a real discrepancy between the rolls spec (§4) and what's actually built/used, not just an error in this draft** — worth Guy or Claude Code updating `vicdata_phase3_school_rolls_topic_spec_v1.md` §4 directly once the real tier system is confirmed, so the next person reading that spec doesn't repeat this mistake.

**What's confirmed so far:**
- The decline-tier basis is **ages 5–15**, not 5–17 — a deliberately different span from Topic 4's own school-shape scope (statutory ages 5–17, per §0's decision above). The narrative needs to state this difference explicitly rather than let two different age windows sit unlabelled side by side on the same page.
- The framing is demographic pressure, not shape: fewer children in the system locally means less pressure feeding into a school's own entry-age intake — a genuinely different, and arguably more directly useful, piece of context than a shape-label comparison would have been.
- Known real values from Guy directly: Worcestershire = "steep decline," West Midlands = "decline."

**Not yet known, and not resolvable from this session's documents — needs Claude Code:**
- The full set of tier labels (steep decline / decline / ... stable? ... growth? / steep growth?) and where the boundaries between them sit.
- Whether the tiers are already computed for every LA and region, or only for the ones already checked by hand.
- Where this mechanism actually lives in the codebase (not in `la_hierarchy.py`/`region_hierarchy.py`, which only resolve geography codes, not classify anything demographic — likely lives in or near the consultancy pipeline's projection model, referenced but not detailed in `roll pipileine geolocation.md`).

**Distinct from the existing SURROUNDING SCHOOLS "combined shape" stat** — that one aggregates the nearest 20 *same-type schools'* shape; this is now understood to be an LA/region-level *decline-tier* stat, not a shape at all. Two genuinely different mechanisms and vocabularies on the same page — the narrative needs to keep them clearly separate rather than implying either is a translation of the other.

**Template (revised, pending the real tier list)**: "{{LA_name}}'s school-age population (ages 5 to 15) is currently in {{LA_tier}}, and the {{region_name}} region is in {{region_tier}} — {{fewer/more}} children locally to feed into schools' entry ages over the coming years. {{school_name}}'s own current shape ({{school_shape}}, ages 5 to 17) {{is consistent with / runs against}} that local pattern."

**Malvern example** (illustrative language only — real Worcestershire/West Midlands tier wording needs confirming from Claude Code, not guessed): *"Worcestershire's school-age population (ages 5 to 15) is currently in steep decline, and the West Midlands region is in decline — fewer children locally to feed into schools' entry ages over the coming years. Malvern College's own current Wineglass shape (ages 5 to 17) runs against that local pattern — not unusual for an independent boarding school, which draws its pupils from well beyond the local area."* The closing explanatory clause should probably only render for independent/boarding schools, where a mismatch with local demographic pressure is expected rather than notable — a state day school's roll running against its LA's declining tier might be worth surfacing as more genuinely interesting, not softened.

---

## 9. Topic 8 — Questions to explore (member-tier teaser)

**No trend data displayed** — this is a pointer, not a preview, consistent with the page's free/paid boundary (rolls spec §3: roll trend, shape stability, gender trend, and boarding trend are all paid).

**Template**: "Want to see how this has changed over time? Verified members can explore {{school_name}}'s roll trend, its shape stability over recent years, its gender and boarding trends, and how it compares within a comparator set of schools you choose."

Only reference features that actually exist per the rolls spec's paid-tier table — no invented capabilities.

---

## 10. Build items for Claude Code, in priority order

1. **Templating engine + fields for topics 1, 2, 3, 5, 6, 7, 8** — pure plumbing, no new thresholds, reusing existing computed fields (shape label, `moves`, reversal count, GIAS sector/LA aggregates, existing nearest-peer comparator logic) plus the small/medium/large phase-size banding (needs tercile-style characterization against the nearest-peer comparator set, not asserted).
2. **Gender-variation clause (topic 4b)** — new mechanism. Characterize the real distribution of "dominant-transition gender skew vs. whole-school gender skew" across all co-educational schools with a resolved shape and a real dominant transition, look for a natural break the way every other threshold in this project has been checked, and report back before the provisional 15pp cut is treated as final.
3. **Supply the real LA/region decline-tier system (topic 7)** — corrected 2026-08-31, this is not the six-shape taxonomy. Need: the full list of tier labels and their boundaries, confirmation the ages-5–15 basis and "steep decline"/"decline" tiers for Worcestershire/West Midlands are correct, where this mechanism lives in the codebase, and whether it's computed for every LA/region already. Also flag `vicdata_phase3_school_rolls_topic_spec_v1.md` §4's "shared taxonomy" line as needing a correction once this is confirmed — it currently states LA/region reuses the school shape labels, which is wrong.
4. **DfE census boarding-headcount field mapping** (topic 6's percentage form) — this is the same outstanding item flagged in rolls spec §10, item 3; this narrative work is a second, independent reason to prioritize it, not a new blocker.

**Status.** Spec drafted, not yet built. Awaiting Guy's review of the templates and worked Malvern example before handoff to Claude Code.
