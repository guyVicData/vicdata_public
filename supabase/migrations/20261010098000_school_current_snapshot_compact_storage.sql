-- Large-set design v1, item 2 -- real regression found live verifying against
-- production WITH REAL DATA (2026-10-10, after scripts/recompute-census-derived.ts's
-- Part 3 finished populating school_current_snapshot for real): `region_nation_set()`
-- at Nation scale (~49,425 schools) hit a hard Postgres statement timeout
-- (`57014 canceling statement due to statement timeout`) via a real `supabase.rpc()`
-- call -- Region (South East, 7,400 schools) completed in ~1.8s, so this wasn't a
-- payload-size problem (already fixed by the positional-array migration) but a
-- QUERY-PLAN one: the previous migration's LATERAL `jsonb_each(...)` per row (twice
-- per row -- once for the current breakdown, once for the anchor) forces a
-- correlated nested-loop unnest across all ~49,000 rows, which apparently doesn't
-- scale the way a straight column read would.
--
-- Fix: STORE `age_gender_counts`/`anchor_age_gender_counts` in the ALREADY-COMPACT
-- array-of-triples wire shape (`[[age,male,female],...]`) directly on
-- `school_current_snapshot`, instead of the object-keyed shape the original
-- migration used -- eliminating the need for ANY per-row transform in
-- `region_nation_set()` at all (see the next migration, which simplifies that
-- function back to a plain column read). The object-keyed shape's only real
-- justification (this table's own original migration comment: "good for a future SQL
-- consumer summing via jsonb_each()") never materialised -- `region_nation_rank()`
-- reads the denormalised `total_roll`/`female_total` columns instead, precisely to
-- avoid needing jsonb_each() at ranking-scale too. One-time bulk transform of the
-- already-written rows (a plain UPDATE, not a per-request cost) -- future rows are
-- written directly in this shape by `scripts/recompute-census-derived.ts` (updated
-- alongside this migration).
update public.school_current_snapshot
set age_gender_counts = coalesce((
        select jsonb_agg(jsonb_build_array((kv.key)::int, (kv.value->>'male')::int, (kv.value->>'female')::int))
        from jsonb_each(age_gender_counts) as kv
    ), '[]'::jsonb),
    anchor_age_gender_counts = case when anchor_age_gender_counts is null then null else coalesce((
        select jsonb_agg(jsonb_build_array((kv.key)::int, (kv.value->>'male')::int, (kv.value->>'female')::int))
        from jsonb_each(anchor_age_gender_counts) as kv
    ), '[]'::jsonb) end;

comment on column public.school_current_snapshot.age_gender_counts is 'Compact array-of-triples wire shape: [[age, male, female], ...] (NOT an object keyed by age -- changed 2026-10-10 after a real Nation-scale statement-timeout regression, see this migration''s own comment).';
comment on column public.school_current_snapshot.anchor_age_gender_counts is 'Same compact shape as age_gender_counts, or null when no real anchor-period data exists for this school.';
