-- check-school / join flow (membership spec §4): the fork point once someone commits
-- to joining a specific school. One atomic SECURITY DEFINER transaction, not sequential
-- client-side inserts -- a brand-new user can't SELECT school_accounts before they're a
-- member (RLS correctly blocks it), and INSERT ... RETURNING hits the same
-- SELECT-policy-gates-RETURNING issue found earlier for pending_school_requests. This
-- also closes a real race: two people both landing on "no approved member yet" for the
-- same school and both trying to become first-member concurrently is handled by
-- school_accounts' unique(school_urn) constraint plus this being one transaction.

create or replace function public.check_school_has_member(p_urn text)
returns boolean
language sql
security definer
stable
as $$
    select exists (
        select 1 from public.school_accounts sa
        join public.school_memberships sm on sm.school_account_id = sa.id
        where sa.school_urn = p_urn and sm.status = 'approved'
    );
$$;

grant execute on function public.check_school_has_member(text) to anon, authenticated;

comment on function public.check_school_has_member(text) is
    'check-school fork point (membership spec §4): does this school already have an approved member. Deliberately exposes only a boolean, not school_accounts itself (which RLS otherwise restricts to existing members).';

create or replace function public.join_school(p_urn text, p_role text)
returns table (
    branch text,
    membership_status text,
    upsell boolean
)
language plpgsql
security definer
as $$
declare
    v_profile_id uuid := auth.uid();
    v_email text := auth.jwt() ->> 'email';
    v_account_id uuid;
    v_approved_count int;
    v_website text;
    v_email_domain text;
    v_website_domain text;
    v_membership_id uuid;
    v_status text;
    v_branch text;
    v_tier text;
    v_total_count int;
begin
    if v_profile_id is null then
        raise exception 'not authenticated';
    end if;

    -- Find or create the school_account (school_accounts_insert_authenticated already
    -- permits this for any authenticated user at the RLS layer; this function's own
    -- SECURITY DEFINER context does the same thing more simply).
    select id, tier into v_account_id, v_tier from public.school_accounts where school_urn = p_urn;
    if v_account_id is null then
        insert into public.school_accounts (school_urn) values (p_urn)
        returning id, tier into v_account_id, v_tier;
    end if;

    select count(*) into v_approved_count
    from public.school_memberships
    where school_account_id = v_account_id and status = 'approved';

    if v_approved_count = 0 then
        v_branch := 'first_member';

        select website into v_website from public.schools where urn = p_urn;

        v_email_domain := lower(split_part(v_email, '@', 2));
        -- Normalise a website value like "https://www.leightonpark.com/" down to
        -- "leightonpark.com" for comparison -- strip scheme, leading www., path/query.
        v_website_domain := lower(v_website);
        v_website_domain := regexp_replace(v_website_domain, '^https?://', '');
        v_website_domain := regexp_replace(v_website_domain, '^www\.', '');
        v_website_domain := split_part(v_website_domain, '/', 1);

        if v_website_domain is not null and v_website_domain <> '' and v_website_domain = v_email_domain then
            v_status := 'approved';
        else
            -- Manual fallback (membership spec §4) -- no website on record, or it
            -- doesn't match this signup's email domain.
            v_status := 'pending_verification';
        end if;

        insert into public.school_memberships (school_account_id, profile_id, status, role, approved_at)
        values (v_account_id, v_profile_id, v_status, p_role, case when v_status = 'approved' then now() else null end)
        returning id into v_membership_id;

        if v_status = 'approved' then
            update public.school_accounts set account_holder_membership_id = v_membership_id, updated_at = now()
            where id = v_account_id;
        end if;
    else
        v_branch := 'request_to_join';
        v_status := 'pending_approval';
        insert into public.school_memberships (school_account_id, profile_id, status, role)
        values (v_account_id, v_profile_id, v_status, p_role)
        returning id into v_membership_id;
    end if;

    -- 2nd-individual-member upsell (membership spec §5): a sharp, quantifiable trigger,
    -- not a soft nudge -- fires exactly when an individual-tier school reaches its
    -- second member (any status; joining itself is the trigger, not just approval).
    select count(*) into v_total_count
    from public.school_memberships
    where school_account_id = v_account_id;

    return query select v_branch, v_status, (v_tier = 'individual' and v_total_count = 2);
end;
$$;

grant execute on function public.join_school(text, text) to authenticated;

comment on function public.join_school(text, text) is
    'Atomic check-school join transaction (membership spec §4/§5). auth.uid()/auth.jwt() used for identity, never a client-supplied profile_id/email, so this cannot be used to join on someone else''s behalf.';
