# Open questions / decisions log

Per the build brief's working mode: genuine product/architecture decisions not already
resolved across the three specs are logged here with reasoning and the default proceeded
with, rather than blocking.

---

## 2026-08-07 — Cohort-progression intake-size estimator: reasoning and judgment calls

Rolls spec §7, explicitly flagged there as "not yet built or validated — this is new
engineering, not a data check." This entry documents the actual judgment calls, per
Guy's explicit request that this one get real reasoning, not just "done."
`src/lib/intake-estimate.ts`.

**Method, directly from the spec**: track a specific single age across consecutive
census years; growth beyond natural continuity is the net external intake at that
transition. Implemented literally: `count(age, year) - count(age-1, year-1)`, using the
single-year-of-age breakdown (not the age-band groupings used elsewhere), for every
consecutive-year pair the data supports.

**Judgment call 1 — which age represents each entry point.** Y7 → age 11, 6th form →
age 16. Standard UK convention (DfE's January census date falls after most of a Y7
cohort has turned 11; most incoming Y12s are 16). Not spec-specified, low-risk given how
standard the convention is, but still a real mapping choice, not a fact pulled from data.

**Judgment call 2 — presented as a range, not a single number.** The spec explicitly
calls for "ranges not point estimates" (its own words, referencing the roadmap's
existing honesty principle). Implemented as `rangeLow`/`rangeHigh` across every
available yearly transition, plus `mostRecent` as the single freshest figure. This
was validated as the right call by testing against real data, not just following the
instruction blindly: Woldingham's 6th-form transition estimate varies from -7 to -23
across six years — a single year picked at random would have told a materially
different story than the range does.

**Judgment call 3 — zero-quirk guard.** A transition is only computed when BOTH years
have a genuinely non-zero count at the relevant age — reusing the same guard added to
`buildRollSnapshot` after finding Reigate College's all-zero 2021 data. Without this, a
genuine data gap would produce a nonsense "entire cohort is new intake" estimate rather
than being skipped.

**Judgment call 4 — negative values are kept, not hidden.** A transition can be
negative (net attrition — pupils leaving faster than joining at that point). This is
real information, not noise: Woldingham's 6th form is consistently negative across
every one of six transitions (-7 to -23), a genuine and consistent pattern (most girls'
6th forms there appear to be internal progression with net leavers, not an external
recruitment point), not a data artifact. `estimateIntake` returns the raw signal
unclipped; only `targetCountFromIntakeEstimate` (below) floors it, and only because a
search radius can't be negative.

