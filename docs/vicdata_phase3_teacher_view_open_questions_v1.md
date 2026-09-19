# Teacher view build — running log of judgment calls

Per the build prompt's operating mode: every point where the brief did not fully spell
out an answer, the most reasonable call consistent with its stated principles was made,
logged here, and the build continued. This is a running log appended to during the
build, not written at the end.

Principles used to resolve these, from the brief: natural-language-question headings
(§14), radical visual consistency (§14), comparisons-and-context everywhere (§14),
mobile-first and full-screen (§7), per-dataset onboarding as the unlock mechanism (§5),
never show a bare number without an anchor, and never fabricate — show only what is
honestly real.

---

## Q1. The real role vocabulary does not match the brief's

**Found:** the live constraint is
`role in ('head_governor','admissions','finance','director_of_studies','head_of_department')`.
The brief (§3) asks for Teacher, HOD, SMT, Finance, Admissions. So three of the brief's
five already exist under different names, `teacher` and `smt` do not exist at all, and
two live values (`head_governor`, `director_of_studies`) are not in the brief's list —
though §3 explicitly folds both into SMT.

**Decided:** migrate to the brief's canonical vocabulary outright
(`teacher`, `hod`, `smt`, `finance`, `admissions`) rather than keeping the old values
alongside as aliases.

**Why:** checked first — there is exactly one membership row in the whole database and
its role is NULL, so no real data uses the old vocabulary and a clean migration costs
nothing. Carrying five dead legacy values forward would leave the next person guessing
which set is canonical. §3's folding instructions are encoded as comments in the
migration so the mapping is not lost.

## Q2. Should `role` have a database default?

**Decided:** yes, `default 'teacher'`.

**Why:** §3 makes Teacher "the default, self-selected role ... no role picker needed for
the common case", and calls zero-friction default central to growth. A database default
means an individual joining alone is a Teacher without any code path having to remember
to set it. Admin-granted roles (§3) are an explicit upgrade from that baseline.

## Q3. `role` currently gates nothing

**Found:** `role` is written at join and rendered on the account page. Nothing reads it
to decide what a user sees; `is_admin` is the only real gate today.

**Decided:** treat "role drives the view" (§3) as something this build must establish
rather than something it can confirm, and add a single shared resolver the rest of the
build gates on, rather than scattering role checks.

**Why:** the prompt asks to "confirm role, not job title, is what the rest of this build
gates on". It is not true yet, so confirming it would be false; building it is the
honest reading.

## Q4. Sector-aware role labels — how far to take it now

**Decided:** implement the keyed-by-role-plus-sector lookup §3 asks for, but populate it
only where a real sector difference exists today (Director of Studies folding into SMT
is the independent-sector case §3 names). Every other label is sector-neutral for now.

**Why:** §3 wants the mechanism in place because "sector is known at signup and
DoS/year-group-leader isn't the only place this matters". Building the mechanism but
inventing sector-specific wording nobody asked for would be fabricating copy.

## Q5. "Current data" needs a national reference year, not a per-school one

**Decided:** `availableTeacherPhases()` takes the current period per phase as an argument
rather than deriving it from the school's own latest year.

**Why:** §5 says a tile requires data "not just historically, but in the most recent
available year". Deriving from the school's own rows would make a school whose last data
is 2022 look current against itself, which is exactly the case being excluded. Checked
against production: all three phases currently publish to 2024, and 385 KS4 plus 187 KS5
schools have data but nothing current — so this rule is load-bearing, not theoretical.

## Q6. KS2 "Roll" — a real trap in the census field names

**Found:** the census carries both `full_time_male_aged_10` and
`full_time_male_year_group_10`. §5 asks for "the age-10/Year 6 cohort". Year group 10 is
the GCSE year, not Year 6 — reading the wrong one would silently put a secondary cohort
on a primary card.

**Decided:** reuse the existing `populationAtAge(profile, HEADLINE_AGE.ks2)`, which
already resolves age 10 from the age breakdown, rather than writing a new lookup.

