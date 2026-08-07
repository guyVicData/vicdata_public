-- profiles: extends auth.users with app-level fields. Standard Supabase pattern --
-- auto-created via trigger on auth.users insert, so every signed-up user has a row
-- without the app needing a separate "create profile" step.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    full_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
    for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
    for update using (auth.uid() = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email);
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
