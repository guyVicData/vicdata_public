Read docs/vicdata_phase3_academic_results_bucket_aware_points_rollup_brief_v1.md in
full and execute it. This is the full build for the gap your own read-only assessment
found and quantified: 246 of 2,733 KS5 schools (9%) have zero subject-level points under
any filter, and 40.2% of KS5 subject entries nationally carry no points figure at all --
because academic_subject_family_rollup/academic_subject_rollup only ever score GCE A level
(KS5) / GCSE (9-1) Full Course (KS4) via the hardcoded _ROLLUP_SOURCES list in
ingest/academic_aggregates.py.

Guy has made the four decisions your assessment asked for. They are fixed scope for this
round, not open questions:

1. Sequencing: build the full round now -- no separate prototype step first. BUT the RPC
   statement-timeout risk you flagged as the biggest real unknown ("the failure mode that
   already bit us once") is a REQUIRED, integral verification step inside this same build --
   test it against a real 25-school comparator set and report the actual timing. Don't ship
   without doing this.
2. A-level scale: leave it exactly as it is today (the existing rollup's UCAS 56/48/40/32/
   24/16 scale). Do NOT migrate it to the bucket system's own A-level table this round, even
   though you're touching the same functions to add other buckets. That migration (387/2,148
   schools move >2 points, national avg 37.72 -> 37.15) is explicitly deferred to its own
   future round with its own equivalence check. Verify real A-level figures at a handful of
   real schools are bit-for-bit unchanged after this round -- that's your proof, not an
   assertion.
3. entries_share_of_school_percent: make it bucket-scoped once the bucket dimension exists --
   repartition from (entity, ks_stage, period) to include bucket. This is a genuine semantic
   change (share of THIS BUCKET's entries, not share of all the school's entries) for the new
   per-bucket rows -- the existing bucket='all'-equivalent rows must keep meaning "share of
   all entries" exactly as today. Show one real multi-bucket school's before/after in the
   report.
4. Compatibility: additional per-bucket rows alongside what exists today, NOT a full re-grain.
   The rows/primary keys/meaning that exist today must be completely unchanged -- the 7
   existing frontend files and ~35 use-sites keep working exactly as they do now. New
   bucket-scoped rows sit alongside them.

Piece 1 is scoring every qualification per row (via whatever the real current points-scoring
function is once you're in academic_aggregates.py -- if it's not literally named
challenge_for(), use the real one and say so). Piece 2 is the bucket dimension added as
additional rows, using a bucket='all' sentinel on today's rows if that's still the cleanest
fit once you're in the real schema (your own earlier suggestion, for KS4 consistency too --
say plainly if the real schema wants something else). Keep the bucketFor()/bucket_for() twin
discipline in sync if either file is touched. VRQ and other-bucket entries still count toward
entries, never points -- same "entries vs points, never fabricated" discipline as every prior
round.

Verify: Sevenoaks (URN 118952) TYPE=IB now shows real IB-scored category points where DfE
data supports it. Spot-check BTec/OCR/VRQ/T-Level at real schools with real entries --
confirm real buckets get real points and VRQ/other still correctly show none. A-level
bit-for-bit unchanged at a few real schools. entries_share_of_school_percent before/after at
one real multi-bucket school. The RPC timing test on a real 25-school comparator set, real
numbers. Real row-count growth in both rollup tables vs the ~1.01x estimate (329,872 ->
332,794) -- confirm or correct it against what you actually build. Spot-check a couple of the
7 existing frontend files' actual rendered output is unaffected for the non-bucket-scoped
case, not just a code read.

This is a bigger build, comparable in scale to the T-Level ingest round -- expect 2 rollup
tables (primary-key change, indexes), 2 views, 3 RPCs (one carrying a lineage-fallback and
predicate-pushdown fix from a prior timeout round -- the highest-risk piece), and 7 frontend
files, per your own scoping; adjust these if the real schema differs once you're in it, and
say so if it does.

Build report: what changed in each of the rollup tables/views/RPCs/frontend files, the RPC
timing result, the entries-share before/after example, the A-level-unchanged confirmation,
real row-count growth, and any deviation from the brief with your reasoning. Commit and push,
both repos.
