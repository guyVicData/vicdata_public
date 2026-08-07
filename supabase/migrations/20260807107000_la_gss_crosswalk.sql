-- LA-code -> GSS-code crosswalk for market share (rolls spec §3: "DfE census entries ÷
-- ONS birth pool"). ons_births (via vicdata's reference_data_lookup) is keyed by ONS
-- GSS code (e.g. E06000038); GIAS's own school_entities.la_code (synced into this
-- project's schools table) is the old 3-digit DfE/LEA number (e.g. 870) -- a genuinely
-- different coding system, confirmed by fetching GIAS's live file directly (§ see
-- vicdata@7ae90cd).
--
-- A stable, small (~182-row), officially-published government reference table -- seeded
-- once here, not re-derived per query. Source: GIAS's own official LA codes page
-- (get-information-schools.service.gov.uk/Guidance/LaNameCodes), fetched and parsed
-- directly from the raw HTML table (not summarised/sampled, not fabricated from memory
-- -- every row traced to that page). Excludes ~32 "Pre LGR" (pre-Local Government
-- Reorganisation) historical entries, which the source itself marks with a placeholder
-- GSS code (X999999) rather than a real one.
create table public.la_gss_crosswalk (
    dfe_code text primary key,
    la_name text not null,
    gss_code text not null
);

alter table public.la_gss_crosswalk enable row level security;

create policy la_gss_crosswalk_select_anyone on public.la_gss_crosswalk
    for select using (true);

comment on table public.la_gss_crosswalk is 'DfE 3-digit LA code -> ONS GSS code. Static reference data, sourced from GIAS''s official LA codes page, seeded once. Verified against Leighton Park (Reading, 870 -> E06000038) and Woldingham/Charterhouse (Surrey, 936 -> E10000030).';
