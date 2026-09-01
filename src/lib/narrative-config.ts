// Every PROVISIONAL choice from the v2 narrative-generator draft, isolated here
// specifically so the next hand-edit round can flip one without touching
// narrative.ts/narrative-lookup.ts's logic. Each constant/flag cites the exact spec
// item it answers, and its current status (round 3/4 resolved several round-1/2
// items; still marked here for traceability, not deleted). Do not inline any of
// these values elsewhere -- if a template needs one, import it from here.

// §7 item 1 -- Topic 3 redesign. National comparator is real but expensive (would need
// a precomputed national-average-per-phase-per-sector aggregate, the same kind of
// table age_profile_aggregates/roll_aggregates already exist for). Off until that
// aggregate exists.
export const TOPIC3_INCLUDE_NATIONAL_COMPARATOR = false;

// §7 item 1 -- how far from the LA average (as a fraction) a phase's headcount must
// sit before it's called "large"/"small" rather than "medium". Not characterized
// against real data -- a chosen-not-discovered default, disclosed as such.
export const TOPIC3_SIZE_BAND_THRESHOLD = 0.15;

// Round 3, §3: year-group labels must cap at Year 13 -- English schools have no Year
// 14; a real 18-year-old in the roll (repeated year, late birthday, whatever the
// reason) is still in Year 13. Bug confirmed in the round-2 build (Malvern's sixth
// form rendered "Years 12-14"), not caught by Guy's own round-2 edit either -- the
// same age-18 edge as the shape classifier's own [5,17] clamp (Round 5 of that
// audit).
export const YEAR_GROUP_MAX = 13;

// Round 4, §5: the boarding-catchment clause's majority-boarding vs. majority-day
// split is based on the RAW boarding percentage crossing 50%, confirmed against the
// two real named examples (Malvern 72.5% -> majority-boarding branch; Leighton Park
// 23.4% -> majority-day branch) -- NOT the existing typology.ts boardingTag
// categories (which use 80%/5% thresholds calibrated for a different, purely
// descriptive purpose: Malvern's 72.5% sits below that 80% "Boarding" cutoff and
// would otherwise fall into "Boarding & day", the wrong branch for this clause).
export const MAJORITY_BOARDING_THRESHOLD = 0.5;

// §7 item 2 -- whether a school has real early-years/nursery provision. GIAS's own
// NurseryProvision (name) field (confirmed real and well-populated for independent
// schools -- 98.9% meaningfully filled, vs. PhaseOfEducation's 100% "Not applicable"
// for every open independent school checked, 1,588/1,588) is NOT YET ingested into
// vicdata_public's schools table -- see the diagnostic report for the full
// investigation. Until it is, this uses StatutoryLowAge (itself a real, authoritative
// GIAS registration field, not census-derived) as a proxy: a school registered with a
// statutory low age below the reliable census threshold (5) is treated as having
// early-years provision. Cross-checked against the real NurseryProvision field for all
// 1,588 open independent schools: 86.9% accuracy, 2 false negatives (proxy says no,
// GIAS says yes -- the dangerous direction, rare), 189 false positives (proxy says
// yes, GIAS says no -- 11.9% of independent schools would get an unwarranted "from
// early years" clause). Swap EARLY_YEARS_SOURCE to "nursery_provision_field" once that
// column exists and is synced -- isolated here as the one place this decision is made.
export const EARLY_YEARS_SOURCE: "statutory_low_age_proxy" | "nursery_provision_field" = "statutory_low_age_proxy";
export const EARLY_YEARS_PROXY_AGE_THRESHOLD = 5; // SHAPE_CLASSIFICATION_MIN_AGE, duplicated as a literal so this file has no cross-import dependency

// §7 item 3 -- drop the exact "N genuine changes" count as its own sentence; fold into
// the shape sentence's qualitative wording instead. Decided by Guy round 2, still
// open per round 4's §7 (not yet re-confirmed either way this round).
export const TOPIC5_FOLD_INTO_SHAPE_SENTENCE = true;

// Resolved round 3 (§7, "no longer open"): standalone factual boarding sentence, no
// causal framing -- confirmed, unchanged.
export const BOARDING_CAUSAL_FRAMING = false;

// Resolved round 4 (§5): the region-comparison clause is no longer a simple on/off
// flag -- it renders for every boarding-catchment branch EXCEPT majority-boarding,
// tied directly to which branch fired (see boardingCatchmentClause() in
// narrative.ts). This constant is kept only to name the one excluded branch, not as
// an independent toggle.
export const REGION_COMPARISON_EXCLUDED_BRANCH = "majority_boarding" as const;

// Resolved round 3 (§7, "no longer open"): "The gender balance varies from year to
// year" is a new, always-on hedge, separate from and additional to 4b's conditional
// clause. Survived round 3's edits unedited -- confirmed, not just assumed.
export const GENDER_ALWAYS_ON_HEDGE = "The gender balance varies from year to year.";

// §7 item 4 (round 4 numbering) -- STILL OPEN. Malvern has a real post-17 cohort
// invisible to the [5,17] shape clamp; dropping the "(ages 5 to 17)" scope note here
// risks the exact confusion v1's own §0 was built to prevent. No round-3/4 Priority
// instruction resolved this either. Defaulting to DROP (matches the majority of the
// three worked examples), a live flag, not a settled decision.
export const SHAPE_SENTENCE_INCLUDE_SCOPE_NOTE = false;

// Resolved round 3 (§7, "no longer open"): the 3pp gender-label hedge zone went
// untouched across round 3's real edits -- treated as accepted, not just guessed.
export const GENDER_LABEL_HEDGE_WIDTH_PP = 0.03;
