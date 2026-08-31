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

**`{{age_range}}` must come from the real observed non-zero span, not the statutory field — flagged by the diagnostic run (2026-08-31), fix now, no decision needed.** Woldingham's `statutory_low_age`/`statutory_high_age` fields say 10–19, and a naive template would render "ages 10 to 19" — but Woldingham's real current census data shows zero pupils at ages 10, 18, and 19 this period; its real span is 11–17. This is the exact same lesson the shape classifier itself already learned once (Round 3 of the shape-classifier audit: crop to real observed data, not an external registration field, "you can't silently delete a real population by cropping to where the real numbers start" — applies here in reverse, don't *add* a population that isn't really there either). Confirmed this didn't pollute Topic 3's peer-matching for Woldingham, but the age-range slot itself would have been wrong if built naively.

**Band-boundary flag (diagnostic run, 2026-08-31) — worth widening, not urgent.** The provisional 45–55% "roughly balanced" band is tight enough that 2 of 4 real test schools land just outside it: Leighton Park (55.1% male) and Charterhouse (55.4% male) both sit under 0.5 percentage points past the boundary, both toward "mostly boys." Plausibly a real pattern among independent schools that converted from historically single-sex-boys institutions, clustering near this edge — worth Claude Code testing a wider band against a bigger real sample before finalizing (same test-candidates-and-recommend treatment the Wineglass magnitude cut got), rather than shipping the 45–55% guess as-is.

**Malvern example** (illustrative — Malvern's real overall gender split isn't in this session's data; Malvern is known to be co-educational): *"Malvern College is a senior school (ages 13 to 18), and is co-educational."* — the balanced/skewed distinction needs a live query to render precisely.

**Real examples from the diagnostic run**: *"Leighton Park School is a senior school (ages 11 to 18), and is co-educational, mostly boys."* (55.1% male) / *"The King's School is a senior school (ages 2 to 19), and is co-educational, roughly balanced."* (46.7% female — though note The King's School's own real 2–19 statutory span reading oddly for a "senior school" phase tag is a separate, second flag worth a closer look, not resolved here) / *"Charterhouse is a senior school (ages 12 to 19), and is co-educational, mostly boys."* (55.4% male) / Woldingham — girls' school, single-sex.

---

## 4. Topic 3 — Size of phases, contextualized

**Reuses, rather than reinvents, the mechanism already live in the SURROUNDING SCHOOLS copy** ("55% above the average roll of 404 for the 10 nearest independent senior schools") — the only change is applying it **per phase** (e.g., sixth-form headcount vs. other schools' sixth-form headcounts) rather than whole-school roll, and adding a categorical small/medium/large band on top of the existing percentage-above-average figure.

**New field needed**: size band (small/medium/large) per phase, defined against the same nearest-peer comparator set already spec'd (rolls spec §4's nearest-20, matched by age band/phase and sector) — candidate banding: roughly even terciles of that comparator set's own phase-headcount distribution, characterized against real data before fixing the cut points (same discipline as everything else here — not asserted from first principles).

**Template**: "The {{phase_name}} ({{roll_count}} pupils) is {{size_band_word}} — one of the {{word_number}} {{size_word}} {{sector}} {{phase_name_plural}} in {{region_name}}. The schools behind this comparison are visible to verified members."

**Wording/scope decision — decided (Guy, 2026-08-31), a third path, better than either option originally posed.** The template said "in {{region_name}}," implying a true regional comparison, but the real mechanism only ever computes against the nearest 10 (or fewer) matched peers, never a full regional census. For most schools this distinction is invisible — 11-school and 9-school comparator sets were found for Leighton Park and The King's School. But for Woldingham, a genuinely thin niche (girls-only independent boarding schools), only **5** real peers were found nationally against a target of 10, and the "small" tercile call is driven almost entirely by one low outlier (a 91-pupil school) dragging the peer average down — Woldingham is actually +15.5% above that thin peer average yet still bands as "small." With n=5, tercile banding is coarse enough that a single school can define an entire tier.

Rather than either (a) a blanket honesty reword ("among the nearest comparable schools" everywhere) or (b) a separate true-regional-aggregate build, **Guy's decision: make the location word in the sentence reflect the real geographic spread of whichever peer set was actually matched.** Concretely — once the nearest-N peer-matching mechanism has found its comparator set for a given school and phase, compute the *tightest* geography that actually contains every peer in that set: if all matched peers fall within the same LA, say "in {{LA_name}}"; if they span the LA but stay within the region, say "in {{region_name}}"; if the mechanism had to reach beyond the region to find enough peers (Woldingham's case), say "nationally" (or equivalent honest wording, exact phrase to be finalized). This keeps the existing nearest-N mechanism exactly as it is — no new true-regional-aggregate build — but makes the sentence's geographic claim always match what was actually searched, self-correcting per school rather than a single fixed wording choice for every school. Needs the same discipline as everything else here: characterize the computed-scope logic against real data (does "nearest 10" for a common school type like Leighton Park's actually stay within-region, or does it sometimes reach further than expected too?) before finalizing the exact wording tiers.

