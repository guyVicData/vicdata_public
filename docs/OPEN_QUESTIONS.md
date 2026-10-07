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

---

## 2026-09-21 — Teacher view round 5 (card mechanism): where the brief and the real build differ

Round 5's brief was written from the Design-artifact mockups (Versions 33/34), not from
the repo. Several things it treats as already built only exist in the mockups. Logged
here rather than silently built or skipped.

**1. Round 4's box structure was never built for real.** The real dashboard had no
per-view boxes, no fullscreen toggle, no share icon and no "Edit this view →" link. Its
builder link reads "Expand" / "Add a view (N pinned)". This round builds the boxes and
fullscreen because titles and fullscreen need somewhere to live (`CardBox.tsx`). It does
**not** add a share icon, because the brief says to leave the share icon alone and there
was no icon to leave. It also leaves the "Expand" wording unrenamed. Both are round-4
items still outstanding.

**2. The real view catalogue is not the mockup's `VIEWS` arrays.** `teacher-view-catalogue.ts`
generates views as §8's five comparison axes × each ticked subject × an optional trend
variant. The same menu is used for Candidates, Results and School Context. Rankings has
no menu at all. So the round-5 short titles were applied to what exists:
- Axis views use the School Context list verbatim: "Vs. [qualification] average",
  "Vs. [subject family]", "Vs. whole school", "Vs. your comparison set",
  "[Subject family] vs. every category".
- Each column's unpinned default content uses the default titles: "Entries this
  year", "Average point score", "Share of entries", "10 nearest schools".
- These mockup views do **not** exist in the real catalogue, and were not added, because
  the brief says the catalogue is confirmed as-is:
  - Candidates: "Entries vs. Nearest 10" and "Entries, % of year group"
  - Rankings: "Nearest 10, as a list", "Nearest 10, same sector", "Local rivals" and
    "Similar-sized schools"
  
  "Entries, 5-year trend" and "Points, 5-year trend" map to the axis trend variants
  instead. **Decision needed:** are the missing Rankings comparator sets wanted? They
  would be new comparator logic, not titling.

**3. Trend titles say the real span, not "5-year".** Trends are offered from 3 years up
(`TREND_MIN_YEARS`), so the title is "Vs. whole school, 4-year trend" and so on. A fixed
"5-year" would be wrong on most subjects.

**4. KS2 default titles are my call.** The brief only covers GCSE/Post-16. At KS2,
"Entries this year" and "Share of entries" would be false, so KS2 uses "Year 6 cohort"
and "Nearest primaries". Please confirm or reword.

**5. Pre-existing, not fixed: KS2 Results card.** It says "Pick a subject below to see
its results", but KS2 has no subject picker (it is hidden for KS2), so the card can never
show anything.

**6. Pre-existing, not fixed: "Vs. your comparison set" loses its subjects on reload.**
The chosen subjects are kept in ColumnBuilder's local state by design (Phase 4 comment).
So a pinned box of this kind is empty after a reload until subjects are re-ticked. Now
that it carries its own titled box, that is more visible than it was.

**7. Local live verification is blocked by the Q25 auth change.** The project's Auth
Site URL is now https://vicdata.co.uk and localhost is not on the redirect allow-list.
The preview-session route therefore correctly refuses on a local server ("Supabase
substituted the redirect target"). Round-5 code is not deployed, so neither
vicdata.co.uk nor localhost can currently be driven as the preview profile. To fix it,
either add `http://localhost:3010/**` to the Auth redirect allow-list, or sign in on the
local server by hand.

### Follow-up, same day — gaps closed and shipped (gaps-and-ship brief v1)

Items 2 (Rankings/Candidates views), 4 (KS2 titles), 5 (KS2 Results card) and 6
(comparison set persistence) above are now built. Item 7 (localhost not on the Auth
allow-list) is unchanged; verification moves to the live site instead. The judgment
calls, so they can be vetoed:

**Independent schools were missing from every Teacher view neighbour pool.** A real,
pre-existing bug, found while building "same sector". All 1,588 open independent schools
have phase "Not applicable", so the KS4/KS5 phase filter dropped every one of them. An
independent school's "Nearest 10" was therefore entirely state schools. Fixed in
`inStagePool`: an independent school joins the pool when its statutory age range reaches
the stage (GCSE year, or a sixth form). That still excludes the 3–13 preps the
Haverstock fix was about. **This changes the default Nearest 10 as well**, deliberately,
because every set comes from one pool. Acland Burghley's Nearest 10 now includes Collège
Français Bilingue and Channing; Highgate's same-sector set is ten real independents.

**GCSE IGCSE exclusion now applies in Teacher view too.** Once independents enter the
pool, an IGCSE-heavy school's Attainment 8 would rank as if comparable. The advanced
dashboard's own rule (`igcseExclusionLikely`) is reused: the school stays in the set,
unranked, labelled "IGCSE, not comparable", and the map drops its dot with the existing
note.

**How each new Rankings set is defined.** All four are selections from the same
phase-filtered 100-nearest pool as Nearest 10:
- *Same sector*: the nearest ten of the target's own sector, state or independent.
- *Local rivals*: the nearest five state and nearest five independent schools. This is
  the existing Local-rivals recipe's per-sector split (the comparator builder's
  `feeder_candidates` mode), applied to the phase-filtered pool rather than by calling
  `feeder_candidates` itself. That RPC has no phase filter, so for a secondary school it
  returns mostly primaries.
- *Similar-sized*: the ten pool schools whose latest exam cohort (the figure the map
  sizes dots by) is closest on a log-ratio. Not offered at KS2, which has no exam-cohort
  size.
- All sets can come out short of ten where the pool runs out, for example independents
  in a state-dense area. Short sets are shown as they are, not padded.

**The new Rankings views are ranked lists, not maps.** The map stays on the default
"10 nearest schools" box. Giving each set its own map would need a per-set profile
fetch; that's worth doing if the lists read thin on screen.

**"Entries, % of year group"** divides each ticked subject's entries by the whole exam
cohort of the same year: `pupil_count` at GCSE, and the whole-institution 16–18 count at
Post-16. If that year has no cohort figure, the box says so rather than dividing by
another year's.

**KS2 Results card** now shows the school's own KS2 headline against the nearest
primaries' average, instead of asking for a subject. At KS2 the subject-scoped columns
no longer show an "Expand" link, which led to "Tick a subject first".

**Corrected, see the entry below:** this originally said the independent pool "now also
admits independent special schools", citing "Unique Children's School". That was wrong.
Unique Children's School is an ordinary "Other independent school" in GIAS, and
independent special schools never reach a mainstream school's pool at all.

---

## 2026-09-21 — Independent special schools in Teacher view Rankings: already excluded, nothing to build

The independent-special-schools brief asked to extend the state-special-school
exclusion to independent special schools. Looking for that exclusion showed it already
covers both sectors, one layer below Teacher view. The premise came from my own round-5
note above, which mislabelled a school.

**Where the exclusion lives:** `public.nearest_schools()`, which builds the
`school_nearest_neighbours` 'general' pool that every Teacher view Rankings set is drawn
from (Nearest 10, same sector, local rivals, similar-sized). Its `is_special` is:
- the whole `establishment_type_group = 'Special schools'`, which GIAS uses for
  "Other independent special school" (952 open) and "Non-maintained special school" as
  well as the state community/foundation specials;
- plus the special academy and free-school types.

A mainstream target never receives any of them as a neighbour. So independent special
schools are excluded from appearing and from counting as neighbours, exactly as state
ones are, by the same single filter. The round-5 age-range rule only operates on what
that pool already contains.

**Verified on live data, Acland Burghley (URN 100053):**
- Its 100-school pool reaches 3.1 km.
- Kestrel House School (URN 135683, "Other independent special school", ages 5–16) is
  2.5 km away and is not in it.
- Neither are the nearby state specials: Harmood School (Community special), The Bridge
  School (Academy special converter), The Bridge Keystone (Free schools special) and
  Royal Free Hospital Children's School.
- Collège Français Bilingue, Channing and Highgate, all ordinary independents, are in
  the pool and in its Rankings sets.

**No code change shipped.** A filter restricting the age-range route to the
"Independent schools" group was drafted and reverted. For mainstream schools it changes
nothing. Its only effect would be on special schools' OWN dashboards (see below), which
this decision did not cover.

**Resolved, 2026-09-21 (Guy: "stay"):** special schools' own Rankings compare against
nearby special schools of both sectors. The paragraph below is kept as the record of why.

**Was open, product call:** `nearest_schools()` is symmetric, so a special school's own pool
is made up entirely of other special schools, of both sectors. Before round 5 Teacher
view's phase filter dropped all of them, so a special school's Rankings card was always
empty. Since round 5 the age-range rule admits them, so a special school with GCSE data
is now ranked against nearby special schools. That is probably the right comparison,
but it is a change nobody decided on.

**Tiny independents:** Unique Children's School (URN 145295) is an "Other independent
school" with 2 pupils, ages 11–18, so it stays in pools as an ordinary independent. Most
such schools have no published results and show "no figure", unranked. Excluding very
small schools would be a new size rule, not this filter.

---

## 2026-09-21 — Teacher view card content rebuild: judgment calls and data limits

Built against the mockup boards themselves (`GCSE/Post16-Dashboard-Desktop.dc.html`,
read from the Design artifact) as well as the design reference. Where the two differed,
or the data could not support the literal mockup, this is what was done:

**England average at GCSE is the family average, not the qualification average.** The
Results anchor used to be the school's own average across its subjects. It is now England,
from `academic_geography_aggregate`'s national rows. At Post-16 that matches the mockup
exactly: `bucket:<bucket>::aps_per_entry` is per qualification bucket, on the same scale
as the subject's own score (Acland Burghley A-level Geography 35.45 vs England A-level
33.56). At GCSE no national figure exists per subject or per qualification. None is
ingested (checked `academic_geography_aggregate` and the raw KS4 subject facts). The
finest national points figure is per subject family. Only "GCSE (9-1) Full Course"
carries points at KS4, so that is an England GCSE average for the family. The GCSE caption
says "vs. the England GCSE average for that subject's family" rather than the mockup's
"same qualification", which would be untrue. **Needs:** a national per-subject GCSE
points figure in the ingest, if the literal comparison is wanted.

**Real bug fixed on the way:** at GCSE, headline points are keyed by subject alone, so a
vocational row (e.g. Sports Studies as an OCR Cambridge National) showed that subject's
GCSE score as its own. Only the points-bearing qualification now shows a score
(`POINTS_BEARING_QUALIFICATION`, reused from the Data View); other rows say "no score".
The Results "this moved" line (`movedResults`) still averages across qualifications at
KS4. Pre-existing, not touched.

**Where the mockup and the briefs differed:**
- The mockups put the 3px accent bar on the outer column card, not on each inner box (the
  rebuild brief said CardBox). Built as the mockup draws it.
- The mockups colour a positive delta grey (`--muted2`); the design reference and rebuild
  brief both say green. Followed the briefs: green above, red below.
- Chip colours follow the qualification group, not each subject: in the mockups both GCSE
  subjects are green and the BTEC one blue, and Post-16 uses pink then teal. The same
  grouping drives the Candidates bars, the Results scores and the pie slices.

**Small calls of mine:**
- KS4 vocational names shortened to "Cambridge National" and "BTEC" on chips and rows; the
  DfE names crowd out the subject name.
- The Candidates caption uses the Post-16 mockup's general line ("by qualification type —
  never blended into one number") for both phases. The GCSE mockup's caption is specific
  to its made-up example data.
- The Context caption keeps the existing sentence, as the rebuild brief asks, with the
  mockup's "share of every entry" phrase appended.
- "±" scrolls to the subject picker at the foot of the dashboard, the real place subjects
  are changed. There is no separate quick-edit screen.

**Not built, and why:**
- The Rankings card's subject-filter chips. The Rankings sets rank on each school's
  whole-school headline (Attainment 8 / A-level APS), not per subject, so a per-subject
  chip would switch nothing. It would need per-subject comparator data, which is new
  comparator logic.
- Layout: the real dashboard is a 2×2 grid, not the laptop board's four columns in a row.
  None of the five listed items covers layout.
- The icon-only theme button: explicitly deferred by the brief.

**Verification so far:** the real components were screenshotted locally with Acland
Burghley's figures, GCSE and Post-16, light and dark, in a temporary harness (not
committed), via headless Chrome; the browser extension could not take screenshots this
session. The live-site check against a signed-in dashboard is still to do.

---

## 2026-09-27 — Teacher view comparator chooser (v29 wireframe): decisions logged, build carried on

Build prompt: `docs/vicdata_phase3_teacher_view_comparator_chooser_build_claude_code_prompt_v1.md`. Everything below was decided without Guy there, per the prompt's "log it and carry on" rule. Full account in `docs/vicdata_phase3_teacher_view_comparator_chooser_build_report_v1.md`.

**Victoria Consultancy Sets: how they're stored, and who can switch them on (§2).** Three new tables in `20261102100000_victoria_consultancy_sets.sql`: `vc_comparator_sets` (a platform-level set, not tied to any school), `vc_comparator_set_members`, and `vc_set_school_visibility` (a row = "switched on for this school").
- *Not* a flag on `saved_sets`: a `saved_sets` row belongs to one school account, and its RLS lets that school's admins edit and delete its shared rows. A VC set must be neither. Changing `saved_sets`' RLS to carve VC rows out would touch who can edit today's sets, which the prompt says to stop for. The new tables touch nothing in `saved_sets`.
- **Who can write:** nobody through the API. The three tables have SELECT policies only, so only the service role can write. The platform has no operator role (all three RLS helpers are school-scoped), and the `vicdata` admin app authenticates against a *different* Supabase project. So v1 follows this repo's own precedent for operator writes (service-role scripts, as `scripts/sync-*.ts` do): **`scripts/vc-sets.ts`**, with `list` / `create` / `rename` / `set-members` / `delete` / `show <school-urn> <set-id>` / `hide`.
- **Who can read:** members of a school see exactly the VC sets switched on for it. This was proven live in a rolled-back transaction, impersonating real members:
  - a member of the switched-on school saw 1 set / 2 members; their insert was refused (42501), and their update and switch-off each touched 0 rows;
  - a member of another school, and an anonymous caller, saw nothing.
- **Open for Guy:** whether this should become an in-app operator screen, and whether a VC set should ever be per-school rather than shared across schools.

**Two different "Independent" colours on one dashboard (§3).** The chooser's Sector chips and school circles use the four-way brand palette (`TAG_COLOURS`: Independent `#F37521`, State `#15803d`, FE `#86198f`, Special `#b91c1c`), per the wireframe. The Comparisons ranking table still uses `school-sector.ts`'s binary `SECTOR` palette (Independent pink `#c2478b`, state blue `#4b7bd6`), which has no FE or Special. **Follow-up call for Guy:** move the ranking table to the four-way palette too?

**Qualification filter: wired, but the count isn't real yet.** A school's KS5 qualification mix is a per-school, per-subject fact today, with no population-scale path. The Qualification chips set state and are saved with a ranking and shown in its description. When one is active, the filter box says "Saved with the ranking, but the count doesn't narrow by qualification yet". `matchesRanking` deliberately doesn't apply it. Real counting needs a population-level qualification flag per school: `academic_ks5_qualification_flags_lookup` covers IB/Pre-U only, so a new field would be needed.

**Saved rankings are their own table, not `saved_sets` rows** (`20261102090000_saved_rankings.sql`).
- **Why:** a ranking has no members. As a `saved_sets` comparator row it would show up *empty* in every existing comparator-set consumer (the Data View's sets controls, `/sets`, `/api/comparator-set-peers`, Teacher view's saved-sets route). Resolved into members instead, it would make that route fetch thousands of academic profiles on every dashboard load.
- **Access:** ownership and the four RLS policies mirror `saved_sets` verbatim, with the same personal cap of 8, counted separately from comparator sets.
- **Quirk mirrored, not fixed:** `saved_sets`' personal-insert policy doesn't check that the membership belongs to the same school account, and the mirror inherits that. Worth tightening in both tables together.

**Boarding filter: the wireframe's literal % bands, not quintiles.** The prompt's prose asked for the Boarding box to "read against the real quintile mechanism", but the wireframe (which wins where they disagree) specifies literal bands: Any / 100% Day / 1–19 / 20–49 / 50–79 / 80%+. Each school's share is the census boarders ÷ total via `boardingRatio()`, rounded before banding.
- **The quintile mechanism still governs "10 nearest":** `resolveNearestOption`, now shared from `src/lib/nearest-option.ts`, picks list1 or the boarding-quintile recipe exactly as the Data View does.
- **Colours:** the three middle-band colours are the wireframe's provisional ramp; their dark-mode pairs are mine, not yet in `tag-colours.ts`.

