-- Excludes consortium sixth-form-centre institutions (e.g. LaSWAP, PGW Partnership of
-- Greenacre and Walderslade) from search results -- confirmed live, 0 of 14 open
-- "Sixth form centres" institutions have any real dfe_school_census OR
-- dfe_fe_participation/_adult data of their own (their real activity lives on
-- constituent secondary schools instead), so a search hit for one currently leads to a
-- page with nothing real to show. Same reasoning/scope as schools-in-bounds/route.ts's
-- own CONSORTIUM_SIXTH_FORM_CENTRE_TYPE exclusion (typology.ts) -- deliberately just
-- this one establishment_type value, not the other five FE_ESTABLISHMENT_TYPES (real
-- FE colleges still need to be searchable), and not a permanent removal -- excluded
-- from discovery only until the group-page feature gives these a proper home.
--
-- Re-creates search_schools with the same establishment_type <> 'Sixth form centres'
-- filter added to all four CTEs (fts/fts_suffix/ilike_fallback/trgm) -- every stage
-- needs it, not just the primary FTS path, or a search could still surface one via the
-- ilike/trigram fallback stages.
create or replace function public.search_schools(p_query text, p_limit int default 20)
returns table (
    urn text,
    current_name text,
    town text,
    postcode text,
    establishment_type_group text,
    phase text,
    boarding_establishment text
)
language sql
stable
as $$
    with v as (
        select trim(p_query) as q
    ),
    fts as (
        select s.*, ts_rank_cd(s.search_vector, websearch_to_tsquery('english', v.q)) as score, 1 as stage
        from public.schools s, v
        where length(v.q) >= 2 and s.status <> 'closed' and s.establishment_type <> 'Sixth form centres'
          and s.search_vector @@ websearch_to_tsquery('english', v.q)
    ),
    fts_suffix as (
        select s.*, ts_rank_cd(s.search_vector, websearch_to_tsquery('english', v.q || ' ' || suffix)) as score, 2 as stage
        from public.schools s, v, unnest(array['school', 'college']) as suffix
        where length(v.q) >= 2 and s.status <> 'closed' and s.establishment_type <> 'Sixth form centres'
          and (select count(*) from fts) < 3
          and s.search_vector @@ websearch_to_tsquery('english', v.q || ' ' || suffix)
    ),
    ilike_fallback as (
        select s.*, 0.05::real as score, 3 as stage
        from public.schools s, v
        where length(v.q) >= 2 and s.status <> 'closed' and s.establishment_type <> 'Sixth form centres'
          and (s.current_name ilike '%' || v.q || '%' or s.postcode ilike v.q || '%')
    ),
    trgm as (
        select s.*, similarity(s.current_name, v.q) as score, 4 as stage
        from public.schools s, v
        where length(v.q) >= 2 and s.status <> 'closed' and s.establishment_type <> 'Sixth form centres'
          and s.current_name % v.q
    ),
    combined as (
        select * from fts
        union all
        select * from fts_suffix
        union all
        select * from ilike_fallback
        union all
        select * from trgm
    ),
    deduped as (
        select distinct on (combined.urn) combined.*
        from combined
        order by combined.urn, combined.stage, combined.score desc
    )
    select urn, current_name, town, postcode, establishment_type_group, phase, boarding_establishment
    from deduped
    -- ts_rank_cd ties happen often (e.g. every single-word-name-match scores identically),
    -- so ORDER BY score alone leaves same-stage results in arbitrary scan order --
    -- confirmed for real by 'Eton' burying Eton College behind four incidental
    -- substring/word matches. Trigram similarity against the raw query is a real,
    -- deterministic tiebreaker: a closer overall name match wins ties.
    order by stage, score desc, similarity(current_name, trim(p_query)) desc
    limit p_limit;
$$;

grant execute on function public.search_schools(text, int) to anon, authenticated;

comment on function public.search_schools(text, int) is
    'Public school search (membership spec §3). Stateless, no membership semantics -- callable by anon. min 2 chars enforced inside the function (also enforced client-side as the 300ms-debounce/min-2-char UX rule, but never trusted client-side only). Excludes consortium sixth-form-centre institutions (establishment_type = ''Sixth form centres'') -- see this migration''s own comment.';