**Why:** §18 asks to confirm the card mapping against the real backend; it confirmed the
helper already exists and already takes the correct field. Rebuilding it would have been
a second, drifting copy with a live chance of picking the wrong one.

## Q7. §18 task 3 — comparability coverage, with one real edge

**Found:** all 37 distinct real KS5 qualification strings classify into a bucket, zero
unclassified. But `A level` and `Applied general` as RAW strings fall into "other",
because the rule matches `GCE A level` exactly. Those are DfE's 2020 cohort-level labels,
a different file layout with no grade detail at all.

**Decided:** leave it. Those rows cannot be scored regardless (no grades), so "other" —
which never carries a points figure — is the honest destination. Flagged rather than
"fixed", because making the rule match them would imply 2020 can be scored when it cannot.

**Note:** T Level does not appear among the 37 because it lives in its own source
(`dfe_tlevel_results`); it is classified separately and correctly.

## Q8. Blocked: schema changes could not be applied

Not a judgment call — recorded here so the log is complete. Applying DDL to
`vicdata-public` was blocked by the environment during this build, so the Phase 1 role
migration is written and committed but NOT applied, and every phase requiring new tables
(saved state, Recruitment, Meetings, notes) could not be built or verified. Read access
was unaffected, so all real-data verification in this round is genuine.

## Q9. `normaliseRole()`'s legacy branch is now dead — strip or keep?

**Verified first:** the constraint now reads
`role = ANY (ARRAY['teacher','hod','smt','finance','admissions'])`, the default is
`'teacher'`, and the single membership row reads `teacher`. So no new write can produce
`head_governor`, `director_of_studies` or `head_of_department`.

**Decided:** keep the function, keep its NULL handling, and keep the legacy map — but
re-comment the map as unreachable-in-normal-operation rather than leaving it looking like
live logic.

**Why:** two separate things were tangled here. The NULL branch is genuinely still
reachable: a CHECK constraint passes on NULL, so `role` can still be explicitly set to
NULL, and `normaliseRole(null) -> teacher` is the rule that makes Teacher the baseline.
The three legacy string branches are genuinely dead. Deleting them costs nothing today,
but they are the only executable record of §3's folding rules, and they would bridge a
restore from a backup taken before the migration. Six lines, honestly labelled, beat a
silent gap if that ever happens.

## Q10. What a school with zero available phases sees

**The gap:** Phase 2 verification found an independent junior/prep has no available phase
at all — confirmed zero KS2 data (0 of 1,588 open independents), and no KS4/KS5 access.
St Paul's Cathedral School is a live example. The brief does not say what that teacher's
home screen shows.

**Decided:** a genuine, explanatory empty state, not a blank screen and not a fabricated
or greyed-out tile. It says plainly which phases the platform covers, states that DfE
publishes no KS2 results for independent schools and no accessible KS4/KS5 data for this
school, and points at what the platform genuinely does hold for them (roll and context
data). It never implies the data is coming, because for this school type it is not.

**Why:** §5 is explicit that there is no third "locked/teaser" state, so a greyed tile
would contradict it. The standing discipline is that an absence must be explained rather
than rendered as a gap. And the cause here is structural, not a coverage gap that a
future ingest fixes, so "not yet" wording would be untrue.

## Q11. Shape of the persistence schema

**Decided:** seven small creator-only tables rather than one generic key/value store;
onboarding modelled as "a row exists" rather than a boolean column.

**Why:** §5 says completing a walkthrough is literally what unlocks a phase, so presence
of a row IS the state — a boolean would need a separate "unset" meaning. Separate tables
keep Recruitment's `candidate_name`, the only personal-data field on the platform (§10),
isolated in one place with its own retention column, rather than buried inside a shared
JSON blob where it could not be found or purged reliably.

## Q10a. CORRECTION to Q10 — the empty state is smaller than I made it

**Corrected mid-build by Guy.** My Q10 answer treated "no available phase" as a design
problem needing an explanatory dashboard. It is not. Teacher view is subject-exam-data
only. An independent junior/prep sits no public exams at that stage and has confirmed
zero KS2 data, so there will never be exam data for this school type to show here. It is
Teacher view not applying to the school, not a gap in it.