**Malvern example** (illustrative — exact sixth-form headcount, regional rank, and comparator count need a live query): *"The sixth form (around 310 pupils, ages 16 to 18) is large — one of the largest independent sixth forms in the West Midlands."*

**Real examples from the diagnostic run**: *"The senior school (581 pupils) is large — one of the three large independent senior schools compared."* (Leighton Park, rank #2 of 11, +95.9% vs. peer average) / *"The senior school (852 pupils) is large — one of the three large independent senior schools compared."* (The King's School, rank #3 of 9, +106.7%) / *"The senior school (1,027 pupils) is large — one of the three large independent senior schools compared."* (Charterhouse, rank #1 of 11 — the largest in its own comparator set, +195.8%) / *"The senior school (528 pupils) is small — one of the two small independent senior schools compared."* (Woldingham — see the thin-pool flag above).

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

### 5b. Gender-variation clause — characterized against real data 2026-08-31; threshold and scope finalized by Guy

**What it detects**: whether a school's dominant real transition (the `domShare` move for domShare-resolved shapes; the largest real net-change segment for Thornton-mechanism resolutions) is disproportionately made up of one gender, relative to that gender's overall share of the school.

**Mechanism**:
1. Compute the gender split *within* the dominant transition (of the pupils added/lost at that step, what share are girls vs. boys).
2. Compare against the school's *overall* gender split.
3. Flag "concentrated in {gender}" if the two shares diverge by more than the threshold below.
4. Apply the single-sex suppression principle before rendering: never surface this clause if either gender's count anywhere in the relevant age band sits inside the suppression zone (which also makes the clause trivially moot for a genuinely single-sex school, since there's effectively only one gender to diverge from).

**Threshold — decided (Guy, 2026-08-31), following characterization.** The original 15pp placeholder was tested against a national scan of 10,309 co-ed schools with a real dominant transition: no natural break exists, median divergence is already 18.8pp, and 15pp would flag 57.8% of eligible schools — not a meaningful "notable" signal, just noise on most profiles. **Decision: raise the cut to roughly the 90th percentile (~42.9pp on this scan; final exact cut to be pinned down against the full histogram, not just the single percentile figure reported here), disclosed as a deliberately chosen value — the same "chosen, not discovered" honesty as the Wineglass magnitude cut (Round 17 of the shape-classifier audit) — rather than a rediscovered natural boundary, since none exists.** At this level, the clause fires only for genuinely unusual cases.

