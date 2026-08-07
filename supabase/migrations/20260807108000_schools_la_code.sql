-- Available from vicdata's school_entities_export as of vicdata@7ae90cd. Joins to
-- la_gss_crosswalk for market share's ons_births lookup.
alter table public.schools
    add column la_code text;

create index schools_la_code_idx on public.schools (la_code);
