-- Teacher view, Phase 1: the real role vocabulary (design brief v2 §3).
--
-- Before this, the live constraint was:
--   role in ('head_governor','admissions','finance','director_of_studies','head_of_department')
-- which is NOT the vocabulary v2 specifies. Three of v2's five roles already existed
-- under different names, `teacher` and `smt` did not exist at all, and two live values
-- were not in v2's list -- though §3 explicitly folds both into SMT.
--
-- Migrated outright rather than kept as aliases: checked first, and there is exactly one
-- membership row in the database with role NULL, so nothing real uses the old vocabulary.
-- The folding rules from §3 are recorded here so the mapping is not lost:
--   head_governor       -> smt   ("SMT absorbs what earlier drafts called head/governors")
--   director_of_studies -> smt   (independent-school title; state schools have year-group
--                                 leaders instead, so it is a label, not a role)
--   head_of_department  -> hod
--
-- Roles and how they are granted, per §3:
--   teacher     self-selected, the DEFAULT for an individual joining alone
--   hod         admin-grantable; carries no capability difference yet (that is 1.1),
--               but exists now so no school needs re-classifying when 1.1 ships
--   smt         admin-granted only
--   finance     admin-granted only
--   admissions  admin-granted only

update public.school_memberships
   set role = case role
                when 'head_governor' then 'smt'
                when 'director_of_studies' then 'smt'
                when 'head_of_department' then 'hod'
                else role
              end
 where role in ('head_governor', 'director_of_studies', 'head_of_department');

alter table public.school_memberships
    drop constraint if exists school_memberships_role_check;

alter table public.school_memberships
    add constraint school_memberships_role_check
    check (role in ('teacher', 'hod', 'smt', 'finance', 'admissions'));

-- §3: "Teacher view is the default role, self-selected ... no role picker needed for the
-- common case." A database default means someone joining alone is a Teacher without any
-- code path having to remember to set it.
alter table public.school_memberships
    alter column role set default 'teacher';

-- Existing approved members predate the vocabulary and have no role; they are Teachers,
-- which is the baseline every admin-granted role is an upgrade from.
update public.school_memberships set role = 'teacher' where role is null;

comment on column public.school_memberships.role is
  'Teacher view role vocabulary (design brief v2 §3): teacher (default, self-selected), hod (admin-grantable, no capability difference until 1.1), smt / finance / admissions (admin-granted only, all carry more sensitive material). Role -- not the free-text job title -- is what view and dataset access gate on. Display labels are resolved per role AND sector in src/lib/roles.ts, never hardcoded at the call site.';
