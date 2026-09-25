-- Teacher view accordion round Part 3: personal comparator-set cap raised from 3 to 8.
--
-- Agreed product decision ("raise it (e.g. 5-10)"): building comparator sets is now a
-- core Teacher view flow (the "Compared against" chooser), not only the Data View's
-- builder, so members need more headroom. Same function, same trigger, only the number
-- changes -- it still covers every personal comparator set, whichever product made it.
-- The app shows the same figure from PERSONAL_COMPARATOR_CAP (teacher-view-saved-sets.ts).
create or replace function public.enforce_personal_comparator_cap()
returns trigger
language plpgsql
as $$
declare
    existing_count integer;
begin
    if new.set_type = 'comparator' and new.owner_membership_id is not null then
        select count(*) into existing_count
        from public.saved_sets
        where owner_membership_id = new.owner_membership_id
          and set_type = 'comparator'
          and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
        if existing_count >= 8 then
            raise exception 'personal comparator set cap (8) reached for this member';
        end if;
    end if;
    return new;
end;
$$;
