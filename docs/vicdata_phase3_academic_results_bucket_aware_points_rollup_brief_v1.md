# Bucket-aware academic points rollup — score every qualification, add a bucket dimension

## Where this came from

Guy was reviewing IB schools live and found Sevenoaks (URN 118952) showing no subject-category-level points at all under TYPE = IB. That round (`results_pct_change_borrowed_points`) fixed a narrow consistency bug, but its own brief named the bigger, already-known gap it deliberately left alone: `academic_subject_family_rollup`/`academic_subject_rollup` only ever compute points from `GCE A level` (KS5) / `GCSE (9-1) Full Course` (KS4) entries, via the hardcoded `_ROLLUP_SOURCES` list in `ingest/academic_aggregates.py`. Every other qualification — IB, BTEC, OCR, VRQ, T Level, Core Maths, EPQ — counts toward entries but never toward a points figure in these tables.

You then did a read-only assessment (no code written) at Guy's request, quantifying it directly against real data: 246 of 2,733 KS5 schools (9%) have zero subject-level points under any filter, and nationally only 59.8% of KS5 subject entries carry a points figure — the other 40.2% have none. You proposed three separable pieces, flagged four real decisions, and estimated the surface area (2 rollup tables with a primary-key change and 5 indexes, 2 views with window functions, 3 RPCs — one of which carries a lineage-fallback and a predicate-pushdown fix from a prior round and is the piece most likely to reintroduce a statement timeout — 7 frontend files, and a KS4 sentinel-value question). You called the RPC statement-timeout risk on a real comparator set the biggest unknown and explicitly "the failure mode that already bit us once."

Guy has now made the four decisions this needed. This brief is the full build, incorporating all four as fixed scope — not options to re-open.

## The three pieces (your own structure, confirmed)

**Piece 1 — score every qualification, not just the one per stage.** Replace `_ROLLUP_SOURCES`'s hardcoded single-qualification restriction with a per-row call through `challenge_for()` (or whatever the real current name of the qualification→points scoring path is once you're in the code — `bucket_for()`/`bucketFor()` classify, something downstream turns a classified row into a points value; use whichever function is the real current equivalent, and if the name in your assessment doesn't match what's actually in `academic_aggregates.py` today, say so in the report rather than forcing a match). Every qualification that has a real DfE-sourced challenge table (A-level, IB, BTEC/OCR, T-Level — i.e. every bucket except `other`, which deliberately has none) should now produce a real points contribution at the row level, following the exact "entries vs points, never fabricated" discipline from every prior round: VRQ and `other`-bucket qualifications still count toward entries, never toward points, because they genuinely aren't comparable on one scale.

**Piece 2 — add a bucket dimension to the rollup, as additional rows, not a re-grain.** Guy's decision: **additional per-bucket rows alongside what exists today**, not a full re-grain of the tables. The rows that exist today (today's A-level-only KS5 points, GCSE-only KS4 points) must keep their exact current primary-key values and exact current meaning — the 7 existing frontend files and their ~35 use-sites read these today and must keep working completely unchanged. New rows, keyed additionally by bucket, sit alongside them and carry the new per-bucket points figures piece 1 now makes possible. Work out the real mechanism for this once you're in the actual schema (a `bucket` column with a sentinel value like `'all'` on the existing rows was your own suggestion for keeping KS4 — which has no bucket system of its own — structurally consistent with KS5's; use it if it's still the cleanest real fit, or say plainly if the real schema wants something else). Confirm the row-count growth directly against the real table once implemented rather than trusting your earlier estimate (~329,872 → ~332,794, ~1.01×) — that was a first-pass estimate before this piece was scoped in full.

**Piece 3 — explicitly NOT this round.** The A-level scale question you flagged (today's rollup uses the classic UCAS 56/48/40/32/24/16 scale; the bucket system's own A-level table uses a different scale; migrating would move 387 of 2,148 schools by more than 2 points and shift the national average from 37.72 to 37.15) is **deferred to its own separate future round**, with its own equivalence check. Guy's decision: **keep the existing rollup's A-level scale exactly as it is today.** Do not touch it, do not harmonise it with the bucket system's A-level table, even though you're touching the same functions to add other buckets alongside it. Verify directly that real A-level figures for a handful of real schools are bit-for-bit unchanged after this round — that's your proof this piece was actually left alone, not just an assertion.

## The fourth decision: `entries_share_of_school_percent` becomes bucket-scoped

This currently partitions on `(entity, ks_stage, period)` — a whole-school percentage regardless of which TYPE/bucket is selected. Guy's decision, against the more conservative option: **once the bucket dimension exists, make this bucket-scoped** — repartition to `(entity, ks_stage, period, bucket)` (or the real equivalent once you're in the view/RPC). This is a genuine semantic change, not a bugfix: a subject's "share of school" figure will now mean "share of this bucket's entries," not "share of all the school's entries regardless of bucket." Make sure this doesn't silently change what today's A-level-only, bucket='all' rows report — those should keep meaning "share of all entries" exactly as today; only the new per-bucket rows get the new, narrower meaning. Show at least one real multi-bucket school's before/after numbers in the build report so this semantic change is visible and checkable, not just asserted.

## Required verification: the RPC statement-timeout risk, done as part of this build

Guy chose to write the full brief now rather than prototype this risk separately first — but that does not mean the risk goes unchecked. You flagged the RPC rewrite (the one carrying the lineage-fallback and predicate-pushdown fix from a prior timeout round) as the single biggest real unknown and the exact failure mode that already bit this project once. Treat verifying it against a **real 25-school comparator set** as a required, integral step of this build — not a nice-to-have, not something to wave at with a small test case. If it times out or comes close, that's a real finding to report and work through as part of this round, not a surprise to discover after shipping. Report the actual timing you observed.

## What to preserve, unchanged

- The `bucketFor()`/`bucket_for()` twin discipline — if scoring every qualification touches either file, keep both twins in sync exactly as every prior round has.
- The "entries vs points, never fabricated" discipline — `other`-bucket and VRQ entries still never get a points figure; suppress, don't borrow.
- All 7 existing frontend files' current read paths and current numbers, for every existing (non-bucket-scoped) row.
- The existing A-level scale in the pre-existing rows (piece 3, above).

## Verify

- Sevenoaks School (URN 118952), TYPE = IB, category mode: now shows a real IB-scored points figure where DfE data supports it, not a suppressed "no real figure" message.
- Spot-check TYPE = BTec, OCR, VRQ, and T Level at real schools with real entries in each — confirm each now gets a real points figure where the underlying qualification has a real challenge table, and confirm VRQ/`other` still correctly show no points figure.
- A-level figures at a handful of real schools: bit-for-bit unchanged from before this round.
- `entries_share_of_school_percent`: one real multi-bucket school, before/after, showing the bucket-scoped change plainly.
- The RPC timing test against a real 25-school comparator set, reported with actual numbers.
- Real row-count growth in both rollup tables, compared against the ~1.01× estimate.
- Confirm the existing frontend files/use-sites are unaffected for the non-bucket-scoped case (spot check a couple of the 7 files' actual rendered output, not just a code read).

## Deliverable

Build report covering: what changed in each of the 2 rollup tables, 2 views, and 3 RPCs (adjust these counts if the real schema differs once you're in it — say so if it does), what changed across the frontend files, the RPC timing result, the entries-share before/after example, the A-level-unchanged confirmation, real row-count growth, and any place you deviated from this brief's scope with your reasoning — same standard as every prior round this phase. This is a bigger build, comparable in scale to the T-Level ingest round — take the time and the commits it needs. Commit and push, both repos.
