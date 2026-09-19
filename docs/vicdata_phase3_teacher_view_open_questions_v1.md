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