**Scope — decided (Guy, 2026-08-31): also applies to Irregular-shaped schools, not just the six resolved shapes.** The spec's own named precedent, Charterhouse, is itself classified Irregular (its 1.28x ratio sits below the Wineglass magnitude cut) — under the original draft's scoping (5a's resolved shapes only), Charterhouse would never actually have shown this sentence, which would have meant the feature's motivating example couldn't use it. Irregular schools still have a computed dominant transition internally (`domIdx`/`domShare`) even where the whole-school shape didn't resolve cleanly, so the clause now renders wherever a real dominant transition exists, regardless of the school's own shape label.

**Template (conditional — only renders if the check fires)**: "The main change, between ages {{age_a}} and {{age_b}}, is concentrated more among {{gender}} than the school's overall gender balance would suggest."

**Malvern example**: real per-gender age-band data for Malvern isn't available to this session, so this can't be worked through concretely yet — flagged as the first thing to check once this is handed to Claude Code for the full build.

**Real per-school results, from the diagnostic run (2026-08-31), independently re-verified for Charterhouse by hand against Round 7's original figures (49.7pp by hand vs. 49.6pp reported — matches closely):**

| School | Dominant transition | Divergence | Fires at ~43pp cut? |
|---|---|---|---|
| Charterhouse | ages 15→16 | 49.6pp | Yes |
| Leighton Park | ages 12→13 | 38.1pp | No (just under) |
| King's Worcester | ages 10→11 | 6.2pp | No |
| Woldingham | n/a — single-sex | 0pp (trivial) | No — suppression makes this moot |

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

**Data**: GIAS `Boarders`/`BoardingEstablishment` (routing flag) for whether to show this section at all; DfE census boarding headcount for the actual current-year percentage. **Correction (Claude Code, diagnostic run, 2026-08-31): the census boarding-headcount mapping is NOT outstanding — it's live now**, contrary to both this spec's original assumption and the rolls spec §10 item 3. Confirmed directly against real schools: Charterhouse 87.3% boarding, Leighton Park 23.4%, Woldingham 46.0%, and The King's School's zero-boarders result confirmed genuine (both the GIAS flag and the census headcount independently agree) rather than a mapping gap. The percentage template below is buildable now, not blocked.

**Template**: "{{school_name}} is a {{boarding_day_phrase}} school, with {{pct}}% of pupils boarding." (day-only schools drop the percentage clause, per The King's School's real example below.)

**Malvern example** (partially real): *"Malvern College is a boarding and day school."* — the percentage itself still needs a live query for Malvern specifically, but the mechanism is confirmed working and unblocked.

**Real examples from the diagnostic run**: *"Charterhouse is a boarding and day school, with 87.3% of pupils boarding."* / *"Leighton Park School is a boarding and day school, with 23.4% of pupils boarding."* / *"Woldingham School is a boarding and day school, with 46.0% of pupils boarding."* / *"The King's School is a day school."*

---

## 8. Topic 7 — LA and region context (corrected 2026-08-31 — was wrong in the original draft)

**Correction (Guy, 2026-08-31): this does NOT reuse the six-shape school taxonomy.** The original draft of this section assumed LA/region-level classification shares the same tube/pyramid/top-step/funnel/mushroom/wineglass labels as the school-level classifier, following the rolls spec's stated design intent (§4: "Shared taxonomy — same five labels for school and geography, confirmed deliberately... a direct label comparison, not a translation between vocabularies"). **That assumption is wrong in practice.** Guy: "we already categorise LA and regions differently... Worcs. is steep decline, and West Midlands is decline." A separate, already-built decline-tier system exists for LA/region-level classification — not the school shape labels. This is corroborated independently in this project's own shape-classifier audit (Round 6): "82.3% of all English LAs already sit in some 'decline tier'" — a tier system was already being referenced and used as of that round, just never documented in a doc available to this session.

**This is a real discrepancy between the rolls spec (§4) and what's actually built/used, not just an error in this draft** — worth Guy or Claude Code updating `vicdata_phase3_school_rolls_topic_spec_v1.md` §4 directly once the real tier system is confirmed, so the next person reading that spec doesn't repeat this mistake.

**What's confirmed so far:**
- The decline-tier basis is **ages 5–15**, not 5–17 — a deliberately different span from Topic 4's own school-shape scope (statutory ages 5–17, per §0's decision above). The narrative needs to state this difference explicitly rather than let two different age windows sit unlabelled side by side on the same page.
- The framing is demographic pressure, not shape: fewer children in the system locally means less pressure feeding into a school's own entry-age intake — a genuinely different, and arguably more directly useful, piece of context than a shape-label comparison would have been.
- Known real values from Guy directly: Worcestershire = "steep decline," West Midlands = "decline."

