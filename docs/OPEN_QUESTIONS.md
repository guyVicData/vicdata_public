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

## Template for future entries

**Decision**: ...
**Why**: ...
**Default proceeding with**: ...