**Two things my first version got wrong:**

1. It was too elaborate — three paragraphs building an experience around an absence that
   needs one honest line.
2. Its "in the meantime" phrasing implied the data was coming. It is not, and "no data
   yet" or "coming soon" would both be untrue.

**Also added:** the original risked implying the platform holds nothing for this school.
It does — SMT, Finance and Admissions views are built on rolls, feeder schools and
catchment context, none of which depend on exam data, and this school type has all of
them. Those views are not part of this build, but the empty state now says plainly that
this is a "someone here should be on a different role" case rather than a dead end.

## Q12. The nearest-neighbour pool is geographic only, so rankings needed phase filtering at BOTH ends

**Decided:** filter the neighbour pool by the phases that actually sit the stage, at KS4
and KS5 as well as KS2 -- `KS4_KS5_PHASES = Secondary, All-through, 16 plus, Middle
deemed secondary`, alongside the existing `KS2_PHASES`.

**Why:** `school_nearest_neighbours` is a pure distance table. I had filtered it for KS2
(where "the nearest 10 primaries" is explicitly what §5 asks for) but left the KS4/KS5
path filtering on `status` alone, on the assumption that a secondary's nearest schools
would be broadly secondary. That assumption was wrong, and only real data showed it:
**Haverstock School's ten nearest schools contain zero secondaries** -- five Primary and
five "Not applicable" independent preps -- so its Rankings card ranked it "position 1 of
2" against a comparator set that was almost entirely primary schools. Technically true,
completely useless, and worse than showing nothing because it looks like a real result.

This was caught by running the real card against a real school, not by reading the code,
where it looks correct: the KS2 branch has an obvious filter and the KS4 branch has an
obvious `status` check, and nothing about the shape of it suggests a problem.

**After the fix, verified against live data:**

| School | Stage | Neighbours | Phases | With a real figure | Rank |
|---|---|---|---|---|---|
| Haverstock School (100049) | KS4 | 10 | Secondary x10 | 11 of 11 | 10th of 11, A8 41.5 |
| Haverstock School (100049) | KS5 | 10 | Secondary x10 | 10 of 11 | 6th of 10, APS 32.52 |
| St Peter's Methodist Primary (118707) | KS2 | 10 | Primary x10 | 10 of 11 | 5th of 10, RWM 63% |

The two neighbours with no figure are correct, not gaps: **St Stephen's Infant School**
takes no KS2 tests, and **Lift Beacon High** has no A-level cohort. Both stay visible in
the comparator list without a fabricated number.

**Also changed:** `fetchNearestSchools` now takes a 100-row slice like
`fetchNearestPrimaries` rather than 60, for the same reason -- once the pool is filtered,
the tenth real secondary can sit well down the geographic list in a primary-dense area.

## Q13. KS2 does not live in `academic_headline_snapshot`, and my first verification of it was wrong

**Logged as a correction to my own testing, not a code change.**

My first attempt to verify KS2 rankings reported "0 neighbours with data" for St Peter's
Methodist Primary and I nearly recorded it as a real gap. It was not. I had verified
through `academic_headline_lookup`, which is **KS4/KS5 only and returns 0 rows for KS2** --
KS2 comes from `canonical_facts` via the generic `reference_data_lookup` RPC with
`source_id='dfe_ks2_attainment'`. The route was never affected: it goes through
`fetchAcademicProfiles`, which already reads KS2 from the right place.

A second flaw in the same test: I had invented the measure keys rather than using
`HEADLINE_MEASURE`, so every stage silently scored null. The real keys are
`attainment8_average` (KS4), `A level::aps_per_entry` (KS5) and
`Reading, writing and maths::expected_standard_pupil_percent` (KS2).

**Why it is worth recording:** both flaws produced a clean, plausible, entirely wrong
"no data" result. A verification harness that reaches for a data source or a measure key
of its own rather than the one the code under test uses is not verifying that code, and
it fails in the direction that looks like a finding.
