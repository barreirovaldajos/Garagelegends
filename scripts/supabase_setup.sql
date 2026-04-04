-- Garage Legends auth setup (run in Supabase SQL editor)
-- Creates secure profiles table with admin/player role model.

create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'player');
  END IF;
END $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), 'player')
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

insert into public.profiles (id, email, role)
select au.id, coalesce(au.email, ''), 'player'
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;

-- Read own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

-- Insert own profile only as player
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id and role = 'player');

-- Allow own email refresh but do not allow role change by users
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return old;
  end if;

  if auth.uid() = old.id and old.role is distinct from new.role then
    raise exception 'role change not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_no_role_change on public.profiles;
create trigger trg_profiles_no_role_change
before update on public.profiles
for each row execute procedure public.prevent_profile_role_escalation();

DROP POLICY IF EXISTS "profiles_update_own_email" ON public.profiles;
create policy "profiles_update_own_email"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Promote one user to admin manually after they verify and login once:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
