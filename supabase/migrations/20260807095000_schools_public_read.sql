-- Search is stateless and public (membership spec §4: "Someone can search and view any
-- school's page without any account action at all"). Only the sync job (service_role,
-- bypasses RLS) ever writes to this table.
create policy schools_select_anyone on public.schools
    for select using (true);
