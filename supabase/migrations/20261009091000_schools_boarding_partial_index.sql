-- Follow-up to 20261009090000_nearest_schools_spatial_index.sql, found running the
-- actual backfill: recompute_nearest_neighbours_boarding_batch() timed out too, even
-- after the spatial-index fix -- but for a DIFFERENT reason than nearest_schools()
-- had. That function deliberately computes the FULL national boarding-only ranking
-- per target (no LIMIT inside the lateral -- pool='boarding' is designed to never run
-- out of depth, see that table's own migration comment), so there's no ORDER BY +
-- LIMIT for the new GiST KNN index to drive at all -- both its outer target subquery
-- and its inner per-target lateral filter `boarders_name is not null and
-- boarders_name <> 'No boarders'` against the FULL ~52,500-row table with no index
-- behind that predicate, so the inner lateral alone was effectively an O(target_count
-- x 52,500) sequential scan.
--
-- Fix: a partial B-tree index matching exactly this predicate -- boarding schools are
-- a small, stable subset (~403 of ~52,500), so this turns "find every boarding
-- school" into a cheap index scan instead of a full-table filter, for both halves of
-- that function's own query. Not folded into the spatial index above -- this is an
-- ordinary equality/inequality filter, not a nearest-neighbour search, so a plain
-- B-tree (not GiST) is the right structure.
create index schools_is_boarding_partial_idx on public.schools (urn)
    where boarders_name is not null and boarders_name <> 'No boarders' and status <> 'closed';
