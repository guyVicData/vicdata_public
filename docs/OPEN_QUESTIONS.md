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