**Confirmed by Claude Code's diagnostic run (2026-08-31) — no longer open:**
- **Mechanism location**: `src/lib/population-trend.ts` (pure classification function) + `src/lib/population-trend-lookup.ts` (Supabase fetch from `age_profile_aggregates`) — the same logic already feeding the `PopulationTrendSection` component on the dashboard's Shape card. Not Python, not near the consultancy pipeline's projection model as originally guessed.
- **Metric**: `(age15 − age5) / age15 × 100` — positive means relatively fewer young children than old, i.e. decline.
- **Full tier table** (real, absolute, zero-anchored cuts — a percentile/tercile approach was tried and deliberately rejected, per the code's own comment, because it would force a third of LAs into "Growing" even under uniform national decline):

| Tier | Range |
|---|---|
| Growing | < 0% |
| Stable | 0–2% |
| Decline | 2–15% |
| Steep Decline | 15–25% |
| Severe Decline | > 25% |

- **Real values, confirmed exact and current (period 2025)**: Worcestershire 15.9% → Steep Decline; West Midlands 8.7% → Decline. Cross-checked against two more: Reading 9.6% (Decline), Surrey 14.9% (Decline, just under the Steep Decline boundary).
- **Coverage**: computed live at request time (not precomputed/stored), but the underlying `age_profile_aggregates` table has full national coverage — 153/153 English LAs, all 9 regions, all at period 2025. Not a hand-checked subset.

**Distinct from the existing SURROUNDING SCHOOLS "combined shape" stat** — that one aggregates the nearest 20 *same-type schools'* shape; this is an LA/region-level *decline-tier* stat, a genuinely different mechanism and vocabulary. The narrative needs to keep them clearly separate rather than implying either is a translation of the other.

**Template (finalized)**: "{{LA_name}}'s school-age population (ages 5 to 15) is currently in {{LA_tier}}, and the {{region_name}} region is in {{region_tier}} — {{fewer/more}} children locally to feed into schools' entry ages over the coming years. {{school_name}}'s own current shape ({{school_shape}}, ages 5 to 17) {{is consistent with / runs against}} that local pattern."

**Malvern example** (real, confirmed 2026-08-31 — Malvern is in Worcestershire/West Midlands): *"Worcestershire's school-age population (ages 5 to 15) is currently in Steep Decline, and the West Midlands region is in Decline — fewer children locally to feed into schools' entry ages over the coming years. Malvern College's own current Wineglass shape (ages 5 to 17) runs against that local pattern — not unusual for an independent boarding school, which draws its pupils from well beyond the local area."* The closing explanatory clause should probably only render for independent/boarding schools, where a mismatch with local demographic pressure is expected rather than notable — a state day school's roll running against its LA's declining tier might be worth surfacing as more genuinely interesting, not softened.

**Still to do**: `vicdata_phase3_school_rolls_topic_spec_v1.md` §4's "shared taxonomy" line still needs correcting to reflect this — flagged to Claude Code but not yet edited by anyone.

---

## 9. Topic 8 — Questions to explore (member-tier teaser)

**No trend data displayed** — this is a pointer, not a preview, consistent with the page's free/paid boundary (rolls spec §3: roll trend, shape stability, gender trend, and boarding trend are all paid).

**Template**: "Want to see how this has changed over time? Verified members can explore {{school_name}}'s roll trend, its shape stability over recent years, its gender and boarding trends, and how it compares within a comparator set of schools you choose."

Only reference features that actually exist per the rolls spec's paid-tier table — no invented capabilities.

---

## 10. Build items for Claude Code, in priority order

1. **Templating engine + fields for topics 1, 2, 3, 4b, 5, 6, 7, 8** — pure plumbing for the finalized rules above. The Woldingham age-range fix (real observed span, not statutory field) and the boarding percentage (confirmed live, not blocked) are both foldable into this pass directly, no further characterization needed.
2. **Gender-variation clause (topic 4b) — threshold and scope now finalized (Guy, 2026-08-31)**: cut raised to ~p90 (pin down the exact value against the full histogram, not just the single percentile point reported so far), scope extended to Irregular-shaped schools wherever a real dominant transition exists. Ready to build.
3. **Topic 3's location wording — decided (Guy, 2026-08-31)**: don't hardcode "in {{region_name}}." Instead, after the nearest-N peer-matching mechanism finds its comparator set, compute the tightest geography that actually contains every matched peer (LA / region / national) and use that word in the sentence. Needs: (a) the bounding-geography computation itself, (b) characterization against real data — check whether "nearest 10" for an ordinary, well-populated school type (e.g. Leighton Park) reliably stays within-region or sometimes reaches further than expected, before finalizing the exact wording for each tier (the "national" phrasing in particular). Woldingham (5 peers found nationally) is the motivating real case.
4. **Topic 2's 45–55% "balanced" band — recommend Claude Code test a wider band** against a larger real sample (same test-candidates-and-recommend pattern as the Wineglass cut), given 2 of 4 test schools landed just outside it. Not blocking, not urgent.
5. **`vicdata_phase3_school_rolls_topic_spec_v1.md` §4 still needs its "shared taxonomy" line corrected** — flagged twice now (initial correction, and again in the diagnostic run), not yet edited by anyone.

**Status.** Diagnostic Round 1 complete against Leighton Park, The King's School, Charterhouse, and Woldingham — no code changes made, two doc files touched only, as scoped. Topic 7, Topic 4b, and Topic 3's wording/scope are all now decided (mechanism confirmed or design chosen). Nothing remains blocking the templating-engine build (item 1) except item 3's own characterization sub-step (does "nearest 10" ever reach past-region for ordinary schools, not just thin niches like Woldingham). Everything else in this document is now real, not illustrative, for the four test schools.

---

## 11. Diagnostic Round 1 — full findings log, 2026-08-31

**Scope, confirmed clean**: no code changes made throughout. Two doc files touched only (this spec, resaved with the Topic 7 correction). An initial recheck script had a self-caught bug (used the raw span instead of the anchored, floor-dropped span for Charterhouse's dominant transition, which wrongly picked age 12's near-zero point) — caught and fixed before the national 10,309-school scan was run; that scan used the correct anchored logic throughout and its results stand.

**Independent cross-checks performed by this session, all confirmed exact or near-exact:**
- Charterhouse's real whole-school gender split (55.4% male, from this diagnostic run) matches the "0.4pp outside the 55% band" flag exactly.
- Charterhouse's "four genuine changes" (topic 5) matches the real move count from Round 8 of the shape-classifier audit (+17, +9, +35, −13) exactly.
- Charterhouse's 49.6pp gender divergence (topic 4b) matches this session's own hand-recomputation from Round 7's original data (49.7pp) closely.
- Malvern's real peer-comparison figure (625 pupils, cited in The King's School's own comparator set) matches exactly the sum of Malvern's known ages 13–17 total (549, from the shape-classifier audit) plus its known age-18 cohort (76, from Round 5) — 549 + 76 = 625. A strong, independent confirmation that the underlying data is consistent across completely separate computations run at different times.

**New findings from the four-school run, beyond what's already folded into the relevant topic sections above:**
- The King's School's correct GIAS name is "The King's School," not "King's School Worcester" — confirmed directly, worth using the exact name going forward.
- Woldingham's previously-documented male/female-sum-vs-total arithmetic inconsistency (rolls spec §8) does not appear in the current period's data (243 female + 0 male = 243 total, exact) — consistent with that being a genuine intermittent source quirk rather than a permanent one.
- Single-sex suppression didn't trigger or near-trigger for any of the four schools — Woldingham's male count is a genuine exact zero at the whole-school level, not a small-but-real count needing suppression.

**Two items resolved outright (no further decision needed), already folded into the relevant sections above:**
- Topic 6 (boarding %) is live now, not blocked — the "outstanding" framing in this spec and in rolls spec §10 was wrong.
- Topic 2's `{{age_range}}` slot must read from the real observed non-zero span, not the statutory field — a live discrepancy found on Woldingham (statutory 10–19 vs. real 11–17), fixed the same way the shape classifier itself already fixed an equivalent problem in Round 3 of that project.

**Two items still open, one needing Guy's call, one delegated to Claude Code to test and recommend:**
- Topic 3's "in {{region_name}}" wording overstating its real nearest-10-or-fewer scope — genuine decision, see §4 and §10 above.
- Topic 2's 45–55% balanced-gender band being boundary-sensitive in real data — delegated to Claude Code for a wider-band test, not urgent.
