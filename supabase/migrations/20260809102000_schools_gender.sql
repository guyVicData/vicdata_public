-- Typology tags (chart palette doc): Gender (Boys/Girls/Co-ed) tag, display + matching
-- filter. Available from vicdata's school_entities_export as of vicdata@0844112.
alter table public.schools
    add column gender text;

create index schools_gender_idx on public.schools (gender);
