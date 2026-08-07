-- Comparator Set's "size band" attribute filter (rolls spec §6). Available from
-- vicdata's school_entities_export as of vicdata@6b99fc3.
alter table public.schools
    add column number_of_pupils integer;

create index schools_number_of_pupils_idx on public.schools (number_of_pupils);