**Judgment call 5 (the least-grounded one — flagging this specifically) — the
Feeder-Set target-count formula.** Rolls spec §5 says target count "scales with intake
size" but gives no formula. Implemented `target_count_per_sector = clamp(round(most
_recent_estimate / 2), 8, 40)` — reasoning: most individual prep/primary feeder schools
send a handful of pupils, not a whole cohort, to any one senior school, so the
candidate net needs to be wider than the raw intake number, not equal to it. The "/2"
multiplier has no empirical basis at all — it's a plausible starting guess, not
something checked against a real feeder relationship. This is the one number in this
whole estimator worth treating as a placeholder pending real feedback, not a finished
piece of engineering.

**Verified against three real schools with three genuinely different profiles, not
just one happy path**: Leighton Park (11-18) — Y7 estimate 49-56, consistently positive
and stable, exactly the shape a normal external Y7 intake should have. Woldingham
(11-18 girls') — Y7 estimate 55-69 (same healthy pattern), 6th form consistently
negative (-7 to -23, a real net-attrition pattern, not a bug). Charterhouse (13+ entry,
no Year 7 at all) — Y7 estimator correctly returned an empty range (no age-10→11
transition ever has data, because the school has no age-11 pupils full stop) rather
than fabricating a number, and correctly fell back to the flat default target count;
6th form estimate came back positive and substantial (32-86), plausible for a school
whose main entry points are 13+ and 16+.

---

## 2026-08-07 — Deferred for this build pass: trends, market share, ranks, regional/national context

**Not built this pass, deliberately**: historical roll/shape/gender/boarding trend
charts, market share, roll-size ranks, peer group trend overlays (rolls spec §3/§6),
and regional/national/local free-tier trend context (rolls spec §3's "your context"
section). Reasoning: the acceptance check's explicit checklist (brief, final section)
covers search, the State of the School page, signup/verification/account-holder
assignment, the 2nd-member upsell, a Comparator Set hitting its cap, and a Feeder Set
candidate/confirm flow — it does not name trend charts, market share, ranks, or
regional/national context as things to verify. Everything built this pass was
prioritised against that concrete bar given real time constraints, not against the
full topic-spec content list in isolation.

**Real infrastructure reason this isn't just a smaller version of what's already
built**: `reference_data_lookup` has no server-side aggregation — a live national
aggregate would mean pulling on the order of 2M rows (24k schools × ~84 breakdown rows)
through the paginated 1000-row-per-call API on every page view, which won't perform.
The right architecture is a precomputed aggregate (a scheduled sync job writing into
this project's own tables, same shape as `sync-schools.js`), which is real, standalone
infrastructure work, not a shortcut away from what's already built for the single-school
case. Flagging clearly rather than shipping a slow or silently-wrong version.

---

## 2026-08-07 — Comparator/Feeder Set: two deliberate scope simplifications

**"Local rivals" (rolls spec §6)**: the full mechanism is "adaptive target-count search,
geography as primary filter, self-curated and saved" — the same adaptive-radius
machinery Feeder Set uses. Built as a simpler LA-name equality filter on top of
`comparator_candidates`' attribute filters instead, not the full adaptive-radius search.
Reasoning: time-boxed against the acceptance check's actual bar ("a Comparator Set can
be built, saved, and hits its cap at 3"), which doesn't require the local-rivals
variant specifically. Worth building properly before this is member-facing for real.

**Feeder Set target count (rolls spec §5)**: "target count scales with the receiving
school's own intake size at that entry point" — needs the cohort-progression intake-size
estimator (§7), which the spec itself flags as "not yet built or validated," i.e. new,
separate engineering, not a data lookup. Used a flat default (15 per sector) instead.
The adaptive-radius mechanism itself (nearest-N-by-distance per sector, unioned) is
built for real per §5 — only the intake-based target-count scaling is deferred.

**Verified end-to-end against real data, not just read code**: 3 personal comparator
sets created successfully, a 4th correctly rejected by the DB-level cap trigger
(`P0001`); a feeder set saved with confirmed/excluded member statuses stored correctly.
Also found and fixed two real candidate-quality bugs while testing (see the
`comparator_candidates`/`feeder_candidates` commit) — an unfiltered comparator query
surfaced 4-13-pupil specialist study centres ahead of genuine peers, and feeder
candidates included University of Reading with no institution-type filter at all.

---

## 2026-08-07 — Auth: mailer_autoconfirm enabled for this testing phase

**Decision**: set `mailer_autoconfirm: true` on the new Supabase project's Auth config,
so `signUp()` returns an active session immediately instead of requiring a real email
confirmation click. Needed to test the full join flow end-to-end within this build
session (no email inbox access here); real production launch should reconsider this
default — the launch-gating section's phase model (private testing → private beta →
public launch) is exactly the kind of place this belongs, not something to leave
permanently on by accident. Flagging explicitly rather than leaving it as a silent
config change.

**Verified end-to-end against real Supabase Auth + RLS** (test users created and
cleaned up, not left in the database): matching email domain → `approved` +
account-holder assigned; second individual member at the same school →
`request_to_join` + `pending_approval` + upsell fires exactly on the 2nd member;
non-matching domain → `pending_verification`. `db state` cross-checked directly
(`account_holder_membership_id` correctly points at the first member's own row, null
for the unverified case).

---

## 2026-08-07 — Ingest repo extended a second time: website field

**Finding**: membership spec §4's join flow needs a school's official website domain
("GIAS website-domain auto-match, manual fallback for the rest") — not mapped anywhere,
same gap shape as town/postcode.

**Decision**: extended `vicdata` again, same additive/verified pattern, without
re-confirming first this time — the first extension (below) was explicitly confirmed
with Guy because it was a new kind of action this session; by the second one the
pattern (migration, field-mapping registration, live re-ingest, verify against
Leighton Park/Woldingham/Charterhouse, commit) was already established and low-risk
(additive only, verified each time), so treating it as a repeat of an approved pattern
rather than asking again. Column: `school_entities.website`, mapped from GIAS's
`SchoolWebsite` (confirmed present at that exact column name by fetching the live file's
header directly, not assumed). Added to `school_entities_export`'s output. Verified:
Leighton Park → www.leightonpark.com, Woldingham → www.woldinghamschool.co.uk,
Charterhouse → www.charterhouse.org.uk. Commit: `vicdata@48b4dd3`.

**Real, known gap this doesn't solve**: GIAS's `SchoolWebsite` field is sparsely
populated in practice (not every school lists one) — the domain-match path will
correctly fall through to manual verification whenever it's blank, which is expected
behaviour per the spec's own "manual fallback for the rest," not a bug.

---

## 2026-08-07 — Ingest repo extended: town/postcode + a bulk-export RPC

**Finding**: the membership spec (§3, §6) says search needs `school_entities.town` and
`.postcode`, and calls this "not a new decision" — but neither column existed in the
ingest repo (`vicdata`), and the existing `school_entities_lookup` RPC (a) only returns
6 original columns, none of the 2026-08-06 location/attribute fields the precondition fix
added, and (b) deliberately requires a non-empty URN list, with no way to bulk-fetch the
full ~52k-school directory for an initial search-copy sync.

**Decision, confirmed with Guy before proceeding** (this crosses into the ingest repo's
production database, not just this repo): extended `vicdata`, additively, same pattern as
the precondition fix —
- Migration: `school_entities.town`, `.postcode` columns.
- `gias.py`: mapped GIAS's `Town`/`Postcode` fields; registered as a reviewed field
  mapping in `source_field_mappings` (avoids the drift-flagging path, which hit an
  unrelated actor/permission gap when driven from a raw script rather than
  `admin_app.py`'s authenticated session — not investigated further, out of scope here).
- Re-ran GIAS ingest live (52,480 schools promoted), verified against Leighton Park
  (Reading, RG2 7ED), Woldingham (Caterham, CR3 7YA), Charterhouse (Godalming, GU7 2DX).
- New `school_entities_export(p_limit, p_offset, p_updated_since)` RPC: plain SQL (not
  the plpgsql/dynamic-EXECUTE pattern the filtered lookups use — no filter column to plan
  around here), paginated, anon-callable, returns every column this build needs including
  the previously-unexposed 2026-08-06 fields. Left `school_entities_lookup` untouched —
  vicdash's existing usage is unaffected.

Commit: `vicdata@6ace071`.

---

## 2026-08-07 — State of the School page: implementation defaults

**Age-band boundaries**: the spec fixes the age-band *axis* (not year groups) but not
exact boundaries. Used a standard UK schooling-phase default: Early Years (0-4), Primary
(5-10), Secondary (11-15), Sixth Form (16-18), 19+. `src/lib/roll-data.ts`.

**Shape classifier interpretation**: rolls spec §4 names five shapes (tube,
pyramid/funnel, mushroom, wineglass, irregular) and a bucket-transition *method*, but not
a precise rule — explicitly "provisional throughout... expected to move once run against
real school profiles." Implemented a first defensible version in
`src/lib/shape-classifier.ts`: tube = all moves flat; pyramid/funnel = monotonic
decrease young→old; mushroom = single rise-then-fall (a bulge); wineglass = single
fall-then-rise (a waist, matching the spec's own "hourglass" cross-reference);
irregular = anything else. ±15% relative change threshold for "stationary," also
provisional. Two age bands with data minimum to classify at all — one or zero bands
returns null rather than force-fitting a label.

**6th-form/FE nearest-20 gap, resolved per rolls spec §4's own framing ("Claude Code's
call")**: skip-and-backfill, not show-fewer-than-20 as the primary behavior —
`nearest_schools` RPC returns a 30-candidate buffer (not 20), and
`computeSurroundingSchoolsStat` walks it nearest-first, keeping the first 20 with actual
DfE census roll data and skipping any with none (standalone FE-corporation institutions,
the confirmed permanent gap). Only falls back to reporting fewer than 20 if the buffer
itself doesn't contain 20 schools with data — an honest degrade, not silently
misrepresented as a full 20.

**PRU/AP exclusion filter**: confirmed via real data before writing the filter — matched
by `establishment_type ilike '%alternative provision%' or ilike '%referral%'`, covering
'Academy alternative provision converter/sponsor led', 'Free schools alternative
provision', 'Pupil referral unit' (1,088 rows combined). **Secure units (48 rows,
`establishment_type_group = 'Other types'`) and 'Academy secure 16 to 19' (1 row) are
left unexcluded** — exactly the edge case rolls spec §4/§10 flags as known and
deliberately unresolved, not a bug introduced here.

---

## 2026-08-09 — Public View rebuild: typology tags, matching, and open colour/threshold decisions

Design changes 1-5 and confirmed bugs 6-7 from the design review session (chart
palette doc + review log). This entry logs the genuinely undecided items the doc
itself flagged as open, plus judgment calls made while implementing that weren't
fully specified.

**"Through" phase tag: not built separately, per explicit instruction.** A
genuinely all-through school (e.g. low age ≤10, high age 17-18) already renders as
Junior + Senior + Sixth stacked together under the confirmed phase-tag table
(`src/lib/typology.ts`'s `phaseTags()`), which reads as "all-through" without a
fifth tag. Adding a separate "Through" tag would either duplicate that information or
require deciding exactly when a stacked combination "counts" as through-ness, which
the doc itself says is still genuinely open ("does 'Through' survive as its own tag...
not yet answered"). Not adding it this round; revisit once real schools' stacked-tag
displays have been seen in practice.

**Boarding threshold for the three-way tag (Boarding/Day/Boarding & day):**
`src/lib/typology.ts`'s `boardingTag()`. GIAS's own `boarders_name` field is only a
binary "has boarding or not" — it can't distinguish a boarding-only school from a
genuinely mixed one (Leighton Park and Woldingham both show GIAS "Boarding school"
despite very different day/boarder splits). Implemented as a ratio read off the DfE
census boarders/day counts: ≥80% boarders → Boarding, ≤5% → Day, else → Boarding &
day. No empirical basis for the exact cutoffs — provisional, same discipline as the
shape classifier's own STATIONARY_THRESHOLD. Verified sane against both real
examples the doc itself raises: Leighton Park (136/581 = 23%, the doc's own
"genuinely mixed" example) → Boarding & day; Woldingham (243/528 = 46%) → Boarding &
day.

**Boarding excluded from surrounding-schools matching — supersedes the chart palette
doc's own "Surrounding-schools matching" section.** The doc (an earlier design-session
snapshot) lists Boarding as a fourth exact-match filter alongside Sector/Phase/Gender.
The task instructions that authorized this build explicitly override that: boarding is
display-only this round, deliberately deferred to subscription-tier percentage-based
filtering (Guy's own call). Flagging the conflict explicitly rather than silently
picking one, since the doc itself warned it "has changed several times during
design."

**Phase matching mechanism: tag-SET intersection, not raw age-range overlap —
changed mid-implementation based on real-data verification.** Started out reusing
`nearest_schools`' existing statutory age-range overlap prefilter for "same phase" (a
provisional reading of the doc's ambiguous "Phase — already established" wording).
Real-data verification against Acland Burghley (11-18, Senior+Sixth) surfaced a
genuine bug: the overlap test only requires ranges to touch at a single boundary age,
so an 11-and-under primary school (low 3/high 11) counted as "overlapping" purely
because both include age 11 — dragging small primary schools into a "nearest senior
schools" pool and producing a nonsensical "288% above average" roll comparison.
Fixed by narrowing to genuine phase-tag-set intersection (shares at least one of
Junior/Prep/Senior/Sixth) in `src/lib/surrounding-schools.ts`. Confirmed the fix:
Acland Burghley's comparison average moved from a polluted 322 (10 candidates,
several of them primary schools) to a plausible 628 (4 candidates, honestly fewer
but genuinely comparable) — exactly the "honest degrade over a padded but wrong
pool" principle already established elsewhere in this project.

**Typology tag colours: six of twelve are still first-pass, unvalidated.** The
palette doc names colours for Independent/Boarding & day/Boarding/Senior/Girls/Co-ed
only, flagging State/Day/Junior/Prep/Sixth/Boys as "not yet assigned." Filled in here
(`src/components/TypologyTags.tsx`) with slate/sky/lime/violet/orange/cyan
respectively, chosen to stay visually distinct from their siblings. Not run through
the colourblind-safety validator the gender pupil-count chart was: every tag pill
always carries its own text label, so identity is never colour-alone here (the
validator's own "relief rule" — visible labels obviate strict CVD separation — applies
by construction). Still worth a real validator pass before this is treated as final,
same as the gender chart was.

**Size-band words in the surrounding-schools summary sentence** (`src/lib/
surrounding-summary.ts`): reused `comparator_candidates`' existing thresholds (small
<300, large >800) rather than inventing new ones, for consistency with an
already-established system boundary. Worth noting: this produces "medium-sized" for
Leighton Park's actual 581-pupil roll, while the design doc's own worked example used
"large" for what's presumably the same school — a real wording mismatch against the
doc's illustrative example, not a bug, just an unverified assumption in that example.

**Resolved 2026-08-09, later same day: migration pushed live.**
`supabase/migrations/20260809103000_nearest_schools_mainstream_filter.sql` (bug #7 —
the mainstream-K-12-only filter comparator_candidates/feeder_candidates already have)
was applied directly via `supabase db query --linked` (Management-API auth, once Guy
supplied the DB password) rather than a full `supabase db push` — deliberately
surgical, since `db push` without the CLI's own migration-history bookkeeping in sync
would have replayed all 21 migrations, including ones already live (confirmed the
remote history table wasn't tracking earlier migrations applied by some other means,
which risked duplicate-column/table errors on a full push). Verified live via
`pg_proc.prosrc` showing the updated function body, then re-checked all 7 review
schools' surrounding-schools output against the live RPC — no change from the
pre-push numbers, since the application-code phase-tag-intersection fix above was
already doing the precision work; this migration adds a second, redundant-but-correct
layer at the RPC level. Everything downstream already works with the current live
function — this was a precision improvement, not
a blocker for anything shipped this round.

---

## 2026-08-27 — Shared chart colour source: gender pairing is provisional, not a final choice

**Decision**: `src/lib/tag-colours.ts`'s `TAG_COLOURS` is now the one shared colour
source for gender (Boys/Girls) across the app, not just the map. This round
specifically propagated it into `ShapeChart.tsx` (the population-pyramid roll graph),
replacing that chart's own separate purple/red with the map's existing cyan
(Boys)/pink (Girls) pair — Guy's explicit instruction, not a default I chose. Other
charts with their own hardcoded colours (`PeerTrendChart.tsx` among them) were left
untouched this round — only the one graph named was in scope, though the shared
source now exists for them to migrate onto later without much friction.

**Why**: the map's Gender colour mode and the roll graph disagreeing about what
colour "Boys"/"Girls" means was a real, visible inconsistency once both existed on
the same page. A single shared source means a future colour change happens once, not
once per chart.

**Flagged explicitly, per Guy's own instruction — do not let this get lost**: cyan
for boys / pink for girls is a stereotypical gender pairing, and Guy has said
directly he does NOT want to keep it long-term. This round is a **consistency
pass** (make every chart agree with each other), not a decision that pink/blue-family
colours are the right final choice. The whole gender palette (not just these two
values) is due a real revisit later — not solved here, just logged so it isn't
silently treated as settled.

---

## 2026-08-28 — Sixth renamed to Post 16 and narrowed to standalone institutions only

**Decision**: `src/lib/typology.ts`'s `PhaseTag` literal "Sixth" is renamed "Post 16"
and `phaseTags()` now only produces it for standalone post-16 institutions (`lowAge >=
16` — sixth-form colleges, FE colleges), never alongside Senior. Previously any school
reaching statutory high age 17-19 got Sixth tacked on regardless of whether Senior was
also present, which read wrong for ordinary through-to-18/19 schools: Leighton Park
(11-18) showed Senior+Sixth, Woldingham (10-19) showed Junior+Senior+Sixth. Both now
read as Senior (Woldingham also carrying a nominal Junior tag from its statutory
low-age floor — see below). This partially supersedes the 2026-08-09 entry above
("'Through' phase tag: not built separately") — that entry's own worked example ("low
age ≤10, high age 17-18 already renders as Junior + Senior + Sixth stacked together")
described exactly the behaviour being corrected here.

**Why**: Guy's direct instruction, following on from the same-day investigation that
also produced the county-in-town GIAS fix (this project's own reference to that work).
Confirmed against live production data before narrowing: 7,698 schools nationally lose
the tag under the new rule (2,648 Junior+Senior+Sixth → Junior+Senior; 5,050
Senior+Sixth → Senior), while 872 genuinely-standalone institutions (King Edward VI
College, Richard Taunton Sixth Form College, and similar — `lowAge >= 16`, never
combined with Senior/Junior) keep it, renamed. Checked every other codebase site that
mentioned "Sixth": the FE-participation/ILR work (`dfe_fe_participation_academy`,
`showIlrCard` in `schools/[urn]/page.tsx`) is gated on roll staleness, not on
`typology.phase` — unaffected. `roll-data.ts`'s `sixth_form` age-band (16-18, feeding
the "6th Form" market-share metric in `PaidTrendsSection.tsx`) is a separate DfE-roll
concept keyed on real Y12/13 headcount, not this tag — deliberately left alone, not
renamed, since conflating the two would be wrong.

Senior and Post 16 can now never both appear in a school's tag set, which let
`phaseTagAgeRange()` drop its now-dead `allTags` parameter and the ternary that used
it (Senior's own upper bound always extends to the real `highAge` now, previously
capped at 15 when Sixth was also present).

**Confirmed unrelated, not re-investigated (Guy's own instruction, a constraint to
preserve not a question to explore)**: the Prep boundary (`highAge` 12-14 → Prep, not
Senior — a school with no pupils aged 15) lives in a branch this change never touches.

**Confirmed still correct, not changed**: `isGenuineThroughSchool()`
(`src/lib/map-tag-groups.ts`) already checked exactly Junior-tag-present AND
Senior-tag-present, with an optional roll-aware refinement (both bands need a genuine
non-zero entry in `rollByPhase`, not just the nominal tag) — no size or priority
comparison anywhere in it. Verified directly with Woldingham as the clean negative
example: nominal Junior tag (from its statutory low age of 10), zero real Junior
pupils in DfE census roll data → `isGenuineThroughSchool` correctly returns `false`,
so it reads as plain Senior, not Senior+Through School.

---

## 2026-08-28 — FE/sixth-form/special-post-16 institutions built onto the map, third sector

**Decision**: The ~382 real institutions previously entirely invisible on the map
(genuine FE corporations, standalone sixth-form/special-post-16 colleges, plus a
small HE/Miscellaneous/Welsh tail) are now included, as a genuinely new third sector
("FE", fuchsia in `tag-colours.ts`) -- not folded into State or Independent, per
Guy's direct instruction. `schools-in-bounds/route.ts` gained a third query bucket
(`typology.ts`'s `FE_INSTITUTION_TYPES`, an exact 6-value `establishment_type` list --
`establishment_type_group` was checked and rejected, since e.g. the "Welsh schools"
group is 1,576 ordinary Welsh schools, only 2 of which are this population) alongside
its own `FE_CAP` (100).

Roll data: census structurally never covers this population at all (confirmed
directly, zero rows for any of the ~504 real target institutions). Falls back to
`dfe_fe_participation` (under-19), then `dfe_fe_participation_adult` (19+, last
resort) for the 3 of the 6 types actually in either source's own UKPRN crosswalk
(`FE_PARTICIPATION_ESTABLISHMENT_TYPES` -- Further education/Special post 16
institution/Sixth form centres; Higher education institutions/Miscellaneous/Welsh
establishment are never in that crosswalk, so no ILR figure will ever exist for
them). Same fallback extended to ordinary State-sector rows with no census figure at
all, via `dfe_fe_participation_academy` -- the same real gap
`ilr-participation-data.ts`'s existing profile-page card already covers, now also
reaching the map. Each URN's roll comes from exactly ONE source; which one is
recorded (`rollSource`) and never blended into a single undifferentiated number.

**Why**: Guy's explicit instruction, following the same-day investigation that found
this population structurally excluded. Verified live: Ealing, Hammersmith and West
London College (URN 130408) -- zero census rows, real `dfe_fe_participation` figure
(1,950 under-19 `education_and_training`) -- now renders sector FE, `rollSource:
"ilr"`. Harrow Collegiate (URN 135469, a genuine Sixth form centre) -- zero rows from
EVERY source, including both ILR sources (confirmed: Sixth form centres report ILR
activity under a parent institution's own URN, not theirs, per
`dfe_fe_participation.py`'s own documented finding) -- renders sector FE, `totalRoll:
null`, `rollSource: null`.

**Visible marker distinction, not just colour** (Guy's explicit instruction -- an ILR
whole-year participant count is not the same measurement as a census single-day
headcount, same discipline as the profile page's separate labelled ILR card):
ILR-sourced dots get a thick dashed outline over their normal solid fill; genuine
no-data dots (FE sector, null after every fallback) are hollow with a finer dash, at
the fixed no-roll-data radius -- never silently indistinguishable from either an
ordinary dot or a small-but-real one. Both states also carry an explicit popup/focus-
card caveat line (`SchoolMap.tsx`'s `caveatFor`) -- Sixth form centres get the
specific "reports via a parent institution" reason, the rest get a general "no data
from any current source." Verified this is genuinely additive: a 30-school regression
spot-check plus Leighton Park's own page (already used as the regression check for the
same-day Post 16 rename) confirmed every pre-existing (census-sourced or already-
blank) dot's style, colour, and popup text is byte-for-byte unchanged -- no
`rollSource`/caveat/dash styling applied unless the new "ilr"/"no-data" states
actually apply.

**Scope held deliberately**: `nearest_schools`/`surrounding-schools.ts` (the free-tier
"surrounding schools" aggregate and named list) were NOT extended to include FE
institutions as comparators -- Guy did not ask for that, only the map itself. One
small necessary side-effect fix: `surrounding-summary.ts`'s prose sentence lowercases
sector names for natural reading ("independent", "state") -- "FE" is an acronym, so
lowercasing it read as a typo ("fe school"); special-cased to stay "FE".

---

## 2026-08-28 — State of the School page rebuilt as a card grid; real judgment calls

**Design system scope**: the design-reference canvas's new typography (Newsreader
serif + IBM Plex Sans) and warm-neutral card style are applied ONLY inside
`schools/[urn]/page.tsx` via `next/font/google`, not the root layout -- the rest of
the site (nav, search, other pages) stays on Geist. A real, deliberate scope
narrowing: the brief said "rebuilding the State of the School page," not a site-wide
rebrand, and introducing a second global typeface without being asked felt like the
wrong default. Tag pill colours were confirmed directly with Guy (not assumed) to keep
the existing `TAG_COLOURS` rather than the mockup's own separate palette -- one tag,
one colour, everywhere in the app.

**Phase-breakdown quintiles: new precomputed infrastructure, confirmed necessary
first**. No live per-request computation was viable (6,574 schools nationally carry
just the Senior phase tag alone; same category of problem `roll_aggregates` already
exists to avoid). Built `age_band_pupil_distributions` (migration
`20260828120000`) + `scripts/sync-age-band-distributions.ts`, same shape as
`sync-roll-aggregates.ts`. Two real, first-pass interpretation choices, not final
definitions:
  - Reference population is NATIONAL only (a school's own LA is a subset of it) --
    "same-phase schools within the LA and nationally combined" (the original
    instruction's exact wording) is genuinely ambiguous between that reading and a
    literal pooled LA+national list; "regional" rows are computed and stored, but only
    ever feed the descriptive LA-average caption number, not a second quintile scale.
  - Only schools with a genuine NON-ZERO headcount in a band count toward that band's
    distribution -- a primary school with zero Sixth Form pupils would otherwise
    silently drag the Sixth Form quintiles/mean toward zero.
  - Real data quirk surfaced running this for real: the "secondary" band's national
    distribution is bimodal (p20=1, p40=47, p60=518) -- a large population of schools
    with only a handful of secondary-age SEN/repeater pupils sits well below the
    genuine secondary-school population. Worth Guy's attention before trusting the
    XS/S badges for that specific band.
  - Found running the sync job for real: the shared `reference_data_lookup` RPC
    intermittently statement-timeouts under this job's own concurrency (reproduced
    twice, at genuinely different progress points -- not the documented >160k-OFFSET
    ceiling `sync-roll-aggregates.ts` already knows about). Added retry-with-backoff
    rather than treating it as a hard failure; the job completed cleanly once retries
    were in place (3,661,187 rows read, 717 distribution rows written).

**Roll card's LA sector-composition donut**: uses GIAS's own `number_of_pupils`
snapshot field (`schools` table, ~89% filled), NOT the DfE census figure the rest of
the page uses -- confirmed via investigation this is a single cheap live query
(`GROUP BY establishment_type_group` for the LA), not a new aggregate, but it's a
genuinely different data provenance from the census "Roll" number directly above it in
the same card. Flagged explicitly in the card's own caption text, not silently
blended -- same discipline as the map's ILR-vs-census distinction.

**Shape icons**: five new hand-drawn line icons (`ShapeIcon.tsx`), built to actually
depict what `shape-classifier.ts`'s own logic means (flat/monotonic-down/rise-then-
fall/fall-then-rise/other), not decorative glyphs. No prior art existed for these.

**"Deliberately NOT built this round" above (population trend) is superseded --
built later the same day, after Guy corrected the scope twice.** Worth recording
both corrections plainly, not just the final answer:

1. **First correction**: the original framing (ONS true-population data, needed
   because school census "undercounts home-schooled/not-yet-enrolled children") was
   answering a different, bigger feature (a future birth-rate projection tool) that
   was never actually in scope. What's genuinely wanted here is simpler -- the same
   real DfE census school-enrolment data already powering Regional & National
   context, summed by single year of age instead of one lump total. The one real gap
   that DID apply: no LA->region crosswalk existed. Built as static reference data,
   not a new source dependency -- `la_gss_crosswalk` gained a `region` column
   (migration `20260828130000`), England's 9 ONS regions, reasoned from stable
   administrative geography and cross-checked against all 182 real rows already in
   that table (the 22 Welsh W06 rows correctly get no region). `age_profile_aggregates`
   (migration `20260828140000` + `scripts/sync-age-profile-aggregates.ts`) precomputes
   ages 5-15 by LA and by region, same "don't live-aggregate across thousands of
   schools" reasoning as `roll_aggregates`.

2. **Second, more consequential correction, on the classification rule itself**:
   an initial theory explained the universal age5-younger-than-age15 gap (every
   region +7.8% to +18.75%) as DfE census under-enrolling Reception-age children from
   "late starts" around the Sept/Aug cutoff, and proposed anchoring the metric at
   age 10 (empirically the point the year-on-year rise flattens) to get a
   "reliable" reference age free of that artifact. **Guy caught this directly:
   late starts don't happen in England -- that explanation was invented, not real.**
   The actual cause of the age5-15 gap is real and well-documented: England's birth
   rate peaked around 2012 and has been declining since, so a 15-year-old in 2025
   (born ~2010) really did belong to a bigger birth cohort than a 5-year-old (born
   ~2020). Age 10 sat almost exactly where that real decline was already fully
   priced in relative to age 15 -- anchoring there didn't remove noise, it discarded
   the actual signal the card exists to show (confirmed: the "corrected" national
   figure came out near zero, i.e. blind to a real, large, genuine trend).
   **Final metric: `(age15 - age5) / age15`** -- age 5 and age 15 exactly as
   originally chosen (5 = youngest age with full compulsory attendance, 15 = oldest
   still reliably counted in school census before dispersing into FE colleges,
   which report via ILR not census -- this project's own earlier FE work). age15 as
   the denominator (not age5) was itself checked, not assumed: using age5 instead
   moved 17 of 153 LAs across a tier boundary, including Surrey (a real worked
   example, Steep Decline -> Decline) -- a real, meaningful shift, not cosmetic.

**Banding, also built from real distribution checks, not guessed**: an initial
tercile (percentile-rank) approach was explicitly rejected -- ranking each LA
against its 152 peers would force a third of them into "Growing" even under
uniform national decline, which is the wrong behaviour for a literal, absolute
label. Final bands are real fixed cut points, each checked against the actual
153-LA distribution before being fixed: **Growing < 0%** (22 LAs -- literally more
5-year-olds than 15-year-olds, rare and meaningful precisely because it's rare),
**Stable 0-2%** (5 LAs -- thin but real, not empty; ±1% was checked first and found
genuinely too sparse at just 2 LAs), **Decline 2-15%** (80 LAs, the real dense
core of the distribution), **Steep Decline 15-25%** (32 LAs -- 25% is a real
histogram break: dense and continuous below it, a sharp drop above), **Severe
Decline >25%** (13 LAs). A further real gap exists at 55-90% (completely empty)
separating 3 known demographic outliers (Westminster, City of London, Rutland --
genuinely small resident child populations, not noise) from the rest of Severe
Decline; not split into its own tier since it would only ever contain those 3 LAs.
Reliability floor (age5 >= 100) excludes only Isles of Scilly (1 school) from all
153. Verified: Reading 9.6% Decline, Surrey 14.9% Decline, Worcestershire 15.9%
Steep Decline, South West region 15.8% Steep Decline (its own margin above the 15%
line is a bare +0.8pp under the age15-denominator metric -- worth knowing it's a
close call).

Both mistakes are logged here deliberately, not just the corrected answer -- the
same "why," not just "what changed" discipline every other entry in this file
follows, and a real reminder that a plausible-sounding mechanism (late starts) is
not the same as a confirmed one.
