-- Account holder handoff (membership spec §5): "deliberate handoff, always -- initiated
-- by the current holder specifically, who chooses a recipient... the recipient
-- confirms/accepts, transfer completes." A recipient isn't account holder yet, so they
-- can't pass the existing school_accounts_update_account_holder RLS check to accept --
-- needs its own SECURITY DEFINER RPC, same reasoning as join_school.
alter table public.school_accounts
    add column pending_account_holder_membership_id uuid references public.school_memberships (id);

create or replace function public.initiate_account_holder_handoff(
    p_school_account_id uuid,
    p_recipient_membership_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
    if not public.is_account_holder_of_school_account(p_school_account_id) then
        raise exception 'only the current account holder can initiate a handoff';
    end if;
    if not exists (
        select 1 from public.school_memberships
        where id = p_recipient_membership_id
          and school_account_id = p_school_account_id
          and status = 'approved'
    ) then
        raise exception 'recipient must be an approved member of the same school';
    end if;
    update public.school_accounts
    set pending_account_holder_membership_id = p_recipient_membership_id, updated_at = now()
    where id = p_school_account_id;
end;
$$;

create or replace function public.accept_account_holder_handoff(p_school_account_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    v_pending_id uuid;
    v_recipient_profile_id uuid;
begin
    select pending_account_holder_membership_id into v_pending_id
    from public.school_accounts where id = p_school_account_id;

    if v_pending_id is null then
        raise exception 'no pending handoff for this school';
    end if;

    select profile_id into v_recipient_profile_id
    from public.school_memberships where id = v_pending_id;

    if v_recipient_profile_id is distinct from auth.uid() then
        raise exception 'only the nominated recipient can accept this handoff';
    end if;

    update public.school_accounts
    set account_holder_membership_id = v_pending_id,
        pending_account_holder_membership_id = null,
        updated_at = now()
    where id = p_school_account_id;
end;
$$;

grant execute on function public.initiate_account_holder_handoff(uuid, uuid) to authenticated;
grant execute on function public.accept_account_holder_handoff(uuid) to authenticated;

-- Admin creation is the account holder's job specifically (membership spec §5: "The
-- account holder can create other admins"), not something an existing admin can also
-- do -- tightened here as a trigger rather than left to the broader
-- school_memberships_update_admin_or_holder RLS policy (which correctly still covers
-- role/status/removal for both admin and account holder, just not is_admin itself).
create or replace function public.enforce_is_admin_change_by_account_holder_only()
returns trigger
language plpgsql
as $$
begin
    if new.is_admin is distinct from old.is_admin
       and not public.is_account_holder_of_school_account(new.school_account_id) then
        raise exception 'only the account holder can change admin status';
    end if;
    return new;
end;
$$;

create trigger school_memberships_is_admin_guard
    before update on public.school_memberships
    for each row execute function public.enforce_is_admin_change_by_account_holder_only();
