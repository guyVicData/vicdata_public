-- VicData 0.8 SMT Academic, Entries mode (docs/v0.8/smt_academic_claude_code_prompt_v1.md §5, §7;
-- docs/v0.8/smt_value_added_plan_v1.md §3): the size badge XS-XL for each subject's cohort
-- against England -- fifths of ALL schools entering that subject in that qualification, that
-- year. Same "precompute, don't live-aggregate" reasoning as age_band_pupil_distributions
-- (20260828120000): sizing one subject live would mean reading every school's entries in
-- England through the ingest's paged lookups on every page view.
--
-- One row per (key stage, qualification, subject, year). subject = 'All subjects' is the
-- qualification's own total (the sum of its subjects' entries in each school), so a
-- qualification or group can be sized too.
--
-- The population is the schools ENTERING it: a school with no entries contributes nothing
-- (as the age-band table leaves out schools without the band). `schools` is that count; the
-- read (src/lib/subject-entry-size.ts) gives no badge below MIN_SCHOOLS_TO_SIZE, and the UI
-- says "too few schools to size".
--
-- p20/p40/p60/p80 split that population into five equal-frequency bands (XS/S/M/L/XL), the
-- same linear-interpolation quantiles as the age-band table, read by the same
-- sizeBadgeForValue (value < p20 is XS, ..., value >= p80 is XL).
--
-- Written only by scripts/sync-subject-entry-size-fifths.ts (service role); years come from
-- the data, so a new year (Post-16 2025/26 in mid-November) is a re-run of that script.
create table public.subject_entry_size_fifths (
    id uuid primary key default gen_random_uuid(),
    ks_stage text not null check (ks_stage in ('ks4', 'ks5')),
    qualification text not null,
    subject text not null,
    period integer not null,
    schools integer not null check (schools > 0),
    p20 numeric not null,
    p40 numeric not null,
    p60 numeric not null,
    p80 numeric not null,
    computed_at timestamptz not null default now()
);

create unique index subject_entry_size_fifths_key_idx
    on public.subject_entry_size_fifths (ks_stage, qualification, subject, period);

-- The read loads one key stage's year at a time (cached an hour in the app).
create index subject_entry_size_fifths_stage_period_idx
    on public.subject_entry_size_fifths (ks_stage, period);

alter table public.subject_entry_size_fifths enable row level security;

-- Published DfE figures summarised across England: readable by anyone, as the age-band table.
create policy subject_entry_size_fifths_select_anyone on public.subject_entry_size_fifths
    for select to anon, authenticated using (true);

grant select on public.subject_entry_size_fifths to anon, authenticated;

comment on table public.subject_entry_size_fifths is
    'England fifths (p20/p40/p60/p80) of per-school entries in each subject x qualification x year (KS4, KS5), schools with no entries left out; subject ''All subjects'' is the qualification''s total. Written only by scripts/sync-subject-entry-size-fifths.ts; never computed per request. Powers SMT Academic''s Entries-mode size badge (R-SMT-ENTRIES-SIZE).';