**What a ranking's population is.** Built from `region_nation_set` (England, or one region), with the school itself counted.
- **"Same phase":** at Post-16, a school with pupils aged 16–18 in its census counts, or an FE college. At GCSE, `phaseTags()` includes Senior.
- **Special schools are included,** as the wireframe's default "State, Independent, FE & Special" says.
- **Real counts:** England Post-16 4,857 (the wireframe's 3,842 was mock); West Midlands 552.

**How the dashboard uses a ranking.** Ranked by the dashboard's headline measure (`HEADLINE_MEASURE`). The Comparisons column gets the top 15 plus the 5 either side of this school, with a note ("The Chase ranks 843rd of 2,545 with a published figure (4,857 in this ranking)…"). Schools without a published figure aren't ranked. A population of thousands can't be drawn school by school.
- **Performance:** the first national load is about 5 seconds (the RPC) plus the headline lookup, then cached for 6 hours per scope.
- **A school outside its own ranking:** if a ranking excludes the school (a state school looking at independent girls' boarding schools), the note says so and places it against them anyway.

**Size bands: a latent bug worked around, not fixed.** `lookupAgeBandDistributions(null, …)` returns nothing (it filters `scope_key in ("")`). Its only other caller always passes a real LA, so the chooser does the same. Separately, the GCSE ("secondary") national quintiles have p20 = 1, so at GCSE the XS band is almost empty. That's a real data property, not a chooser bug.

**Smaller UI calls where the wireframe is silent or would mislead:**
- **Dark mode:** the wireframe is light-only. Its hexes are the light values verbatim; in dark mode each maps to the dashboard's own tokens.
- **Delete on an unsaved fork (2c):** hidden. The wireframe shows it, but nothing is saved yet (Back discards), and the rule is "Delete only where editable".
- **Delete in the ⋯ menus:** a two-step "Tap again to delete".
- **Remove (×):** on rows of a custom set, so an edited saved set can lose a school. The wireframe has no remove affordance.
- **Admins and shared sets:** admins see ⋯ (Edit/Delete) on the school's shared sets, although the row's copy says "can't be edited"; that copy is true for everyone else.
- **"{School} sets" row:** hidden when the school has none.
- **Scope "More":** a dropdown of the other English regions.
- **KS4:** no Qualification box, and the Size box reads "Secondary (Years 7–11)".
- **KS2:** no rankings row (no exam population).
- **The admin "Just me / Whole school" choice:** rendered from the wireframe's otherwise-unused `.segmented` style.

**Two "nearest" lists in the "Compared against" pill.** The chooser's "10 nearest schools" is `default-comparator-lists`' list1, as the prompt requires. The pill's existing "Nearest 10 schools" preset is the dashboard route's own `teacher-view-rankings` algorithm, a different selection with a near-identical name. **Call for Guy:** retire the old preset now that the chooser exists, or rename one of them.

**The LA list says "mainstream" but isn't.** `list2` for The Chase ("In Worcestershire (all sectors)", upstream) includes special schools and alternative provision, while the wireframe's copy says "mainstream sectors". The copy is kept as designed. `local16Plus` stays additive: its 36 schools beyond list2 are their own group on screen 2b, under its real label ("Schools and FE colleges, 16+, in Worcestershire").

**Migration history.** Both new migrations were applied surgically (`supabase db query --linked -f`) and recorded individually (`supabase migration repair --status applied <version>`). A plain `supabase db push` would have replayed three older local migrations that the remote history shows as unapplied, including `teacher_view_persistence`, which the live site already relies on (so it was presumably applied by other means). Those three are untouched and still need their own reconciliation.

---

## 2026-10-03 — VicData 0.6 night 1 (S0–S3): judgement calls logged, build carried on

Night 1 prompt: `docs/v0.6/vicdata_0_6_night1_claude_code_prompt_v1.md`. Audit: `docs/v0.6/audit_v1.md`. Build report: `docs/v0.6/night1_build_report_v1.md`. All recommended defaults in the design docs were treated as decided; the calls below are the ones the docs didn't settle, or where the code contradicted them.

### For Guy first

1. **Pre-existing security hole, not fixed (a stop condition).** `school_memberships_insert_own` checks only `profile_id = auth.uid()`, so any signed-in user can insert an `approved`, `is_admin = true` membership in any school straight through PostgREST. `school_accounts_insert_authenticated` likewise lets anyone create accounts with holder fields set. The fix is written in `docs/v0.6/proposed_sql/membership_insert_hardening.sql`. It removes no legitimate path: joins go through `join_school`, and the testing routes use the service role. It is an RLS change on memberships, so it waits for you. S1 already closes the role half: a trigger forces `roles = {teacher}` on any non-service insert.
2. **The S2 migration is written but NOT applied.** S1's migration was applied live and recorded. After that, the session's permission classifier blocked further live-database actions, even a read-only check. `20261103100000_v06_s2_dashboards.sql` is tested on local Postgres (PGlite) instead: 39 RLS, cap, immutability and publish checks, plus the seed run twice. The apply and seed commands are in the migration's header. Until it's applied, the flagged renderer uses the configs seeded in code (the same JSON).
3. **Three live behaviours break rules the catalogue states, and were kept as they are**, because fixing any of them changes a figure on a live dashboard:
   - Post-16 Context blends a subject's A level, BTEC and IB points into one figure, and "All subjects" has no qualification-family filter (R-POINTS-SAME-QUAL; test case Croydon College 130432, Computer Science 7.0).
   - "% change" is offered on points and rates (catalogue §3 says Change in points / Change in pp).
   - An AS-only focused subject is left out of its own Context group.

   Each is moved verbatim into the lib, with an `openIssue` on its rule card.
4. **R-IB-NONSUBJECT fails its real-data test.** Sevenoaks (118952) raw facts for 2024/25 list "Baccalaureate", "Learning Skills" and "Study Skills" (IB Core) at 244 entries each, and 225 each in 2023/24. The rollups exclude them, but the Teacher subject list is built from raw facts. Not checked: whether the subject picker shows them. Filtering would change a live list, so it is left for you.
5. **The panel unit is 351 × 384, not 385 × 256.** The column track is 385, inside the 1280 cap. Panels are 12px apart, and columns 18 + 2 + 18px. The accordion round raised the height to 384. So a 3 × 2 meeting slide is 1231 × 780 and **doesn't fit 1280 × 720**. That's a night-2 decision: scale slides down, or a meeting-specific unit. The renderer's `PANEL_UNIT` uses the real numbers, and a test pins it to `PANEL_HEIGHT`.

### S0 (audit)

- **Notes and preferences:** a key-mapping layer, not a `chart_key` migration. Each seeded panel carries its legacy keys (`{phase}:{column}:{panel}`), and a unit test pins that shape to the page's own `panelNoteKey`. The 3 live notes are on pre-merge keys and already show nowhere. They are left alone, and the old `change` key is listed on each Trends panel for a later notes hub.
- **R-TREND-3YR is superseded by R-TREND-LINE-4YR** (the live code's 4-year threshold). The 3-year constant survives only on the meetings page.
- **Pre-existing bug, logged not fixed:** `/teacher` and `/teacher/meetings` load the membership without filtering to the signed-in user. RLS returns every colleague's approved row, so `.maybeSingle()` fails at a school with 2+ approved members. `/teacher/[phase]` has the same query. The S1 screens filter to the user.
- **The join page was broken before 0.6:** it offered old role values that fail the live CHECK, and no Teacher option. It now offers Teacher only.

### S1 (roles)

- **School-Admin stays `is_admin` plus the account holder**, not a member of `roles[]`. That keeps every existing RLS helper exactly equivalent. The School-Admin chip can only be switched by the account holder, which is the existing trigger, and the holder is locked on.
- **Roles are `text[]` with a CHECK constraint**, like every other "enum" in this schema. `role` is kept, synced to the most senior role, because `/account` and scripts still read it.
- **Guy is seeded as the platform admin by profile id** (the mac.com profile, not the preview user). Nothing matches on email.
- **The VC Sets switch turns all VC sets on or off for one school**, keeping the per-set visibility model. It is disabled with "No VC sets yet" while there are none (live has 0). `scripts/vc-sets.ts` still works.
- **Platform's "Last active" comes from `sign_in_events`.** The board shows it, and the screen is platform-only. G13's "no screen" is about School-Admins, who still have no read path at all (the table has no SELECT policy).
- **Look at it as… is read-only and logged.**
  - The Teacher data routes (dashboard, chooser-set, phases, comparator-grades, ranking-population, subject-geography, subject-grade-geography) now also admit a platform admin, after the member check.
  - Those routes serve school-level public data only. Saved sets, notes and preferences are not opened.
  - So a look-as view doesn't show the school's shared saved sets (that would need an RLS grant on saved sets: a stop).
  - Your own preferences and onboarding for that school are used and written. They are your rows.
  - The role is shown in the banner but changes nothing yet: nothing gates on role until the role homes (night 2).
- **The old testing school switcher is now platform-admin only** (403 otherwise), and its UI on `/account` is hidden for everyone else. It is still the destructive path (it deletes the caller's memberships and personal saved sets). Suggest retiring it now that look-as exists.
- **Invite copies the school's join link** (`/join/{urn}`). There is no invite-email system.
- **The S1 screens' own calls** (from the build, all visual or copy):
  - **Light-theme text:** role and amber text mixes the accent towards `--fg`. Raw accent hex is too faint on white.
  - **New tokens:** `ROLE_ACCENT`; `ATTENTION_ACCENT` for "needs attention" amber, separate from School-Admin; and the derived variables `--chip-fg` and `--edge-strong` for the board's #c9c9ce and #3a3a40. Teacher and SMT share hexes with the KS4 and KS5 phase accents, as the board draws them.
  - **Font:** the app's Arial, not the board's system font.
  - **Platform sizes:** the side panel is 374 and search 282, the board's rendered sizes.
  - **People:**
    - the Waiting chip is hidden at 0 and covers both pending statuses;
    - approving sets roles to Teacher only;
    - "school email matched" uses `join_school`'s own domain check;
    - a person's last role can't be switched off unless they're School-Admin;
    - job title saves on Enter or blur, and the card shows the email when there's none.
  - **Teams:**
    - "+ New team" creates "New team" (numbered if taken) and selects the name;
    - automatic teams add a people count;
    - collapsed teams show up to 6 avatars, then +n;
    - the "+ Add people" picker is a tick list.
  - **Site nav:** `/platform` keeps the site NavBar, and People/Teams hide it.

### S2 (engine)

- **Rule lift:** 21 must-lift rules moved verbatim into `src/lib` (new `teacher-view-measures`, `teacher-view-populations` and `teacher-view-comparisons`, plus existing libs). 30,888 scenarios are deep-equal before and after (harness in `docs/v0.6/audit_scripts/lift_equality`). R-SINGLE-BUCKET-100 is Data View only, so it is tagged, not lifted. Every Teacher-view rule ID is tagged at its enforcement points, and `docs/catalogue/rules.md` lists them from a grep, so they can't go stale.
- **The matching rule's compare subset:** I read it strictly. A column that compares offers only views that compare, with every kind among those chosen. A non-comparing view is not offered in a comparing column. The doc's "all among those chosen" could also be read as allowing them.
- **The renderer composes through the existing column hosts** (CandidatesPanels, SubjectPanels/GradeCountsPanels, ComparisonsPanels).
  - The config decides columns, rows (order, names, time), accordion behaviour, error boundaries, placeholders and phone tabs.
  - The hosts keep their data and view state, and CardBox still attaches title, source, note, export and fullscreen.
  - Not yet: showing a *subset* or *reorder* of a panel's rail, cells spanning columns, and moving one view to another panel. Each needs a small `views` prop on the hosts, and lands with the editor (night 2).
- **Override badges are not shown** to users: out of edit mode the dashboard looks as it does today. They are in the config (`data-override` on the panel) and on the Catalogue page, and the editor shows them (night 2).
- **One batched fetch per dashboard: partly.** The dashboard route already returns the core payload in one call, and closed panels render nothing until opened. The client de-duplication layer for per-panel geography and grade fetches was **not built**: reading those fetchers was blocked mid-session. The audit's duplication list (B §2–4) is the to-do.
- **Per-user state:** a sibling table, `dashboard_user_state`, keyed by dashboard, school and stable panel/view ids. It is not an extension of `teacher_view_preferences`, which the hand-coded path keeps using untouched. The four Teacher dashboards write through their legacy keys.
- **Versions:** immutable by trigger. Personal dashboards keep their last 30 through `publish_dashboard` (a transaction-local flag lets that one prune through).
- **No "alignment spacer" exists** in today's code. The column alignment comes from the pills' placement plus the fixed panel height. The config carries `features.alignmentSpacer` as a marker only.

### S3 (Teacher dashboards as config)

- **Marked overrides where the hand-built placement doesn't match its column:**
  - Column 1 Trends against LA, region and England (F2);
  - Results Trends also carries the comparator map and Grade counts' two railless views;
  - Comparisons Current's headline Number tiles (whole-school focus).

  Column 1 Results declares `subjects + averages (England)` as its compare, because it really shows England markers. The unit tests fail on any unmarked mismatch.
- **The group switcher reads and writes the same Candidates/Results setting as today's toggle.** Flipping the flag loses no one's choice. The phone nav's toggle is unchanged.
- **Catalogue page:** a parity check of each view in isolation isn't possible yet, because views render through their hosts. So the page shows the two whole dashboards side by side (hand-coded vs `?renderer=config`) through look-as, plus every card. The isolated live preview arrives with the chooser.

## 2026-10-03 — Guy's decisions after night 1 (read before night 2; these win over the design docs)

Guy reviewed `docs/v0.6/night1_build_report_v1.md` and the night-1 entries above. **All the fixes below fold into night 2**, as a new first stage, **S3b — Fixes**, before S4. Each fix is its own commit. Where a fix deliberately changes a live figure, the commit message and the night-2 report carry a before/after table for named real schools. These fixes live in the shared lib, so the hand-coded and config renderers change together, and flag-off vs flag-on parity must still hold afterwards.

### Before night 2 starts (Guy, by hand)
- Guy applies the S2 migration and seed with the three commands in the night-1 report.

### S3b — Fixes (do first)
1. **Membership insert hardening.** Approved, as written in `docs/v0.6/proposed_sql/membership_insert_hardening.sql`. Not urgent (Guy is the only user), but in scope. Turn it into a proper migration file, test it locally (PGlite) with join_school and a direct-PostgREST insert attempt, and **leave it for Guy to apply**, as with S2. Don't apply it live.
2. **The `.maybeSingle()` membership bug** on `/teacher`, `/teacher/meetings` and `/teacher/[phase]`: filter to the signed-in user, as the S1 screens do. Test at a school with 2+ approved members.
3. **Rule conformance: three deliberate figure changes.**
   - **R-POINTS-SAME-QUAL:** Post-16 Context must not blend A level, BTEC and IB points into one figure. Points are shown per qualification family, and "All subjects" gets the same family filter. Where a blended figure is all there is, it's suppressed with the usual wording, never fabricated. Test case: Croydon College 130432, Computer Science.
   - **Honest number types:** wherever "% change" is offered on **points**, it becomes **Change in points**. On **rates** it becomes **Change in percentage points**. Labels, values and titles all change. Counts keep % change.
   - **R-FOCUS-NEVER-FILTERED:** an AS-only focused subject counts itself into its own Context group (Part D decision 1).
4. **R-IB-NONSUBJECT:** filter "Baccalaureate" and the IB Core rows ("Learning Skills", "Study Skills", "Self Development") out of the Teacher subject list. Use the existing qualification-keyed exclusion list the rollups use. Don't create a second list. Check first whether the subject picker showed them at Sevenoaks 118952, and report it. The rule test must then pass.
5. **Retire the old testing school switcher**: remove the route and its `/account` UI. "Look at it as…" replaces it.
6. **The light-theme dark band** below short content on `#teacher-root`: fix it before the flag ever flips.

### Decisions for the rest of night 2
7. **Meeting slides scale as a whole.**
   - Lay a slide out at the real panel unit (351 × 384, 12 px gaps).
   - A logical 16:9 slide canvas is sized to hold a title plus 3 × 2 units (about 1530 × 860; take exact numbers from `PANEL_UNIT`).
   - Scale the whole slide uniformly to fit the screen, in the editor, Present, Grid and PDF.
   - **No separate meeting panel size.** Panels stay identical to the dashboard's.
   - MeetingPlay's 289 × 192 cells were drawn at 0.75 of the old assumed unit. Follow its *behaviour*, and use the real unit for sizes.
8. **The compare-subset rule stays strict.** A comparing column only offers comparing views. "Browse VicData dashboards" is the deliberate way to mix.
9. **Trend threshold:** the code's 4 years (R-TREND-LINE-4YR) wins over the docs' 3, everywhere, including the meetings page constant.
10. **Fetch de-duplication** (audit B §2–4): build it after S7 if time allows. Otherwise log it as the first post-0.6 item.
11. **Database:** expect the same live-database block. Write each night-2 migration (including any for meetings), test it locally, and list the apply commands in the report for Guy. Don't stop over it.

## 2026-10-03 — VicData 0.6 night 2, S6 (library, role homes, icons, Copy this view): judgement calls

Boards: Main, HomeSMT, Icon, CopyTo, CopyToMeeting. Each was screenshotted at 390 wide in both themes beside its board (headless harness, scratchpad `s6/cmp-*.png`).

- **Flag.** The role-home additions on `/teacher` (Dashboards tile, role switch, SMT/Admissions homes, "Next: …" on Meetings) show only with the 0.6 flag on (`configRendererRequested`: `?renderer=config` or the env flag). Flag off, `/teacher` is pixel-identical to before (diffed, both themes), and its membership query is unchanged. `/dashboards` is a new route, linked only from the flagged home.
- **Single-role Teacher, flag on: two visible changes.** The additive Dashboards tile (between Post-16 and Recruitment) and the Meetings line reading "Next: {meeting}, {date}" when one is coming up. Both are what the spec asks for.
- **A single-role SMT or Admissions user, flag on, no longer sees the GCSE/Post-16 tiles.** Their home shows the empty key-dashboards tile, as §4.10 says ("can't reach other roles' homes"). Today they get the Teacher home. Worth a look before the flag flips.
- **Default lens** for a multi-role person: the last one they picked (localStorage), else the most senior (SMT, then Teacher, then Admissions). HomeSMT draws SMT on. Look-as: the previewed role is the only lens, and School-Admin previews the Teacher home.
- **Board copy treated as annotation, not UI:** HomeSMT's footnote ("Teacher home: GCSE and Post-16. SMT reaches…") is left out. The role switch's hint is shortened to "Shown because a School-Admin gave you more than one role. Each has its own home." Main's footnote ("GCSE and Post-16 also stay on Home…") is kept, because it tells a user something. Admissions' empty tile reads "Coming after 0.6: rolls, births and how you compare with nearby schools" (no board).
- **New token: `LIBRARY_ACCENT` (#22d3ee)** for the Dashboards tile. No token meant "the library" before. The board's cyan is the same hex as Rolls and the Admissions role.
- **"+ New dashboard" shows to super-admin only**, because the editor is super-admin's in 0.6 (§8). The Main board draws it for an ordinary user.
- **The library for super-admin** lists VicData's dashboards, their own school's and their own. RLS would return every school's and every person's.
- **Icons.** "From a view" draws the view's standard rail glyph (PanelIcons), not the board's bespoke bars, line and donut. The icon set is the phase glyphs, the column icons, the school mark, recruitment, meetings and the library glyph: one per meaning. The six swatches are real tokens (PHASE_ACCENT ×2, the chooser's Rolls and Social hues, FEATURE_ACCENT ×2), stored as `colour.override` keys. A dashboard without an icon uses its first column's icon, which matches the Main board's cards.
- **Uploads** go to a public `dashboard-icons` bucket: PNG and SVG only, 512 KB, writes by super-admin only. Migration `20261104130000_v06_s6_dashboard_icons.sql` is written and PGlite-tested (with a storage stub), **not applied**. SVGs are only ever drawn through `<img>`.
- **Copy this view: the slot map's slots are the board's 44px**, not the panel unit's aspect. A unit-shaped 2-column map is ~400px tall at 390 wide and pushes the fit check below the fold. One constant switches it (`COPY_UI.slotShape = "unit"`). The meeting slide thumbnails *do* use the real unit arrangement (`thumbRects`).
- **Fit check on an existing panel's rail.** A panel is one context, so a view that doesn't fit the panel's column can't join its rail. The dialog says so, and offers an empty slot or a new row, where the new panel carries the PanelOverride ("overridden: …"). A new row goes in column 1, and its Time comes from the view.
- **Where copies go.** Into a personal dashboard, the copy is published straight away (there's no audience to protect). Into a school or VicData dashboard, it goes to the draft only, and the dialog says "Publish from the editor". A new dashboard from a view is personal ("Mine"), named after the focused subject (numbered if taken), with its icon set from the view.
- **To a meeting:** the slides are listed latest first, as the board draws them. The pre-picked slide is the last one with room. A new meeting asks for a name and date inline; the view goes on its first slide.
- **Entry point.** "Copy this view…" replaces the two disabled Export options only under a dashboard plan or on `/dashboards/*`, and only when the host provides `CopyViewSourceContext`. Everywhere else the two disabled options stay exactly as they were. The dialog is lazy-loaded, so hand-coded pages don't carry it.
- **Not built here:** the linked-dashboard switcher in the top bar (the renderer's, /dashboards/[id]).

## 2026-10-03 — VicData 0.6 night 2, S5 (Dashboard editor): judgement calls logged, build carried on

Routes: `/dashboards/new` (New 1-4) and `/dashboards/[id]/edit` (super-admin only via `is_platform_admin`, plain 404 otherwise). Ops: `src/lib/editor-ops.ts` (tests: `npx -y tsx --test src/lib/editor-ops.test.ts`). No new migration: S2 + S4's tables cover everything.

### Board vs code convention (board's layout/copy followed, real token/shell used)
- **Panel size:** the boards draw 230 / 190 / 150px-tall panels in 24px-gap grids; the editor uses the real panel unit (351 × 384, whole-unit tracks 385 + 38 apart), so three columns are 1231px and the Editor board's two rows no longer fit in 1120px.
- **Colours:** edit amber = `ATTENTION_ACCENT`; "inherits" blue = the chooser's `--cc-blue`; ready green / danger red = `DELTA_POSITIVE` / `DELTA_NEGATIVE`; planned gold = `--cc-gold` light hex. New 1's colour swatches are the real tokens per meaning (phase accents, the chooser's Rolls/Social data-family hues, the home page's Rose/Amber feature accents, grey).
- **Menus:** the panel ··· menu is `PanelMenu` + `MenuRow` (13px, not the board's 12px), widened 236 → 264 so "Change data / compared to…" isn't truncated. The + Add row structure picker is its own popover (PanelMenu caps width at 320px; the board's is 400).
- **Dialogs:** RowSettings, ColumnChange, SpanAsk, Assign and the rest are `TeacherModal` "chooser" size with the comparator chooser's Panel / Body / Footer / buttons (backdrop 0.45, not SpanAsk's 0.35).
- **Column icons:** a column's icon is one of the four `COLUMN_ICON_PATHS` (config type), so New 3/4 show the people / pie / rosette icons, not the board's building / pin glyphs for Rolls and Births.
- **New dashboard frame:** the onboarding tour's frame lives inline in `src/app/teacher/[phase]/page.tsx` (not S5's to edit), so `TourFrame` in `NewDashboard.tsx` is a class-for-class copy. Suggest extracting both to one component.

### Calls the boards didn't settle
- **"Save" is labelled "Publish"** (the prompt) in the edit bar; the History board's "Publish as version 13" is the Publish dialog's title. A label is optional at publish.
- **Undo** is in the edit bar (History board); redo is ⇧⌘Z (no room for a second button on the Editor board's bar). **Export planned views** appears in the bar only when the dashboard has placeholders (Skeleton board).
- **Save state** folds into the status line (red "Saving needs the database update" while S2 isn't applied; "saving…" while writing) rather than a separate chip.
- **Empty panels** are allowed in a draft; **Publish is held** until each is filled or deleted, so a published config always passes the catalogue's `validateConfig`.
- **Panel menu adds "Remove this view"** (not on the board; removing a view had no home). Rail views reorder by drag; spans drag on the panel's right edge (or ←/→ when the handle has focus), snapping to whole columns, and ask F3's question when the spanned columns differ.
- **Row structures** offer that dashboard's own compositions (3 columns: one wide, 2+1, 1+2, three). The boards' "2 equal" and "4" on a 3-column dashboard can't snap to whole columns.
- **RowSettings copy:** "needs 4+ years for a trend line" (decision 9), not the board's 3+.
- **Empty panel copy:** "Opens Add a view", not "Opens the 6-step chooser" (the chooser now opens on Pick).
- **F5 "Keep as override" belongs to the panel** (an override is per panel): keeping one view keeps its panel's other misfits too; the dialog links them. Panels with their own overrides are skipped (C17). "Swap" is disabled when no live view of the same date mode fits.
- **Adding an overridden view** (from Browse or a loosening) to a panel that already has views overrides the whole panel; the badge says so.
- **Placeholders** now store `context` (catalogue terms) and `shape: null` = "Not sure" (`types.ts`, additive). Ready to swap in matches `draft` views against that context.
- **Export planned views** lists ALL open/planned `view_requests` (they're the backlog), each with where it was asked from; placeholders only while the table is absent.
- **Linked groups** are stored in the config (`config.group`); `dashboards.group_id` isn't written (no store call for `dashboard_groups` yet).
- **Assign:** VicData → roles + live/copy + Key toggle (`is_key` on each role row); school → that school's teams, always live; personal → "your dashboards only". The board's dashed "School-Admin sees this instead" note is a wireframe annotation, not built.
- **New dashboard:** any signed-in user can open it; a super-admin also picks "Save to: VicData / My dashboards" (not on the board). Non-admins land on the live view, admins in the editor. Academic main data starts Teacher's pattern (column 1 vs category, 2 vs the Context pill, 3 vs 10 nearest), because a no-comparison academic column has no views. While S2 isn't applied, Done opens the editor in memory.
- **History preview** is at full opacity (the board's 0.55 is kept for the draft behind an open History panel) and scaled with CSS `zoom` to fit beside the panel.
- **UpdatedNotice** records a first-ever visit silently (no "Updated" line for newcomers); `upgradeUserState` (`src/lib/editor-upgrade.ts`) applies carryUserState to the viewer's own state row on their visit (RLS: nobody can rewrite other people's state at publish).
- **No school in the editor:** titles resolve with neutral words ("This subject"), and "Choose other schools…" stays off in Steps 1-2 (relative "10 nearest", G5).

## 2026-10-03 — VicData 0.6 night 2, integration pass: judgement calls

The stages' contracts wired together (commits "Integrate: …"). Flag off, every Teacher page renders as before (harness: 32/32 identical vs 2c84a1a; flag on vs off at 1280, non-admin, 16/16).

- **Copy this view from a live panel copies the rail's active view**, else the panel's default view, in the panel's context resolved with the page's real labels. Context's pill-following column copies the group it is on *now* ("All subjects" pins `against: whole`). The pin's years are the page's real ones (first/latest period in the payload), not the measure card's.
- **One resolver for pins** (`src/lib/pin-context.ts`): a view compares one way, so a pin carries the first of the view's own compare kinds the context has. "10 nearest" is always pinned as "10 nearest schools" (the name the embed reads as the default set).
- **Super-admin sees "Edit" on the flagged Teacher page** (control bar, beside Export) and on `/dashboards/[id]`. That is the one visible flag-on difference for super-admin; non-admins see none.
- **A meeting's Add a view starts at GCSE Candidates, one subject, against its category**, not "no comparison": every registered view compares something (the strict compare rule), so "no comparison" opened on an empty Pick. Step 2 changes it. In this columnless mode Step 1 is "Choose data" (no "From this column"), the context box "Your choices", the button "Add to slide". Step 2 still offers "Follow the subject chips" (meaningless on a slide; pinning resolves it to the chosen subject or none) — worth a look.
- **Pinned for a meeting:** the latest year pinned unless the view was customised with roll-forward on (a ready-made view has no roll-forward, so it is pinned; Keep live stays a per-slot toggle in the meeting).
- **Live previews in Pick draw every card live** (one embed per card, sharing the cached dashboard route). Fine at 13 cards in the harness; if it feels slow on a real school, limit live to the selected card.
- **The editor's live preview is the whole panel card scaled** (E's LiveViewPreview), so it shows the panel's own header inside the editor panel's frame. A figure-only frame would look cleaner; left as E built it.
- **The editor's school:** look-as school (`?lookAs=…&as=…`, confirmed platform admin), else the super-admin's membership school; no school → the data-free previews and S5's copy-within stub. The flagged Teacher page's Edit link carries look-as along.
- **Linked-dashboard switcher on `/dashboards/[id]`:** seeded VicData groups from the catalogue; a stored group is read from the person's listing by `config.group.id` (S5 doesn't write `dashboards.group_id`).
- **Icon in the editor's Settings:** an Icon row opens S6's Icon dialog; the icon and its colour apply with Settings' Done.
- **Not done here:** "Choose other schools…" in a meeting's or the editor's chooser stays off (it needs the saved-sets payload in those screens); the CopyViewDialog has no dimming backdrop in the harness shots (S6's dialog, unchanged).

---

## 2026-10-04 — VicData 0.6 night 2: S3b, S4, S7, the renderer (E), titles — judgement calls logged, build carried on

S5, S6 and the integration pass have their own entries above. Everything here was decided without Guy and can be changed. Report: `docs/v0.6/night2_build_report_v1.md`.

### S3b fixes

- **Fix 2 went wider than the three pages named.** The same unfiltered `.maybeSingle()` sat in every membership-gated API route (31: Teacher view and Data View), on `/teacher/recruitment` and in the Data View shell. At a school with two approved members, each route would have answered 502.
  - Routes take `.limit(1)`. Any approved row visible at the school proves membership, because RLS shows colleagues only to members.
  - Pages filter to the signed-in person.
  - PGlite proves both, and that a non-member still sees nothing.
- **Fix 3a, R-POINTS-SAME-QUAL:**
  - The family filter applies to points only. Entries still add up across families, and rates are already scored on their own grade scale.
  - A row with no qualification type is never counted.
  - The Context panel says why: "Points are on a different scale for each qualification type, so only {family} subjects are compared."
- **Fix 3b, honest number types:**
  - **Formatting:** the codebase's own per-measure formatter is used: points "+0.4", rates "+3pp" (whole numbers; the brief wrote "+3.1 pp"). Summary sentences spell out "points" and "percentage points", and a change that rounds to zero prints "0.0".
  - **Direction words** (Growing, Broadly stable, Declining) still use R-TREND-FLAT-4PCT's ±4% relative band. Only the printed number changed.
  - **Not changed:** the Data View's own map "Trends" toggle, which Column 1 Results' Trend map also uses, still colours by growth %. It's a shared Data View component, noted on the rule card.
- **Fix 3c** applies to any AS or AEA focus, not only AS-only subjects. An AS Psychology focus next to A-level Psychology also counts its own entries (100053: group 19 → 20).
- **Fix 4:**
  - The non-subject list existed only in the ingest repo (`ingest/academic_aggregates.py:_NON_SUBJECT_ROWS`). Its 8 (qualification, subject) pairs are now `NON_SUBJECT_ROWS` in `src/lib/dfe-qualification-buckets.ts`, pointing back to the Python, so there is still one list. The EPQ's "Study Skills" stays, as it does there.
  - **Sevenoaks (118952)'s picker did show the rows:** "Learning Skills", "Study Skills" and "Baccalaureate", 244 entries each, as the top three items. Godolphin and Latymer (100369) showed them too, 26 each.
  - **Knock-on:** Sevenoaks' Context on A*–E now covers 0 years instead of 2, because only the IB Core rows had A–E grades.
- **Fix 5:** `ENABLE_TESTING_SCHOOL_SWITCHER` and `NEXT_PUBLIC_ENABLE_TESTING_SCHOOL_SWITCHER` can come out of the deploy's env.
- **Fix 6:** `body:has(#teacher-root)` repeats `#teacher-root`'s two `--bg` values, because a parent can't read a child's variable.
- **The "Average points" rename (C3)** was decided for 0.6 and hadn't been done. It's done now, as a wording-only change on the live dashboards; the before/after strings are in the commit. The Post-16 whole-school headline keeps DfE's own name, "Average point score".

### S4 (Add a view)

1. **Previews use the real panel shape** (351 × 384): thumbnails are 44 × 48, not the board's 72 × 48. Customise's preview is panel-shaped at 100px tall.
2. **Preview frames use the panel's theme colours**, not the board's always-dark thumbnail. The highlight is the phase accent.
3. **Each card's rail badge is the PanelIcons glyph** on the active-rail look.
4. **PickEither uses Ch3Pick's frame** and adds only the Latest year / Over time grouping.
5. **Steps 1–2 hide options that lead to no view.** Super-admin also sees the unbuilt focus and compare options, to plan placeholders, so Custom area (2b) is unreachable for others today.
6. **Area focus follows the measure's keying.** Live births is area-keyed and gets the area chips. Rolls is school-keyed in the registry, so it gets "Whole school"; the brief said both get the area set.
7. **Grade bands and Grade counts are shown as live**, because they have views; the board marks them "soon". Averages chips are gated by measure geography, so Grade 4+ gets none.
8. **Board annotation lines are dropped.** The Pick footer says "N views fit". Rolls has 0 views, so its empty state offers only "Change data…".
9. **2a and 2b reuse the onboarding picker's sizes** (14.5px against the board's 13.5). In 2b, "Selected so far" sits below the tabs. "Save to reuse" is disabled, because there is no saved-areas table.
10. **New colour tokens** for the data families (Academic, Rolls, Social), which had none.
11. **`requires` warnings show in full**, with rule IDs stripped.
12. **Requests and placeholders:**
    - "Ask" inserts without RETURNING, because the asker can't read the row back.
    - Placeholders go only into the dashboard config.
    - `CategorySubjectPicker` gained additive `single` and `search` props.

### S7 (Meetings)

1. **The canvas is 1536 × 864**, an exact 16:9: pad 16 + title 44 + gap 12 + the 3 × 2 grid's 780 + pad 12. The grid is 1197 × 780. One uniform scale applies everywhere: the editor caps it at 1 and Present at 2, and PDF is A4 landscape with a 10mm margin (scale 0.68).
2. **One view on a slide shows as one unit, centred**, as in MeetingPlay, not stretched to fill the slide.
3. **Layouts:** Auto plus the board's five manual layouts. Text cells take text only, and the span takes a view only. A layout the slots overflow falls back to Auto.
4. **Empty cells:** the first offers "+ Add a view" and the rest "+ Text box".
5. **Additions not on the boards:**
   - Undo/Redo in the header;
   - Delete slide;
   - Delete on upcoming meeting cards, because the cap of 5 could otherwise block someone;
   - a confirm button in the Reuse panel;
   - Assign/share shown but disabled, because RLS forbids assignments on personal dashboards.
6. **The library uses the house TeacherNav.** Every archive card says "Reuse for next meeting".
7. **Tokens:**
   - the slide is `--box-bg` and slots `--panel-bg`;
   - board greys map to `--edge-strong` / `--panel-border2` / `--chip-fg`;
   - rose is `FEATURE_ACCENT.meetings`, and Remove is `DELTA_NEGATIVE`.
8. **A slot's fullscreen inside a scaled slide:** the canvas drops its transform while a slot is fullscreen, because CardBox's fixed-position modal breaks under a transform. Needs a live check.
9. **Versions:** edits autosave to the draft. A version is published at create, and at Present, Grid view, Export PDF or leaving the editor, if anything changed. Loading prefers the draft.
10. **Slot notes** use `teacher_view_notes` with key `meeting:{dashboardId}:{viewInstanceId}`.
11. **Migration:**
    - Round-5 slide keys map to registry views (table in commit 4e147c0). An unparseable key becomes a text slot that keeps its caption, so the one live slide is a text slot.
    - Every migrated view stays live.
    - A null date takes `created_at`'s date.
    - The school is set only when the owner has exactly one membership.
    - The cap trigger is suspended inside the migration's transaction only.
    - The old tables are untouched.
12. **`TREND_MIN_YEARS = 3`** (`teacher-view-catalogue.ts`) has no callers now (decision 9).

### E (views outside the page)

- **One of Candidates or Results per dashboard, as well as one phase.** The page's derivation reads one shared Candidates/Results setting for every column, so a custom dashboard can't mix them yet. Lifting it means deriving per column.
- **A custom dashboard has no subject picker.** Its focus subject is the person's first ticked subject on their Teacher dashboard.
- **A pinned year is honoured only on Context's Current panel**, the only host with a year control. Every other pinned slot shows the latest data and logs a `[meetings]` console note.
- **The fetch cache** is keyed by method + URL + body + JWT `sub`, kept 5 minutes, errors not cached, with `fresh` after the chooser saves. On a three-slot slide of one school, each route is called once. Decision 10 is done.

### Titles (lead)

- **The three change-view templates were unreadable.** Fix 3b had written their count/points/rate wordings as an inline `[a|b|c]`, so meeting slots printed the brackets. Both resolvers now fill `[change-word]` and `[change-of-measure]` from one helper, `src/catalogue/titles.ts`.
- **Meeting slots now:**
  - take the measure from the pinned data family, so a Results slot no longer says "candidates";
  - fill `[versus]`;
  - start trend titles at their first year.
- **A unit test** resolves every title for entries, points and rates and fails if any bracket is left.

---

## 2026-10-04 — 0.6 snagging round 1: judgement calls logged, build carried on

Prompt: `docs/v0.6/vicdata_0_6_snagging_round1_claude_code_prompt_v1.md`. Report: `docs/v0.6/snag1_report_v1.md`.

### 00 — the Teacher page draws the published dashboard

- **It waits for the stored config rather than swapping it in.** The load starts alongside the school's data and is awaited just before the page first paints, so there's no flash or swap. The cost is one extra parallel round trip, hidden behind the existing loads.
- **The drawn config always carries the slug as its id** (`vicdata.ks4.candidates`), whatever id the editor wrote into the JSON. The Edit link, the Updated line and the legacy keys depend on it.
- **"Unusable" means any of:** no row, no published version, a different `schema_version`, a config that fails `validateConfig`, missing tables, or a load error. Each falls back to the copy in code with a `[dashboards]` console warning.
- **A panel renamed in the editor now shows its name** in place of the host's tag. Without this, "Rename panel" wouldn't reach the page. Seeded configs carry no name, so they draw exactly as before. Renaming a *row* still doesn't show on the Teacher page, because the panels' tags come from the hosts.
- **A column the editor adds without a legacy key** isn't drawn on the Teacher page, which still renders through the three Teacher hosts; `/dashboards/[id]` draws it. Fine for refining the four, but worth knowing before structural edits.

### 01 — the Export menu

- **The cause wasn't the one the prompt assumed.** PanelMenu opens *below* its anchor (`top-full`), so the Export menu ran down past the panel's bottom edge, which the fixed-height CardBox clips.
- **The menu is left-aligned to its button, not right-aligned.** Export sits in the footer's left-hand cluster, so a `right-0` menu would have run past the panel's *left* edge. It flips to right-aligned only when it would run off the screen.
- **It's drawn in a portal** (into `#teacher-root`, the pattern CopyViewDialog uses), at the button's position, at z-1600 so it sits above the fullscreen modal (z-1500). Scroll or resize closes it.
- **"Same look as Notes":** PanelMenu's own border, radius and shadow are kept, as they were (14px radius, Notes has 10px). The prompt also said "PanelMenu contents unchanged", so I didn't restyle it.
- **Shared components gained two additive options:** `PanelMenu` has `placement: "above"`, and `useDismiss` takes an optional second "inside" element, for menus drawn in a portal.

### 02 — Compare against names the category

- **The existing `focusCategory` prop is the family id, not its name**, so ContextPills gained `focusCategoryLabel` (`familyFor().label`, the name the picker shows).
- **The Compare against menu is now 320px wide, not 264.** The longest real category row, "Technology, Engineering & Construction subjects", needs about 282px of text, and MenuRow truncates labels. 320 is PanelMenu's own cap (`min(90vw, 20rem)`); at 264 that row read "Technology, Engineering & Construct…".
- **PillMenu gained `title`, plus `max-w-full` / `min-w-0`**, so a long value truncates instead of overflowing. This is invisible for pills that fit, which is all of them today; the parity run confirms it.
- **"Subject category" strings left alone:**
  - Context's group label and phrase: they already name the category, and use "Subject category" only as the same no-focus fallback;
  - the editor's column summary ("Compared to: subject category", `editor-ops.ts`): item 03 says touch nothing else in the editor;
  - Data View copy and code comments: they mean something else.

### 03 — a menu for each view on its rail icon

1. **Instance ids:** "Edit" and "Swap" keep the instance id only when the dataview stays the same (or both are placeholders). A different view gets a fresh id, as Add a view would give it. The opening view follows the replacement.
2. **Editing a placeholder** reuses the empty state's placeholder form, pre-filled. It changes only the description, shape and notes; the placeholder's saved context is kept.
3. **There was no "today's reason" text** for a disabled copy of a placeholder, so the disabled row's tag reads "Planned".
4. **Chooser buttons:** "Save view" when editing, "Swap in" when swapping. The Pick header still says "Add a view".
5. **The view menu is 300px wide** (`EDITOR.viewMenuWidth`). At 264px, "Copy to another dashboard or meeting…" was cut off.
6. **The `···` tab** is centred on the rail divider, with a 2.5px invisible lead-in so the pointer can cross from the icon to the tab.
   - It's always in the Tab order, and shows on keyboard focus, on hover (`hover: hover`) and on the active icon on touch (`hover: none`).
   - Esc closes the menu and returns focus to the tab.
7. **Additive changes outside the editor**, needed for Edit and Swap:
   - AddViewChooser's `startAt` also takes "customise" and "placeholder", and it gains `editing` and `addLabel`;
   - CustomiseScreen gains `initialParams`;
   - EmptyScreen gains `editing`.

   Nothing else in the editor changed.

---

## 2026-10-04 — 0.6 snagging round 2: judgement calls logged, build carried on

Prompt: `docs/v0.6/vicdata_0_6_snagging_round2_claude_code_prompt_v1.md`. Report: `docs/v0.6/snag2_report_v1.md`.

### A — "Try VicData as…"

- **The school search Guy used before** was Platform's own search box. It filters `platform_school_overview()`, so it lists only schools that already have an account. The card uses the site's `SchoolSearch` instead (the `search_schools` RPC, every open school), so a school with no account, such as Croydon College, can be tried. It gained two optional props: `byUrn`, so a 5–7 digit query looks up the URN; and `allowRequest={false}`, which hides the "Can't find your school?" form. Its three existing lint errors are fixed.
- **One mechanism.** Look-as's URL pair now starts or continues a trial, so Platform's "Look at it as…" buttons land in the same mode, without Start fresh. The log action `look_as` is replaced by `try_as` with `{role, fresh, via}`, where `via` is account, platform, banner or url.
- **`&peek=1` keeps the old read-only look-as**, for the Catalogue page's side-by-side parity frames only. Otherwise those frames would force the config renderer and take over the tab's trial.
- **How a trial is keyed:** state key `{urn}~trial~{role}`.
  - `teacher_view_preferences`, `_notes`, `_onboarding` and `dashboard_user_state` put it in their existing `school_urn` text column, through `stateUrn()` inside the libs. No schema change, and none of those tables' existing rows or RLS are touched.
  - Personal dashboards, meetings and recruitment jobs have no school column, so they get a new nullable `trial_key`. On `dashboards` a CHECK allows it only on personal rows.
- **New table `trial_contexts`:** RLS is `profile_id = auth.uid() and is_platform_admin()`. It feeds "Recently tried" and the Start-fresh default; until the migration is applied, those fall back to localStorage.
- **Start fresh** clears the walkthrough and saved state (preferences, notes, onboarding, per-dashboard state) through `reset_trial`. It keeps the trial's own dashboards, meetings and recruitment jobs.
- **A trial has no super-admin chrome:** no Edit link, no placeholder panels, and no People, Teams or Platform in the menu. Item B brings Edit back through the banner.
- **A School-Admin trial** gets the Teacher home and Teacher's VicData dashboards, and can only read the school's own dashboards. Managing People or Teams, or creating school dashboards, would write the school's shared data.
- **A trial can't save comparator sets**, which need a real membership, as with look-as before. The unsaved chooser choice is kept with the trial's other settings.
- **The trial lives in sessionStorage for that tab**, and signing out clears it. Links also carry the URL pair.
- **A trial dashboard or meeting is never attached to the school account.** The trial uses Guy's platform-admin meeting limit (none), not a member's 5.
- **No sign-in event is recorded while a trial is active.** No membership, team or join request is created.
- **The card uses `/account`'s own neutral styling** and the OS theme, as the rest of that page does. People's `RoleChip` is reused, with its tokens mapped onto `/account`'s `--foreground`/`--background` (aliases, no new colours).

### B — the Edit switch in the footer

1. **The editor opens in place, not by a hop to another page.** With Edit on, the page draws the same editor as `/dashboards/[id]/edit` where the dashboard was, at the same URL. The page underneath stays mounted but hidden, so the focused subject, open rows and the trial's state come back with no carrying across a navigation; scroll is restored from sessionStorage. Exit turns the switch off. While editing, the Candidates/Results switcher moves the editor between the two without changing the page's saved choice.
2. **The Teacher page now shows no super-admin chrome to Guy either:** the top-bar Edit link and placeholder panels are gone, and the footer switch is the way in. A VicData `/dashboards/[id]` is likewise drawn as a member sees it. Non-VicData dashboards keep their Edit link.
3. **The switch appears only under the config renderer, and after the walkthrough.** With the flag off, the page isn't drawn from a config, so there's nothing to edit in place.
4. **Preview draft is trial-only**, because it lives in the banner. It works whether Edit is on or off, and only for that tab.
5. **The editor now saves any pending autosave when it closes**; Exit could previously lose up to 1.2s of edits.
6. **Save as from the in-place editor never makes a trial-keyed dashboard.** All editor writes are drafts and versions as Guy (`created_by` / `updated_by` = his profile).
7. **The trial's role feeds only the preview** (school, subject). Add a view in the editor still offers every view, as for super-admin, because edits reach all schools.
8. **On `/dashboards/[id]` the live preview gets the school but not the focused subject.**
9. **After Publish, the editor's autosave writes a draft identical to the new version.** Left alone.
10. **On first viewing a newly published version,** the trial records `seen_version` under its own trial key, as a member's visit would. Editing itself writes no trial state.

---

## 2026-10-04 — 0.6 snagging round 3: judgement calls logged, build carried on

Prompt: `docs/v0.6/vicdata_0_6_snagging_round3_claude_code_prompt_v1.md`. Report: `docs/v0.6/snag3_report_v1.md`.

### 01 — the number tiles' small figures

- **What "editable" meant before:** nothing on the panel itself. Customise's Numbers/Years/Look/Title choices were saved on the view instance (`params`, `title`), but no host read them when drawing. The big number only looked editable: its Numbers chip changed the Customise sketch, never the tile on the page or the editor's live preview. Hosts now read the new tile settings, and the editor's live preview carries the instance's params.
- **The main figure itself stays the host's headline;** only its label can be edited. Each small tile can be chosen, relabelled, shown or hidden, reordered, added or removed. The choices are stored as `params.tiles` (in order) and `params.mainLabel`, and only what differs from the default is written.
- **Tile-specific placeholders** keep the moving parts of each scope line: `[total]`, `[from-year]`, `[range]`, `[direction]` (above / below / level with), and `[measure]` on the main label. They sit alongside subject, category, school and year. Scope lines aren't capitalised, unlike titles, and a placeholder that can't be filled falls back to plain words.
- **Results has one list across its measures**, giving each measure today's order: category rank (points and Grade 4+ only), range count (bands only), England's figure, gap. A figure that doesn't exist on the current pill keeps its place but isn't listed, and up/down skips over it.
- **Honesty is checked against the column's measure.** Comparisons' tiles are checked against their headline measure.
- **Editing figures forks the view into a custom one**, as any Customise change does. The id is kept, so the default view is unaffected.
- **Hidden tiles stay in the list,** dimmed with the toggle off; removing one takes it out, and "+ Add a figure" brings it back.
- **The Customise preview stays the data-free sketch.** The edits show in the editor's live preview and on the page.

### 02 — "Make this the default view"

- **The ticked row** reads "Default view ✓", or "Default for {pill} ✓" on Results dashboards. On a view dimmed by "Show all views", the row is disabled and tagged "Not shown".
- **`MenuRow` has a new optional `dotted` prop.** When it isn't set, the row renders exactly as before.

### 03 — the editor follows the Results pill

1. **A dataview's default `resultsMeasures` is derived from main's live rails** at each pill state (table in the report), and it is also the most that view can be drawn on. "Show on…" can narrow or restore a view's measures, but never add one its host can't draw.
2. **Adding a view under a pill tags it with that measure only,** unless the dataview is already that measure alone. A dataview that can't draw the pill keeps its default, and a toast says so.
3. **The editor's Results pill and the "Show all views" switch** sit at the right of the linked-dashboard band. The edit bar has no live-preview school for them to sit beside.
4. **On a Results dashboard, "Make this the default for {pill}"** writes only `defaultViewByResults`; the panel's own `defaultView` is untouched. A pill with no entry falls back to `defaultView`, and when that view isn't on the pill's rail, to the rail's first view.
5. **"Show on…" won't untick the last measure.** A per-measure default is dropped when its view leaves that measure.
6. **Page behaviour:**
   - a pill's own default is applied once per pill state;
   - with no entry, the reader's view choice is kept across pill switches, as today;
   - "exactly one view → no rail" still counts the panel's views on every measure, so today's Grade counts rails don't change.
7. **Tile settings** (item 01) come from the first instance shown on the current pill, else the first instance.
8. **The change summary** prefixes a measure's name whenever a view isn't on all four measures ("Grade counts: removed Spread by year from Results · Trends"). It now also reports default-view changes.
9. **Pick already filtered by measure;** it now also puts views drawn on the current pill first. That makes no visible difference with today's catalogue.
10. **`schema_version` stays 1.** Configs without the new fields behave exactly as before, and no data migration is needed.

---

## 2026-10-04 — 0.6 snagging round 4: judgement calls logged, build carried on

Prompt: `docs/v0.6/vicdata_0_6_snagging_round4_claude_code_prompt_v1.md`. Report: `docs/v0.6/snag4_report_v1.md`.

### A, B, C — one "View as"

- **Root cause of Comparisons breaking in a trial at The Chase:**
  - `/api/data-view/academic-schools` and `/api/teacher/saved-comparator-sets` admitted approved members only, with no platform-admin fallback (the `teacher/*` routes have had one since S1).
  - In view-as Guy isn't a member, so both answered 403. The page then had no comparator profiles: the map found no location for the school, and the graph and ranking had no figures.
  - "10 nearest" still resolved through `chooser-set`, which explains the title. The URN, the 10-nearest list and the location data were all fine.
  - The membership-gated routes the chooser, Comparisons and Recruitment call now let a platform admin in after the member check, like the `teacher/*` routes.
- **The brief's grounding, corrected:** live, Guy's platform-admin profile has one approved membership (Acland Burghley 100053). The Chase's only member is another profile, so "as Guy, The Chase works" must have been that other login. The two-membership case was tested anyway (10/10). Before the fix it showed "Teacher view is available to verified school staff", a real member-facing bug, now fixed. The school shown is `?school=URN` (remembered), else the earliest approved membership; there's no switcher UI yet.
- **Across tabs:** a session cookie (`vicdata_view_as`), because the data routes need it too. Pages and routes re-confirm platform admin every time. View as ends when the browser closes. A tab that comes back into view after View as changed elsewhere reloads.
- **Start and Back to me** do a full page load to `/teacher`, so no cached data crosses over.
- **One Edit setting:** the Edit switch is now one localStorage setting in both modes. Round 2 kept a separate per-tab one for a trial.
- **Pill and wording:** the pill shows ▾ at rest too. "Recently tried" is renamed "Recently viewed as". "Trying VicData as" became "Viewing as", and "Exit" became "Back to me".
- **A trial's own comparator sets and rankings** are stored as Guy's own `teacher_view_notes` rows under `{urn}~trial~{role}~sets`, one row per set, so only Guy can read them and they are never shared with the school. `teacher_view_preferences` couldn't hold them, because of a CHECK on phase. A proper table would be cleaner long-term, but it would have meant a migration and a stopped merge. Worth doing later.
- **School-Admin in View as:**
  - It reports `canEditShared` as true, so pages draw identically, but every save to shared sets, rankings, People or Teams is refused with "View as: read-only".
  - People and Teams read through a new route, `/api/teacher/view-as-people` (service role, after confirming platform admin and a School-Admin View as). Invite (copy link) still works.
- **Start fresh** keeps the trial's own sets, as it keeps its dashboards, meetings and jobs.
- **Meeting cap:** View as uses the viewed role's meeting cap (20 for School-Admin, 5 otherwise), so it behaves like the member.
- **Scope:** View as covers the Teacher and dashboard pages. `/account`, `/sets` and `/platform` stay Guy's own, and the pill shows the mode there.
- **One module:** `trial.ts`, `look-as.ts` and `teacher-route-access.ts` are folded into `src/lib/view-as.ts`. TryAsCard became one ViewAs component, used by both the nav pill and `/account`.
  - The bare `?lookAs=&as=` pair no longer starts anything.
  - `?peek=1` stays, for the Catalogue's frames only.
- **Logs:** the action is `view_as` with `{role, fresh}`. The `via` field is dropped, and old `try_as` rows are untouched.
- **The naming gap stays:** `trial_contexts`, `trial_key`, `reset_trial` and the `~trial~` in keys, so no migration was needed.

### 01 — view titles and the Customise audit

1. **What counts as a title override:** only a title that differs from the dataview's template. Customise always saves the template, so an untouched title changes nothing.
2. **A trend's `[year]`** is where its honest series starts, as the panel and Customise's preview start it. It doesn't follow the reader's own "From" menu.
3. **The Trend scale sentence above indexed charts keeps its words;** the geography heading takes the override.
4. **A meeting slot's figure takes the override only from Customise's own title**, so existing slots don't change.
5. **On a dashboard, Customise moves only among views that panel can draw.** Before, switching a Current panel's view to a trend view was saved and then silently dropped. The other single/trend choice is dotted with "Coming soon".
6. **"Coming soon" fields:** the "from" year everywhere, and Roll forward on dashboards (a dashboard always shows the latest year; it's saved as on). Roll forward works in meetings.
7. **Numbers acts as a view picker:** a view showing several number types (the tiles) still shows them all.

### 02 — Context's rail and Compare against

- **The pre-0.6 page never varied Context's rail by Compare against** (verified at 5597757: only the data, the labels, and the Trend card's "focus vs group" for All subjects changed). So this is new behaviour, with defaults that change nothing.
- **Round 3's Results filtering is now one variant mechanism** (`src/catalogue/variants.ts`), with three axes:
  - `results`;
  - `compareAgainst` (Context);
  - `comparator` (Comparisons' schools vs ranking set).
- **The comparator axis is included because the host already varies by it:** Number tiles show for a ranking set only, and the three maps for chosen schools only. It has no editor pill, because the band had no room for a third; it follows the page, and Show all views reveals the other kind's views.
- **A view added in the editor is tagged only for the current Results measure,** never for a Compare against set. Context always has a set on, so tagging would silently narrow every new view.
- **Defaults per state:** with two or more axes the editor writes `defaultViewByState`; Results alone still writes round 3's `defaultViewByResults`, and a round-3 per-measure default still applies under any Compare against set. `schema_version` stays 1.
- **Copies:** a copy into a meeting drops every axis; a copy to a dashboard keeps them.
- **The editor's live preview on "Selected subjects"** uses the page's selected subjects.

---

## 2026-10-04 — 0.6.1 view editor rebuild: judgement calls logged, build carried on

Prompt: `docs/v0.6/vicdata_0_6_view_editor_rebuild_claude_code_prompt_v1.md`. Report: `docs/v0.6/views_rebuild_report_v1.md`.

### S1 — bugs from live

- **Distinct titles (pinch point 3):**
  - the Area chart is "[subject] against its LA and England, year by year". It leaves out "region" because the chart draws no region line;
  - the Change table is "[subject]: change against its LA, region and England".
- **"What's changed" (pinch point 1):** each view is named by the title the page shows. Placeholders resolve to neutral words ("This subject", "its category", "the first year", "the chosen year"). Members can't read the earlier version (RLS), so summaries published before the fix are reworded from their own text when shown. An internal name that can't be matched becomes its unique title, or "a table" / "a chart".
- **The old template text still counts as "no custom title"** (`RETIRED_TEMPLATES`).
- **A title cleared back to its default** reads "… is called “…” again".
- **The Move/Copy map's current cell** reads "Here now", with an amber border and tint.
- **A separate commit (655bb70) fixes a members' bug found on main:** under the config renderer, the first rail click away from a panel's default view was undone. It changes clicks only, nothing drawn at rest, and can be dropped on its own.

### S2 — ViewSpec model and presets

- **The preset table** (`docs/v0.6/views_preset_table.md`, 40 presets, every one `compare: "follows-page"`) is generated from `src/catalogue/viewspec.ts`. A test fails if the doc drifts from the code.
- **The ViewSpec was extended where presets needed it:**
  - `data.source: "follows-page"`, `data.entries: "points-eligible"`, `data.subject: "follows-or-whole-school" | "whole-school"`, and `data.change: "honest" | "absolute"` (trend map vs change map);
  - `years.memberPick`;
  - `compare[].as` (line / marker / reference / row) and `compare[].at: "earlier-year"`;
  - `variants`, beside `resultsMeasures`;
  - looks: line `shortSpan` / `memberLegend` / `cardFocusVsAverage`; bar `orientation` / `spacious` / `diverging`; table `extra: "vs-comparison"` / `leadingRank` / `value` / `changeLeads`; spread `memberSpan`.
- **Reading v1: convert on read** (`upgradeConfig`, adding each view's preset spec and changing nothing else). It covers dashboards, drafts, history, meetings and the library. Members' VicData pages never upgrade: `published-vicdata.ts` draws the code copy for any version other than 2 (D9). A v1 meeting with a text-box slide is tested to load unchanged.
- **The editor and History also convert VicData's v1 rows on read**, so they see a v1 version as the v2 it equals.
- **`dataview` stays on each instance** as the key the hosts draw by, until S3. The spec's `resultsMeasures` and `variants` are the preset's defaults; an instance's own narrowing stays where it was.
- **The re-seed** publishes each Teacher dashboard as a new version over its v1 row, and does nothing when the published config already equals the code copy. It clears only old-format drafts, never a v2 draft.
- **Retired and draft views still get presets** ("Grades (pick a range)", Candidates' ranked-change draft), so old configs keep loading.
- **Classification:**
  - a ranked change is a bar chart of change; a change table is a year table sorted by change;
  - the Grade counts change table is one value per grade;
  - the geography views have no rows, and their LA, region and England lines come from compare.
- **D10:** `panelSignature` is built from the preset; params are looked up by instance id (`ConfiguredNumberTiles`).

### S3 part A — the renderer, with line, table and bar

1. **The panel frame stays the host's for now** (tag, From menu, summary, flag, Trend line toggle, source). v2 draws the title line and the chart. A spec of its own keeps the host on its preset, so the frame matches.
2. **The host still owns which preset is active.** `defaultEntry` / `offRailEntry` still apply defaults under v2; only the rail filtering is retired.
3. **A spec counts as "its own" when it differs from its preset.** It then has its own active state, uses `spec.icon`, and resolves its spec title.
4. **Under v1 the builder duplicates the hosts' assembly** (the same lib calls). It replaces the host bodies when v2 becomes the default.
5. **Host titles are kept as their exact text runs,** because the browser lays out JSX-interpolated text differently from a single string, and that broke parity.
6. **Which "From" year a Trends view uses:** the one for the half its preset belongs to. A spec of its own uses the change half when it shows or sorts by change.
7. **An explicit compare keeps only the series the frame can supply:** the group line, England for the focused subject on Results, the set average, or the chosen school. The rest are dropped until S4's greying.
8. **Rows:** any value means the frame's rows; leaving `rows` out means the focused subject alone.
9. **Weighted averages and the table's "n" column** need counts, so only Comparisons offers them.
10. **A focus-only line** uses TrendChart (bars under 4 years) unless its look asks for change bars. An indexed one uses MultiTrend.
11. **Comparisons' Trends tables and ranked bars** keep the host's trim, which follows the member's "vs:" line.

### S4 — the Add a view and Edit view screens

- **Retired, and what's kept:** Ch3Pick, Ch3Adjust, Ch3Empty and Steps 1–2 are retired for adding and editing views. The 0.6 chooser stays for:
  - the placeholder form ("Something else? Plan it", and a placeholder's own Edit);
  - Swap;
  - columns with no host (Rolls, Live births);
  - meetings' Add a view.

  `ContextSteps` (Steps 1–2) stays for column and panel "compared to" and for New dashboard.
- **D6 (no board):** for Comparisons, step 1's "Compared with" becomes a **Schools** box: chips for Follows the page / 10 nearest / Saved set… / Sector…, a line naming the live set, then a This school row. "Add an average" offers only Across schools. Saved set and Sector are greyed, because there's no set-name picker and the ViewSpec has no sector sets.
- **`spec.preset` is always the host preset the view is drawn by:** the preset it equals when unchanged, else the nearest preset of the same host and half.
- **Titles:** a rename alone keeps the instance a preset (the title goes on `instance.title`); a spec of its own carries `spec.title`. In Edit the title is frozen; in Add it follows the data until typed.
- **Show-for** starts ticked on the current pill. Ticks the host preset can't draw are greyed; Grade counts has its own host.
- **Board chips greyed with a reason** because the catalogue doesn't allow them:
  - Indexed on points;
  - LA and region on bands;
  - "A chosen school" and "Another subject", which the ViewSpec has no field for.

  The Data "Change" link is disabled, because a view draws its column's data.
- **"Which subjects" chips** (This subject / Its category / Follows the page) were added to the Numbers box, limited to what each host's frame supplies.
- **Choosing a Data option a View can't draw switches the View;** a View never changes the Data.
- **Previews:** step 2 previews every View except Line graph, as the boards do. Add on desktop uses the EditWide layout. Previewing another school uses `SchoolSearch` inside the school ▾.
- **The Step 3 preview on a phone is about 280px tall** (the real panel unit), taller than the board's sketch.
- **Not drawn yet (S3 part C):** LA and region lines, averages of things not drawn, compare lines in a custom table, and series colours. Until then the previews show only what draws, and the screens say "The new renderer doesn't draw a … here yet" where a View isn't built.

### S3 part B — ranking, numbers and slope

- **The frames carry the extra inputs** the tiles and ranking need: the band range and grade rows, Candidates' school-wide subjects, Comparisons' ranking figures with sector and distance, and the school name. The hosts' own v1 drawing is untouched.
- **Ranking look options are all off by default,** so the presets draw exactly as before. A shortened list keeps each row's real rank.
- **The ranking "change" column** is each row's change from its previous published year, in the measure's honest change type. "n" is the entries count where the page has it.
- **Slope is new:** each row is drawn at two years, the From year (or the first) and the latest. A row missing either end is left out. No preset uses it, and `follows-page` on a slope adds nothing.
- **Parity:** one consistent 1/255 single-channel difference over 16 px on one tiles shot is a rendering artifact; its DOM and scroll state are identical.

### S3 part C — donut, maps, geography, and the compare gaps

- **Parity was checked on fixtures, not live data.** Two attempts to rebuild a live-data harness were blocked by the permission classifier: one put the server key in a browser bundle, the other swapped it into a proxy. Both were rightly refused, and the scratch copies were deleted. Parity ran instead through a component harness: the real hosts, through ColumnPanels and the code-copy plans, on the committed real-data fixtures. Context's group totals, the geography payload and map positions are synthetic. Grade counts and Context's bands-share donut aren't covered there; the donut is unit-tested.
- **Results' England line** uses the subject's England benchmark, the same national figure the geography fetch returns. LA and region come from that fetch.
- **On Candidates,** once an area line is drawn, the school's own line switches to points-eligible entries.
- **"10 nearest" and "saved set"** both mean the page's current Compared-against set.
- **A weighted average** uses all entries as its weights.
- **A geography preset with edited compare lines** draws as an ordinary line or table.
- **"Across schools" on Grade 4+ and bands, on a subject column,** can't draw: outside Comparisons the page has no comparator grade counts. It's greyed with a reason (S3 part D) rather than fetched in this pass.

### S3 part D — Grade counts and the grade spread

- **The grade arithmetic moved unchanged into `src/lib/grade-spread.ts`;** GradeCountsPanels and SubjectPanels both read it, as S3 part C did with geography.
- **Follows-page on a Grade counts spread** means England ticks, except on Spread by year, where it means the subject's own earlier year. An explicit compare on a spread keeps only England and the earlier year.
- **An own-spec spread** is clickable only with `memberSpan: "highlight"`, which the editor doesn't offer yet.
- **The average marker** is a dashed line: the mean grade on a numbered scale (U counted as 0), and "≈ grade" from the mean position on a named scale. Double Award counts as a named scale.
- **In counts mode,** England's tick sits where this school's entries would be at England's share.
- **A shaded band** applies only when both ends are on the subject's own scale.
- **Under v2, a panel with no rail** (Grade counts' Current) opens on its state's default view. Before, it fell back to the Results tiles instance.
- **Honesty:** on a subject column, 10 nearest and saved set are greyed on Grade 4+ / A*–E and Grade bands ("Needs the other schools' grade counts, which are only loaded in Comparisons", R-COMPARATOR-RATE-PER-QUAL).
- **A possible live bug, the same in v1 and v2:** Post-16 Grade bands with no range picked says "No published grades … in this year" on the Grades view, so a member can't open it to pick a range. S5's top-bar band control is checked against this.

### S5 — the rail menu and the top bar

- **"Show on…" is folded into "Shows for".** A panel that also varies by Compare against (or Comparisons' kind) gets a second chip row, "Shows for · <axis>".
- **Swap for another view… is dropped from the rail menu;** it isn't on the board.
- **Move up / down is one row with ↑ ↓ arrows,** because the board doesn't show how one row does both.
- **The last ticked chip is locked.** Take off on a view's only measure is disabled ("Shows only here"). With no Results axis (Candidates), the red row reads "Remove view".
- **Grade band choice (D3):** Custom applies on a "Show grades X–Y" button, so one pick saves once. The editor's band starts from the page's band, falling back to GCSE 7–9, or the A-level scale with no range at Post-16.
- **The "Grades (pick a range)" view is kept as "Grade distribution":** read-only, shading the top bar's band. Its range picking moved to the top bar, the instances stay in the configs (no re-seed), and members' open-view state survives.
- **The editor's Results pill** is replaced by the shared top-bar control. Compare against stays in the edit bar: it's Context's own setting, and neither D3/D4 nor any board moves it.
- **A Post-16 member with no range** now picks one from the top bar. The no-range notes point there.
- **The members' change (D3/D4) is its own commit:** only the top bar and Column 1 Current on Grade bands differ. At 1280 on GCSE, the ControlBar wraps to two rows when four subject chips show.

### S6 — switch on and check

- **Row alignment:** Column 1 on Results pages gets an invisible pill row (`PillRowSpacer`), from md up only, so its panels line up with Context's and Comparisons' again. Candidates mode is unchanged.
- **Grade ranges inside sentences** keep the scale's own case ("A*–B", not "a* to b"), and keep "to" when a grade contains a hyphen (Double Award). The top bar's own pill still reads "A* to B".
- **Phone sideways scroll** (it predates this round): the page's `<main>` sized to its content's min-content, because the phone nav's second row needed 375px. `w-full` on the Teacher page's main fixes it, and the subject pill now truncates. `CustomDashboardScreen` has the same pattern and wasn't touched.
- **v2 is the default.** `?views=v1` or `NEXT_PUBLIC_VIEWS=v1` turns it off, and the URL wins over the env setting.
- **A single-subject line ignores the column preset's hidden "change-bars" look,** so "this school only" draws D8's two-year bars, not a one-row change list. Found in walk-through 1; no preset uses that combination.

### S6 — polish

- **D1's chrome is out of the editor:** the "inherits column" / "overridden" badges, the panel menu's "Change data / compared to…", the column's "Data · Compared to" line, and Edit column with the dialogs only it opened. The column heading (icon plus a title you can rename) stays.
  - **Kept underneath:** the panel override data in editor-ops (the span "follows" choice and Copy's fit check still record one, though nothing shows it); the old 0.6 chooser's "overridden" wording, reachable only from planned views and Swap; and Copy's "follows the column" message.
- **Editor previews draw on the page's own measure** (`oneViewConfig` with `asPage`). The meeting-slot fallback, which swaps to a measure the view supports, is kept for meeting slots only. It was why the Area chart previewed Average points on Grade bands while members saw the not-applicable note.
- **Rail tooltips** use a view's resolved title when it has one. A disabled host button keeps its own words, because they say why it's off.
- **Show this view for** in Add ticks every measure the view can honestly draw, as on AddView3. The ticks follow Data and View changes until first touched; Edit keeps the instance's ticks.
- **The wider-system (geography) views are greyed off Average points** in "Show this view for" (R-NO-GRADE-RATE-GEO). A view already ticked there can still be unticked.
- **The spread's mean marker** sits between measured row centres and carries its value tag ("5.3", or "≈ A" on named scales). Band labels read in the presets' order ("Shade 4–9").

## 2026-10-05 — 0.6.2 grade data round

Prompt: `docs/v0.6/vicdata_0_6_grade_data_round_claude_code_prompt_v1.md`. S1 findings: `docs/v0.6/grade_rollup_reconciliation_v1.md`.

### S1 — reconciling the rollup (no app change)

- **KS4 reads the rollup; KS5 reads the historic facts directly.**
  - The rollup equals the facts on every key, in both phases and all four years.
  - At KS5, though, it has no zero-entry grade rows, and the app draws them today (Grade counts and the distribution: 127 of 155 sampled subjects differ). By the prompt's own rule, KS5 doesn't use it.
  - `dfe_ks5_subject_results_historic` parses with the unchanged `parseSubjectGradeDistribution`.
- **The "−0.9%" in historic KS5 is the IB non-subject rows** (R-IB-NONSUBJECT): 10,478 of 1,142,093 entries in 2021. It isn't suppression, T Levels or a dropped qualification. The modern "double count" is the "All subjects" rows. The rollup sums KS5 sizes only within VRQ Level 3, and no app figure reads size (`averagePointsFor` has no caller).
- **The rollup needs a read path:** it's granted to `authenticated` only, and anon/service_role are refused.
  - Proposed, **not applied**: `docs/v0.6/proposed_sql/vicdata_academic_subject_grade_rollup_lookup.sql`. It's for the vicdata data database, so it isn't in this repo's `supabase/migrations/`. PGlite test: `supabase/tests/v062_s1_grade_rollup_lookup_pglite.mjs`, 8/8.
  - **For Guy:** copy it into `vicdata/supabase/migrations/` with a fresh timestamp and apply it there. S2's KS4 path waits on it.
- **The RPC's lineage fallback is per era** (periods to 2022 / from 2023), to match `reference_data_lookup`'s per-source fallback. Without it, 82 KS4 URNs would lose their latest-year grades and 130 would miss their historic years.
- **No index migration:** every planned read is entity-led and served by the primary key and `entity_idx`.
- **Historic KS5 grade labels need mapping in S2** ("COVID result", "Supp", and the vocational short codes `*`/`D`/`M`/`P`/`DD`/…). They're logged as a rule to add, for example R-HISTORIC-GRADE-LABELS, with the mapping by qualification. Otherwise S2 ships A-level-family history only and leaves vocational at two years. Guy's call if the mapping looks contentious.
- **Found on the way, not fixed:** `lookupReferenceData`'s 50-page cap silently drops schools from a large batched grade fetch (above about 70 GCSE schools). It doesn't affect today's 10-nearest sets.

### S2 — four years of school grades

- **How the read works** (`src/lib/grade-rows.ts`, `academic-data-view.ts`):
  - The dashboard route asks `fetchSubjectLevelDataForSchools([urn], phase, { gradeYears: "four" })`. Entries and value-added stay the modern facts'; only `gradeDistribution` gains 2021/22–2022/23.
  - **GCSE:** the rollup RPC `academic_subject_grade_rollup_lookup` when it's applied. Until then (it isn't), the first call gets PostgREST's 404 / PGRST202, the server process remembers "absent" and never asks again, and the rows come from the modern + historic facts. S1 proved the two equal on every key; a unit test checks it again on real rows for The Chase and Acland Burghley (8 subjects, `grade-rows.fixtures.json`). Any other RPC error throws, as every other lookup does. **Once Guy applies the RPC, a restart (deploy) picks it up.**
  - **Post-16:** always the modern + historic facts (S1: the rollup has no zero-entry grade rows).
  - KS4's historic total label ("Total number entered") is dropped, and 2020/21 (totals only) is skipped.
- **R-HISTORIC-GRADE-LABELS (new rule, unit + real-data tests):** the 2021/22–2022/23 KS5 vocational short codes take their 2023/24 words by qualification. Always on BTEC, OCR Cambridge Technical, Other General Qualification and AEA (D/M → Distinction/Merit). On VRQ only in a set that carries a code no A-level-type scale has, because VRQ Level 3 mixes A*–E sets (where "*" is A*) with Distinction–Pass ones. Never on A level, AS, EPQ, Core Maths, FSMQ, IB or Pre-U. "COVID result" and "Supp" join `NON_GRADE_VALUES`. Croydon College's 2021/22 Business Studies BTEC now reads Distinction* 2, Distinction 9, Merit 31, Pass 9 on the vocational scale. **KS4's historic labels are left raw:** they use the same encodings 2023/24 still does.
- **The Data View's deep-dive drawer is unchanged** (modern years only): it calls the same function without the option, and the rule test checks it still reads 2023/24–2024/25. Giving it four years would change a members' figure outside this round's list, and its own copy says "modern years only".
- **Found and held, for Guy:** the band scale (`focusScale`, and Grade counts' highlight scale) is still chosen from the 2023/24-on rows. On four years, small GCSE cohorts with no 8 or 9 since 2023/24 (13 of 711 sampled subject sets, e.g. 150127 Art & Design; script `docs/v0.6/audit_scripts/grade_rollup/s2_scale_check.mts.txt`) would read as GCSE instead of IB 7-1. That fixes a latent bug: today they get no Grade bands figure. But it would change a latest-year figure, which isn't on this round's list, so it's not done. Two KS4 "Level 1/Level 2 vocational" sets would also switch encoding scale. Recommend a follow-up: pick the scale with the GCSE tie-break, not by length alone.
- **Wording changed on members' pages** (the old copy became untrue): the Results and Context notes "… is published per grade only from 2023/24, so this covers fewer years …" lose that clause. Grade counts' one-year note now reads "This subject has published grades for one year only; …". The editor's "School grade rows cover 2023/24 and 2024/25 only" note is gone.
- **Rule test expectations updated on purpose** (S5 kinds: grade measures gain 2021/22–2022/23, bars become lines): R-THRESHOLD-PERIODS (100053 now 2021/22–2024/25, plus a check that the Data View read stays two years) and R-TREND-LINE-4YR (Grade 4+ now 4 years → line). Unit test added: "History, this school only" on Grade bands / Grade 4+ draws a line on The Chase's real four years.
- **Checked on 30 schools × both phases** (711 subject sets): the 2023/24 and 2024/25 grade rows and Grade 4+ / A*–E rates are identical to before, every set.
- **`lookupReferenceData` now warns** when it stops at its 50-page cap (it still stops; no figure changes). The new grade fact reads go in chunks of 25 schools, read one after another, so they stay well under it.

### S3 — comparator grades and "across schools" on grades

- **`/api/teacher/comparator-grades` reads `fetchSchoolGradeRows(urns, stage, subject)`:** one subject, 2021/22–2024/25. At GCSE it's the rollup RPC, filtered to the subject in the database, once applied. Until then, and at Post-16 always, it's the modern + historic facts, read in chunks of 25 schools one after another (a big saved set no longer loses schools at the 50-page cap) and filtered to the subject. Same response shape. The school itself comes from the same read as its dashboard rows.
- **Years already shown are identical:** for The Chase, Acland Burghley, King's Worcester and Croydon College, each + 10 nearest, every school's 2023/24–2024/25 rows equal the old read (44/44 schools; `docs/v0.6/audit_scripts/grade_rollup/s3_timing.out`). Unit tests check the RPC and facts paths on real rows.
- **Timings, read-only against production, medians of 3** (before = the old route's read: modern facts, every subject; after = what runs today, the facts fallback, because the RPC isn't applied):

  | Set | Before | After (fallback, 4 years) |
  |---|---|---|
  | The Chase + 10, GCSE History | 484 ms (220 rows) | 618 ms (435 rows) |
  | Acland Burghley + 10, GCSE Maths | 156 ms | 218 ms |
  | King's Worcester + 10, A-level Maths | 187 ms | 185 ms |
  | Croydon College + 10, Business Studies | 255 ms | 267 ms |

  **After the RPC is applied (GCSE):** its body, run read-only as SQL for The Chase + 10 History (2021 on, 435 rows), takes 62 ms cold and 21–22 ms warm, including the round trip (`s3_rpc_body.sql/.out`). Add the HTTP floor S1 measured for a one-subject RPC (≈ 50 ms) and that's ≈ 70–110 ms against 484 ms today. This is an estimate from the SQL; it's not a measured HTTP call, because the RPC isn't applied. Post-16 stays on the facts (≈ the same as today).
- **"Across schools" grade lines are no longer greyed** (step 1's Add an average and step 3's ticks, which both read `compareHonest`):
  - **Grade 4+ / A*–E and bands on a subject column** (Results, Context): the set's line is each school's own rate per year, from its own grade counts for the focused subject and exact qualification, scored by the page's own rate function and range (R-COMPARATOR-RATE-PER-QUAL). The data is the same comparator-grades request Comparisons makes, letter for letter, so where Comparisons is on the page the two share one fetch (fetch-cache). It's fetched only once a view asks: the ask is queued from the frame, never set during render. A ranking set (a sample) gives no line (R-RANKING-SAMPLE). Weighted means weighted by each school's graded entries that year.
  - **Grade counts, new rule R-COMPARATOR-GRADE-SHARE:** across schools is **each grade's share of a school's graded entries, averaged** (mean or median) over the set's other schools with graded entries that year. It's never a raw count, because schools differ in size. There was no comparator-counts rule to follow (comparator counts fell back to points), so this is the choice.
    - It's drawn as ticks on Column 1's grade spread (Grade counts' distribution, and Results' bands Grade distribution), **in place of England's ticks** when both are asked for, since a spread has one tick per grade. While loading, no ticks are drawn; England never stands in.
    - "Weighted" stays greyed on counts: the plain average lets each school count once.
    - Comparisons and Context still fall back to points on Grade counts (R-MEASURE-FALLBACK).
    - Ticks cover only the grades this school's spread draws.
  - **"Saved set…" stays greyed outside Comparisons, as for every measure** ("A saved set is chosen on a Comparisons page"). That's an existing rule, not a grade one. "10 nearest" (which means the page's current Compared-against set) is offered.
- **No members' page changes from this:** presets follow the page, and nothing is fetched unless a view of its own asks for a set average. The only change on live is Comparisons' grade lines (Grade 4+, bands) gaining 2021/22–2022/23 and becoming four-year lines: an expected kind.

### S4 — the 2021/22 grading note (R-2122-GRADING-NOTE)

- **There are no "small-entries notes" in the app** (the prompt's reference). The existing caveat style is the column's `note` (SubjectPanels' `sourceWithNote`): a `mt-1.5 block` line after the source, in the panel's "i" popover on the card, and printed as plain text under the figure in fullscreen and in "Print this graph" (which prints that same fullscreen modal). The grading note uses exactly that markup, after any column caveat, so it reaches the card, fullscreen and print by the same path. **It is not printed visibly on the card itself** (S11 moved every caveat into the "i"); Guy's call if this one should be visible on the card.
- **Wording in one place:** `GRADING_2122_NOTE` in `src/catalogue/notes.ts`. The rule logic sits beside it (`gradingNoteEligible`, `gradingNoteFor`, `specYears`); hosts hand ColumnPanels the years the view on screen draws (`PanelRender.gradingYears`), and ColumnPanels adds the note.
- **Which views:** Trends panel views on a grade or points measure whose drawn years (after the "From" year) are two or more and include 2021/22: Results and Context (Average points, Grade 4+ / A*–E, Grade bands; line, table, ranked change, change table, Results' LA/region/England area chart and table), Grade counts (spread against 2021/22, change table from 2021/22 — the change table's default "From" is the first year, so it shows by default), Comparisons (Attainment 8 / A level points per entry, a subject's points or rate; trend chart, table, trend and change maps, ranked bars, change table). **Not:** any Current view, Results' Trend map (one year), Candidates/entries anywhere (incl. Context and Comparisons on Candidates), KS2, a trend from 2022/23 on. Under views=v2 a latest-year spec drops it and a slope with a fixed first year uses its own years.
- **Change views are included** ("% change since 2021/22" is exactly the fall the note qualifies) — logged as a call; the prompt said "trend".
- **Deliberate wording change on live:** points trends (Results, Context, Comparisons' headline) already reached back to 2021/22, so they now carry the note in their "i", fullscreen and print text. No figure changes.
- **Not covered:** meeting slots ("figure" frame) draw no host source or caveats at all (the slot's CardBox has its own citation), so like every other caveat the note isn't there.
- **Test hook:** CardBox reads a new `OpenInFullscreen` context as its initial fullscreen state (nothing in the app provides it) so `src/lib/grading-note.test.ts` can server-render the real hosts' fullscreen/print output.
- Screenshots: `docs/v0.6/grade_data_round_screenshots/s4-*` (The Chase 137625 real GCSE humanities rows, Grade bands 9–7 and Average points, card "i" open and fullscreen, 1280/390, light/dark; component harness on the build CSS). Removed in S5 (they showed S4's wording); `s5-*` replace them.

### 6 Oct: Guy's decisions (after S5's first parity run stopped)

S5's first parity run (3,672 pairs, main vs branch) stopped on 136 unexpected latest-year diffs, all on Grade 4+ / A*–E and Grade bands at 100053 and 117037: (1) subjects with grades only in 2021/22–2022/23 appeared on latest-year views as "no figure" / "—" rows (Acland Turkish, King's Latin), tipping Acland's Context bar chart from columns to horizontal bars; (2) "vs last year" reached back past a missing 2023/24 (Acland Latin GCSE Grade 4+: "—" → "−12pp", 2024/25 against 2022/23); (3) Column 1 3 px wider at 100053 1280, and about 146 changed pixels in one Comparisons map marker cluster.

- **A — fix the latest-year leak:** latest-year subject lists and "vs last year" read the 2023/24-on grade rows only (as the band scale already did), so every latest-year figure and row list is main's. The map pixels and the 3 px must end identical, or be explained with evidence.
- **B — new trend rule:** 2021/22 stays on graphs and tables (grade and points trends), but trend lines and statements are measured from 2022/23: direction words, change since the first year, change tables, ranked change lists, change maps, indexed lines, fitted / slope lines, captions and summaries. Points trends change on live on purpose. Entries unaffected. One catalogue rule, replacing R-2122-GRADING-NOTE, one place for the base year, with tests. Where a chart draws a line through all years, 2021/22 stays a normal point (no new visuals).
- **C — the note:** S4's wording replaced (still one place, `src/catalogue/notes.ts`) by why trends start at 2022/23; same placement as S4, only on views whose years include 2021/22, never on latest-year views.

### S4b — trends measured from 2022/23 (R-TREND-FROM-2223), latest-year rows from 2023/24 on (R-CURRENT-GRADES-FROM-2324)

- **One place:** `src/catalogue/notes.ts` holds `TREND_BASE_PERIOD` (2022 = 2022/23), `TREND_BASE_NOTE` and which measures follow the rule (`trendBaseFor`: points, Grade 4+ / A*–E, bands, counts, Comparisons' headline; never entries, never KS2). R-2122-GRADING-NOTE is kept in the catalogue as superseded.
- **How B works:** a Trend's data carries `statementFrom` (`PanelData`, `teacher-view-panels.ts`: `withTrendBase`, `statementSpan`, `countedValues`). Everything drawn keeps every year; everything said is measured over the statement span: the sentence and direction word, the group / "vs:" clause, every year table's Change column, a fitted Trend line (fitted and drawn from 2022/23), a short span's ranked change bars, ranked change lists, change and Trend maps, the % change half's summary and collapsed figure, a slope from the span's first year. Grade counts' change table (two years) measures from 2022/23 at the earliest and its "From" menu starts there.
- **Calls made (Guy's to overturn):**
  - **Year tables:** on the card a table shows two year columns; on a trend measured from 2022/23 those are now 2022/23 and the latest (the Change column's own two ends), not 2021/22 and the latest, which would sit beside a change that isn't theirs. Fullscreen still shows every year, 2021/22 included.
  - **The % change half keeps 2021/22 drawn** (Results' area chart is a line through every year; a change table in fullscreen shows it); its changes are from 2022/23. A first version started the half at 2022/23, which turned Results' four-year area chart into three-year change bars: a new picture, so it was reverted. So both halves' "From" menus still offer 2021/22 and read "From 2021/22" by default, while their titles and sentences say "since 2022/23". The note explains the gap.
  - **Indexed lines** are entries only (R-INDEX-HEADCOUNTS), so nothing indexed changes.
  - **A slope** "from the first year" starts at 2022/23 at the earliest; one an editor fixed at 2021/22 is honoured (and carries the note).
  - **Grade counts' spread** (this year against an earlier year, a picture) may still be compared with 2021/22 if the member picks it; it carries the note then. Its default (the year before the latest) is unchanged.
  - **KS2** is outside the rule, as S4's note was.
- **How A works:** Current on Grade 4+ / bands reads each subject's values from 2023/24 on (`latestYearSeries`) and drops a peer with none (SubjectPanels hands Current views their own frame); Comparisons' Current on a rate reads its latest year from 2023/24 on; Grade counts' latest year is the latest from 2023/24 on; a latest-year spread's earlier year is from 2023/24 on. The Trends still draw those subjects' older years.
- **The map's 146 pixels and Column 1's 3 px:** both appeared only at 100053, 1280, Compared against "category", on the three grade states (bands, saved band, Grade 4+) — exactly the shots whose Context Current gained the Turkish row and redrew as horizontal bars — and nowhere else (not at 390, where the columns are tabs; not on points or Candidates). Re-run after A: those shots are pixel-identical to main (Current pairs 1,520; 0 word diffs, 0 pixel diffs). So both were layout knock-ons of the extra row (the grid re-flowed; the map re-fitted as it did), not data.
- **Found, not fixed (pre-existing):** a year table's points change that rounds to nothing prints "−0.0" (YearTable uses `formatDelta`, not `formatChange`); Context's change summary can read "X has grown the most (−0.1)" when every subject fell.

### S5 — parity and before/after (after S4b)

- **Parity, main vs branch** (harness and scripts: `docs/v0.6/audit_scripts/grade_rollup/s5/`): the members' Teacher page on captured real data for 137625 GCSE (History), 100053 GCSE, 117037 Post-16 (Mathematics), 130432 Post-16 BTEC; Candidates and all four Results measures, a saved band range (9–5 / A*–B / D*–M) and, new this run, Grade bands 9–4 at both GCSE schools; Compared against category / all / selected; 1280 and 390; both themes; every visible panel and every rail view. **4,000 pairs, 0 unexpected:**
  - IDENTICAL 1,356 (every Candidates view, every points Current view);
  - NOTE-ONLY 844 (pixels and words equal; the "i" text differs only by S2's retired "published per grade only from 2023/24" clause; no Current view gained a note);
  - EXP-YEARS 1,352 (grade Trends gaining 2021/22–2022/23, bars → lines, statements from 2022/23, the note);
  - EXP-STATEMENT 432 (points Trends, and Context / Comparisons on Grade counts' points fallback: statements now since 2022/23, the note);
  - EXP-PICKER 16 (Grade counts' "From" menu gains its chevron);
  - 44 views only on the branch: Comparisons' Trends "Chart" on grade measures, which main didn't offer under four years (R-TREND-LINE-4YR).
  - **Every latest-year view is main's:** 1,672 Current pairs, 0 word diffs, 0 pixel diffs. 7,212 Trend-table rows checked: every latest-year value equals main's. No graded Trend on the branch says "since 2021/22".
  - Harness noise, both trees alike: a Leaflet `_leaflet_pos` error on 130432's Grade 4+ map at 1280 (12 runs); one main case re-shot after its fixture failed to load.
- **Fixed on the way (fullscreen on a phone):** S4b's longer note made the stacked fullscreen modal squeeze a line chart until it spilled over its own caption. `CardBox`: below lg the modal's area never shrinks below its content (the modal scrolls). Views without the note are pixel-identical to main in fullscreen at 390 (Candidates Trend, Comparisons Ranking checked); cards are untouched.
- **Not covered by parity:** the view editor's step 1 / step 3 ticks for across-schools grade lines (they read `compareHonest`, covered by `src/lib/view-editor.test.ts`, not by pixels); fullscreen and print, except the screenshots; saved comparator sets (the harness stubs none); KS2; meeting slots.
- **Points statements that change on live** (the same figures, measured from 2022/23): the Trend sentence and direction word (Results, Context, Comparisons' headline and subject points), the "against the group / vs:" clause, every year table's Change column (card columns now 2022/23 and the latest), ranked change lists and their summary and collapsed figure, Results' area change table, Comparisons' change table, ranked bars, change map and Trend map, a fitted Trend line, and the note in the "i", fullscreen and print.
- Before/after for named schools: `ba2_main.json` / `ba2_br.json` (each tree's own functions on its own fixture); tables in the report.
- Screenshots `docs/v0.6/grade_data_round_screenshots/s5-*`: The Chase GCSE History Grade bands 9–4 Trends (card with the "i" open, and fullscreen), Comparisons Grade 4+ against the 10 nearest (card, "i" open), and Acland Burghley Grade 4+ Current table (latest year, unchanged), 1280 and 390, light and dark.

## 2026-10-06 — 0.6.3 grade counts, maps, tables

### S1 — Grade counts selection

- **The prompt and the chip are drawn by the hosts in both paths.** Before a selection, Context's and Comparisons' two panels are a frame-less PanelRender (tag, question, a dashed empty-state card), so `views=v1` and `v2` draw the same card. The chip ("Grade 9 · from your highlight") sits in each panel's controls row, above the title, on both panels; it switches to Column 1 (on a phone, the Results tab) and scrolls to its Current panel (a window event, `vicdata:show-column`).
- **Titles.** Context's Current keeps "in [group]": "Share at grade 9, by subject in Humanities". Comparisons' Current (every view: map, bars, ranking) reads "Share at grade 9, by school (the set's own name, lower case)", e.g. "(10 nearest schools)", not the prompt's shortened "(10 nearest)". The ranking-tiles view (a national/regional ranking) keeps its own title, as it is on the ranking's own measure. Trends follow through the measure ("History share at grade 9").
- **England in the answer line:** a partial England figure (a grade suppressed, or a grade the school's spread draws that England doesn't publish) is left off rather than marked "partial", so the line never sets the school against a share of a smaller total. R-ENGLAND-GRADED-ONLY.
- **The minimum (R-MIN-ENTRIES) applies on the counts selection only** (5 graded entries, MINIMUM_SUBJECT_N). Grade bands and Grade 4+ keep their existing behaviour (unchanged figures). In Comparisons' ranking a school below it is listed at the foot as "too few entries" with no rank; the map, bars and Trends leave it out (S2 draws it as a hollow dot on the map). In Context a subject below it is left out and the note says so (Context's bars have no row for a label; a "too few entries" row there would be a new layout).
- **The top bar's Grades ▾ now shows on Grade counts too** (it is the same setting); with nothing selected it reads "Pick a range". Grade counts never reads Grade bands' 7–9 preset: nothing is selected until a member picks.
- **Grade counts with no focused subject** (nothing to click) keeps the average-points fallback; R-MEASURE-FALLBACK now says so.

### S2 — Maps

- **The rank scale isn't red→amber→green.** Guy, 6 Oct 2026 (during the build): ranking needs different hues from change, which stays red-amber-green as everywhere else. Current maps use `RANK_SEQ_STOPS`, mid-pale blue → deep purple, deepest = top of the set ("Darker purple = higher Grade 4+ rate in the set"). Chosen over dark→pale green so no hue is shared with the change scale (a green dot never means both "top" and "rose"). The lightest tint is mid-tone (shows on a white card); every dot has a theme outline. Trend maps use `RAG_DIVERGING_STOPS` (dark red → pale amber at zero → deep green), one symmetric scale at the set's largest change either way.
- **One optional prop, `teacherMap`, carries the whole encoding** (src/lib/teacher-map.ts) through RankingsMap → AcademicMapView; when set it replaces that map's colour modes, toggle, key/strip, caption and outline. The Data View never passes it; no shared colour helper was edited.
- **The fullscreen map draws on the light basemap in either theme,** so there the school's ring is dark grey (white would vanish); on the card (the theme's own fill) it is white on dark, dark grey on light.
- **The maps plot the active set's schools only** (Current, and Column 1's Trend map), not every set's schools as the page's profiles cover, so "rank N of M" and the dots are the same schools. A school in the set with no figure is a hollow dot ("No published figure"; "Too few entries" below the minimum, Grade counts selection only).
- **Rank follows the measure on the map view** (Grade 4+, bands, the counts selection too), from the map's own plotted schools. It can differ from the ranking table's when a school has no location (as before, on points).
- **No subject chip, no mixed colours:** the colour now comes from the panel's own figure, which with no chip is the one headline measure for every school (Attainment 8; A-level points per entry at Post-16), not each school's dominant bucket. So the "neutral dots plus a note" path (`MapSeries.mixed`) exists but isn't hit by today's data; a BTEC-only college shows hollow at Post-16 headline.
- **Column 1's Trend map** is now each school's plain change in Results' measure over the panel's own span (statements from 2022/23), titled "Change in History Grade 4+ rate since 2022/23, by school"; its Grade band / Trends toggle is gone. Its own rows are the school's grade rows; comparators' come from Comparisons' fetch (the same request).
- **Hover wording:** a rate "Grade 4+: 76% (101 of 132)", where "of" is graded entries and "met" is recovered from the rate; points "Average points: 5.3" (or the headline's name); a change "+4pp since 2022/23", "+12 entries since 2022/23", "+0.4 points since …", "+8% since …" on the % change map of a count.
- **The card's legend** sits in the caption's corner and wraps to two or three lines; it can cover a dot at the bottom edge of the card map (the hover is still reachable on the dot's visible part).

### S3 — Post-16 safeguards

- **"*" is A* (R-ALEVEL-STAR)** in the Teacher view's four-year grade rows (own and comparators, `gradeRowsFromFacts` at KS5) and England's/areas' grade rows (`/api/teacher/subject-grade-geography`). Not only 2021/22-2022/23: DfE's 2023/24 A-level rows also write "*" (King's Worcester Maths: 20, 14, 22 A* in 2021/22-2023/24, previously 0; 8 in 2024/25). The Data View's own modern rows aren't touched (it never reads the four-year path), so its pixels can't change.
- **Area rows take the historic vocational labels too** (R-HISTORIC-GRADE-LABELS-AREA). Verified: England's 2021/22 BTEC Business rows were raw `* D M P`; now Distinction* 20.1% beside the school's.
- **The scale:** `scaleForQualification` (T Level → T Level scale) picks the focus's scale; `bandRate` also accepts a range whose scale is among the best fits for the rows' own grades (`scaleFits`), so a T Level comparator tied with the vocational scale is scored. bestScale itself is unchanged (the Data View orders grades with it). **No T Level school was checked against real data**; the tie is covered by a unit test only.
- **Context at Post-16** keeps to the focus's family (displayBucketFor) on Grade bands and a counts selection, for its subject list and each member's rows; AS and AEA stay excluded first. Threshold (A*–E) is unchanged (already A-level scale only).
- **England's denominator:** Grade counts' England ticks are now over graded rows only, the same as Grade bands' and the school's. A suppressed grade: no tick at that grade (as before); the answer line leaves England's figure off when any grade is suppressed or unpublished (logged in S1). No England figure is shown as "partial".
- **An AS / AEA focus** is compared on its own qualification's grade rows: Candidates = each school's graded entries in that qualification (map size, share and rank on the same), rates as before. **On points there is no exact-AS figure for other schools** (the profiles carry the A-level bucket only), so Comparisons shows a note instead of plotting A levels. Column 1 and Context were already exact.
- **A*–E on a BTEC, IB or T Level focus:** "A*–E applies to A levels; use a grade or band for this qualification." on Results' and Context's panels (shown on the card, not only behind the "i") and as Comparisons' note.

### S4 — Tables: years across or years down

- **One place:** YearTable draws both layouts and its own swap button, so every year table (Trend tables, change tables, Results' area table, Comparisons' tables, Grade counts' change table), card and fullscreen, both drawing paths, gets it. The button sits right-aligned in a row above the table (the panels' own controls rows are per panel, and a panel can show two tables), so every year table is one button-row taller than before.
- **Memory:** the member's swap is saved per view instance (`table:years:<view id>`) in their page settings (teacher_view_preferences.columns, the same store as band:range and the measure). The view's own layout (the editor's new "Layout: Auto / Years across / Years down" chips in the table look box) is the default; Auto opens one or two rows years down. "Auto" is a third chip so an editor can go back to the automatic default.
- **Years down** shows every year (the card too) then the n row (if the view has one) and the Change row, measured as across (from 2022/23 on graded measures, R-TREND-FROM-2223); the rank isn't repeated (the columns keep the across order). The table never widens its card: columns share the card's width (fixed layout, names truncate, full name on hover); past six columns each keeps a minimum and the table scrolls sideways inside the card.
- **Expected changes:** a single-subject Trend table, a school-vs-England area table, and any year table with one or two rows now open years down.

### S5 — Checks

- **Parity:** 1,356 main/branch view pairs on real-data fixtures (each tree's own fetchers), 5 schools × 7 states × 1280/390 × both themes, every panel and rail view: **0 unexpected**. Report table: `docs/v0.6/grades_maps_tables_report_v1.md`.
- **Accepted as a knock-on:** on a Grade counts selection at 100053, Context's vertical bar chart (a % axis) is 6 px wider than its points version was, and the grid takes 3 px from Column 1 at 1280 (words equal). The grid sizes columns by content; making it content-blind would move pixels elsewhere, so it is left.
- **Data View:** the map pixel- and marker-identical in 40 configurations (80/80 files); its data reads hash-identical on both trees.
- **No T Level school** was in the matrix; the T Level tie is unit-tested only.

## 2026-10-07 — 0.6.4

Prompt: `docs/v0.6/vicdata_0_6_round4_tables_post16_speed_claude_code_prompt_v1.md`. Report: `docs/v0.6/v064_report_v1.md`.

### A — Trend tables show their chart's years (R-TREND-TABLE-YEARS)

- **The cause was the 0.6.2 card rule, not wiring.** Reproduced on real-data fixtures (each tree's own fetchers) for The Chase 137625 GCSE History (Grade 4+, bands 9–4, 9–7, grade 9, Grade counts and a grade-9 selection) and King's Worcester 117037 A level Maths (A*–E, A*–A), both drawing paths, card and fullscreen, years across and down: every trend chart and every trend table's data run 2021/22–2024/25. Years down and fullscreen already showed all four years. **A card with years across showed only 2022/23 and the latest year** (the change's two ends, R-TREND-FROM-2223) and gave no sign that two years were left out. That reads as "the table starts later". No frame or helper applies `MODERN_GRADE_FROM` / R-CURRENT-GRADES-FROM-2324 to a Trends table (checked: grades.ts' uses are the latest-year spread's earlier year; SubjectPanels ~346/~1133 are Current's frame only).
- **If the live table really starts at 2023/24** (as the prompt says), that isn't reproduced here: please check on live which layout you were looking at. A table remembered "years down" from before 0.6.2's grade rows reached back would still show every year now.
- **The fix:** on the card, years across keeps the change's two ends and adds a "+2 more years" link under the table, whose hover names the hidden years. A click swaps that view to years down (every year), remembered like the swap button. Fullscreen and years down are unchanged (every year). The cue is in YearTable, so every year table on both paths gets it. A latest-year-only table (`yearColumns: "latest"`) shows no cue.
- **Grade counts' change table** was the one table that really did drop years: it held only the change year and the latest (2022/23, 2024/25) in every layout, fullscreen included. It now lists every graded year from 2021/22 (or the member's own "From" year, if they picked one) to the latest. Its Change is still from 2022/23, and its card columns are still the change's two ends, with the cue. Because its years now include 2021/22, its "i" carries the trend note (TREND_BASE_NOTE), as every other trend view with 2021/22 does.
- **Call:** the card keeps first-and-latest rather than all four columns. Four year columns, the name and Change don't fit a 1280 card column without truncating names; the prompt allows first and latest with a cue.

### C — Speed (measure first, then quick wins; no figure or pixel changes)

- **Live couldn't be measured in a browser.** vicdata.co.uk answers 401 (the Basic Auth gate) to Claude in Chrome too, and entering credentials is off limits. Measured instead: (1) every Teacher route body replayed from this Mac with each upstream call timed (`docs/v0.6/audit_scripts/v064_perf/perf.mts.txt`, run twice per process); (2) the page's `/api/*` waterfall per scenario in the harness (`api.mjs.txt`); (3) `explain analyze` on vicdata-production for the heaviest RPCs (read-only); (4) the built page's JS chunks. This Mac's network was slow and very variable today (a trivial Supabase call took 0.2–0.9 s), so **call counts, serial depth and bytes are the reliable figures**; wall times are indicative only. Guy's live check is listed in the report.
- **Render's plan isn't recorded in the repo** (no render.yaml). Cloudflare → Render answers the 401 in about 1 RTT, with no sign of a sleeping instance (a free instance takes 30 s+ to wake). Guy to confirm the plan in Render's dashboard.
- **What each quick win changes** (all server reads are public reference data; the membership checks still run first on every request):
  - chooser-set's default nearest 10 (`buildDefaultComparatorLists(urn, { only: "nearest" })`) no longer builds the LA set, the 16+ list and the region lookup, which it threw away. Its answer is byte-identical to main's for 7 school/phase pairs (FE college 130432 included). The Data View's default-lists route passes no option, so it is unchanged.
  - A per-instance cache (`src/lib/server-cache.ts`, one hour, errors never kept, public keys only) for England's national rows (dashboard), the LA / region / England area rows (subject-geography, subject-grade-geography), a school's LA and region, and the current periods (phases). **Call: one hour**, so an ingest shows within the hour, not instantly; the alternative is a revalidate hook on ingest (C3).
  - Parallel reads: the dashboard's neighbours and target-school reads; the geography routes' three areas, and their LA and region lookups. Not parallelised: the dashboard's comparator ranking and its subject reads, which its comment says once caused a statement timeout when run together.
  - The page: onboarding, settings and notes start with the school's data instead of after it, and are applied in the same order. The other onboarded phase's dashboard and default comparator set are prefetched into the 5-minute fetch cache 4 s after the page has drawn, at idle.
  - Lazy-loaded: the in-place editor, the comparator chooser and the map code (AcademicMapView, which still loads Leaflet lazily inside). The rules catalogue no longer ships with the page: `dataviewById` / `measureById` moved next to their data, and the page-path libraries import from there instead of `@/catalogue`.
- **Not done (needs its own parity run, or touches the Data View):** narrowing academic-schools (the largest payload, about 1 MB for 11 schools, both phases plus census pages) to the Teacher page's needs. The route is shared with the Data View. Proposed in the report (C3).
- **No index proposed:** `explain analyze` shows the heavy RPCs at 23–49 ms inside Postgres (subject families, headline, grade rollup), and the census facts query at 8 ms on `canonical_facts_current_source_entity_idx`. Each call costs 100–600 ms as the app sees it, so the time is round trips and payload, not missing indexes. `reference_data_lookup` spends about 160 ms per page on its predecessor-fallback wrapper (the inner query takes 8 ms) and is paged by offset, so each page re-runs it: a function change for the ingest repo, listed in C3, not built.

### B — Post-16 vs GCSE (audit only)

- The matrix and proposal: `docs/v0.6/post16_vs_gcse_matrix_v1.md`. No Post-16 panel changed; waiting for Guy's review.
- **Found, not fixed (a live wrong figure, out of this round's scope):** BTEC / vocational points for 2021/22–2022/23 are stored as 0, not null. Confirmed: Croydon 130432 Business Studies, four BTEC sizes; England's rows and the comparators' bucket rows too. The app draws them as 0 (`teacher-view-measures.ts:64-80` drops only nulls). Options are in the matrix (change 2): an ingest fix, and/or an interim app rule treating them as missing. Both are figure changes, so Guy decides.
- The matrix was read from code and real data; nothing was rendered for it. The published configs couldn't be read with the anon key, so only the code copy was compared.

## 2026-10-07 — 0.6.5

Prompt: `docs/v0.6/vicdata_0_6_post16_match_gcse_claude_code_prompt_v1.md`. Report: `docs/v0.6/v065_report_v1.md`.

### S1 — Grade bands opens on a default range at Post-16 (R-POST16-BAND-DEFAULT)

- **Where:** `BAND_PRESETS` itself, as GCSE's 7–9. Each Post-16 scale gets one preset marked as its default, and the Grades ▾ menu offers it plus Custom (GCSE: 4–9, 7–9, Custom).
  - The A-level A*–E scale is shared by A level, AS, Core Maths and EPQ, which default differently, so a preset can name its qualifications.
  - The scale is still the existing detector's (`scaleForQualification`); no second detector.
- **Call:** the Post-16 presets apply at Post-16 only (a `phase` on the preset). A small GCSE cohort whose grades happen to read as the IB 7–1 scale must not gain a 7–6 band at GCSE.
- **Call:** an A*–E qualification not on the list (Other General Qualification, FSMQ, AEA) and Pre-U stay custom-range only. The prompt lists no default for them.
- **Labels:** the menu's preset row and the pill use the same words the pill already used for a named scale ("A* to A", "Distinction* to Distinction"; the double and triple awards in full: "Distinction*-Distinction* to Distinction-Distinction"). That is long in the menu; the prompt's D*D*–DD shorthand isn't used anywhere in the app yet.
- **Changing focus, today and now:** `bandRangeFor` already dropped a saved range whose ends aren't on the new focus's scale and used the scale's preset. Today, at Post-16, that preset didn't exist, so the panels went to "Pick a grade range". Now they go to the new scale's default. The saved setting isn't overwritten, so going back to the old scale brings the saved range back.
- **Grade counts' selection** (0.6.3) still never reads a preset: nothing is selected until the member clicks.

### S2 — A*–E only where it means something

- **Greyed:** on a Post-16 focus whose scale isn't the A-level A*–E scale (BTEC / OCR, IB, T Level, Pre-U, or a subject with no grade rows), the top bar's Results switch greys "A*–E rate". It uses the menu's existing disabled style (45% opacity, not-allowed cursor), with *"A*–E applies to A level, AS, Core Maths and EPQ grades."* on hover. `MenuRow` gained an optional `title` for this.
- **A saved A*–E** on such a focus shows Average points for it. The saved choice (`measure:results`) isn't written, so an A-level focus brings A*–E back.
- **Call: embeds keep the 0.6.3 note.** A meeting slot or custom dashboard can pin A*–E for a subject. The page doesn't swap the measure there; the panels' note ("A*–E applies to A levels; use a grade or band for this qualification.") stays as the fallback.
- **Change 4 (Guy): Core Maths and EPQ keep A*–E.** They use A–E letters, so their A*–E rate is their pass rate.

### S3 — Comparisons and maps on the exact qualification (R-POINTS-SAME-QUAL)

- **One new route,** `/api/teacher/comparator-qualifications`: membership-gated like comparator-grades, anon key, server side. It is one RPC call to `academic_subject_qualification_headline_lookup`, filtered to the qualification in the database and to the subject in the route. It returns each school's points and entries per year for the focus's exact qualification.
  - The page asks for it during render, keyed by set + subject + qualification (as the comparator-grades ask). It goes out alongside the map profiles, which are still needed for the schools' locations, and is shared through the 5-minute fetch cache.
- **At Post-16, `comparatorSubjectSeries` comes from those rows,** for the set and the school. Comparisons (Current and Trends, every view, both paths) and Column 1's Trend map already read that one series, so they all follow. The school's own dot is its Column 1 figure (verified: Croydon A level Maths 2024/25, 24.00 in both; the A-level bucket had 21.45).
- **Entries too:** Comparisons on Candidates at Post-16 now counts the exact qualification's entries (A level without AS; one BTEC size). On the expected list (item 3).
- **The 0.6.3 AS / AEA stand-in is gone** (graded entries on Candidates, and a note on points). The exact rows carry AS points and entries for every school. A note stays only where no other school in the set has the qualification, *"No school in this set has AS level Law entries."*, or where none publishes its points: *"No school in this set publishes average points for EPQ Extended Project."* It sits in the column's existing unavailable-note slot.
- **Chips and labels:** at Post-16 there is one map chip per exact qualification (was per bucket). Its legend and label name the qualification: "Law (AS level)", "Business Studies (BTEC Extended Diploma)", "Mathematical Studies (IB Higher level)" (`exactQualificationLabel`, teacher-view-theme.ts). Column 1, the picker and the column questions keep `qualificationShortLabel`, so Column 1 doesn't change.
- **Call: a failed request shows the set's schools with no figures** (the loading flag clears), not the bucket's figures. Falling back to the bucket would show a blend under an exact label.
- **Rates are unchanged:** they already read each school's exact grade rows (R-COMPARATOR-RATE-PER-QUAL).
- **Catalogue:** R-POINTS-SAME-QUAL now covers Comparisons and maps, with its real-data test extended. The stale "Context 'All subjects' blends qualifications" known gap is removed. 0.6.4 had added no "bucket figures" wording to DV-C3-CUR-MAP or DV-C1-RES-TR-MAP, so nothing was removed there.

### S4 — The Post-16 default comparison set (R-POST16-DEFAULT-SET)

- **The rule:** GCSE's own matching (`findSurroundingSchools`: the same distance order from `school_nearest_neighbours`, the same sector, phase and gender rules, the same widen-the-net backfill and the 0.6.4 `only: "nearest"` fast path) plus one filter through its existing `extraFilterUrns` hook.
- **Call: "Post-16 provision" is read from real data.** A school qualifies if it has KS5 results (`academic_headline_lookup`, ks5) in either of the latest two published years. The existing `hasPost16Provision` is `statutory_high_age >= 16`, which every 11–16 school passes, so it can't tell a sixth form apart.
- **Call: FE colleges are not added for a school.** The prompt says "schools and colleges"; the GCSE rules match a school's own sector and phase, which keeps FE colleges out for a school. Changing that would change the set's character beyond "with a sixth form". An FE college's own default was already the nearest FE colleges, all Post-16, so it's unchanged.
- **Call: a boarding recipe** (Sevenoaks' default) keeps only its schools with KS5 results. Sevenoaks keeps all 10, of which 1 offers IB HL Maths: a data limit (IB is rare), not the rule.
- **Name (call, after parity):** the chooser names it "10 nearest with a sixth form or 16+ provision" on its hub row, Nearest screen and ±5 stepper, and a set picked there keeps that name. **The column's own pill and titles for the default keep "10 nearest schools"**, which is still true at Post-16. Why: the dashboard grid sizes its columns to their content. A longer default name in Comparisons' non-wrapping pills widened Column 3 at 1280 (Columns 1 and 2 lost 6 px each), and in some states moved Columns 1 and 2 by up to 25 px (Context's sortable table with a very long subject name forces Column 2 wide, and Columns 1 and 3 split what's left by their content). That breaks "Column 1 Post-16 identical". Truncating the pills would also change GCSE (a long saved-set name, a different split). Flip `DEFAULT_CHOICE_LABEL` at Post-16 if you'd rather see the new name on the pill and accept that layout shift.
- **The chooser on the Post-16 page** asks `default-lists`, `expand-nearest` and `boarding-quintile-list` with `post16=1`, so its first row and stepper agree with the pill's default. The Data View never sends that parameter: its calls and answers are unchanged.
- **The 0.6.4 prefetch** of the other phase posts `{ kind: "nearest" }` with that phase, so at Post-16 the server resolves the Post-16 set. No client change was needed.
- **Saved sets:** never altered. A set a member saved from "10 nearest" keeps its schools.
- **Counts** (schools in the default set with the focus qualification in 2024/25, before → after): King's A level Maths 3 → 7; The Chase A level History 5 → 10; Croydon BTEC Extended Diploma Business 4 → 4 and AS Law 0 → 0 (an FE college: unchanged); Sevenoaks IB HL Maths 1 → 1 (boarding recipe).

### S5 — The ranking headline for a school with no A levels

- **When:** a Post-16 school with no "GCE A level" entries in the latest year (IB-only, an FE college without A levels). On a national or regional ranking, Comparisons' ranking tiles and the panel's summary show *"[School] has no A-level entries. Post-16 rankings use A-level points per entry."* in the empty-state style, not empty tiles.
- **How:** carried on the ranking figures (`noFigureNote`), so both drawing paths show it: the legacy tiles body, and the series builder's `numberTiles` leaf (a new optional `note`, drawn by SeriesView). The note shows only when the school has no figure on the ranking measure.
- **The collapsed "rank chip"** has no rank to show, so it stays empty (as before); the panel's summary line carries the note.
- **Out of scope, logged as a later option:** a per-family Post-16 headline (BTEC / IB / T Level points per entry) for ranking schools without A levels.

### S6 — Per-family notes and small fixes

- **T Level, results published only for all pathways together** (Croydon 130432): a T Level focus with entries but no per-pathway grade rows and no points. Results' three columns show *"DfE publishes this college's T Level results only for all pathways together."* in place of empty charts, using the hosts' existing quiet note card (the `prompt` slot, as the 0.6.3 counts prompt). Grade counts shows it in place of "No published grades …". Candidates is unaffected (its entries are real).
- **AS in Context:** there is no separate "small group" note. The existing R-POINTS-SAME-QUAL note already says only that family's subjects are compared ("…only Other subjects are compared"). Logged and left, as the prompt allows.
- **IB Diploma total:** no change (R-IB-NONSUBJECT).
- **Speed (S4 follow-up):** the Post-16 filter makes the nearest-10 build widen past the 100 precomputed neighbours more often, because fewer of a school's nearest neighbours have a sixth form. The Chase went from 10 upstream calls (0.5–0.8 s warm) to 23 (1.3–1.6 s). Three changes; the answer is identical (5 schools checked, same schools and rolls):
  - **filterBeforeFacts:** a new, off-by-default option on `findSurroundingSchools` runs the KS5 check before each chunk's census lookup, so census facts are read only for schools that pass. Only the Post-16 path sets it, so the Data View and every other caller run exactly as before.
  - **The latest KS5 period** comes through the one-hour reference cache, read once rather than per chunk.
  - **The default nearest set** (`chooser-set`, kind nearest, both phases) is kept an hour per instance: school-level public data, keyed by school and phase only.
  - **Result:** The Chase Post-16 is 17–18 calls (1.1–1.3 s) on its first build of the hour, and from the cache after that.
- **Layout (S4 follow-up, caught by parity):** two attempts to let a long default name truncate in Comparisons' pills (a zero-width box; then a capped label) were each caught by the parity walk: one squeezed the "vs:" pill off its row beside the Grade counts chip at GCSE; both changed how the grid splits its columns when Context forces Column 2 wide. Both were reverted; `ComparisonsPanels`' pills and `Pill` are exactly main's. The fix is the naming call above.
