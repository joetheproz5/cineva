-- SEVEN account, profiles, and profile-scoped playback storage
-- Run once in Supabase Dashboard → SQL Editor → New query.

create extension if not exists pgcrypto;

create table if not exists public.seven_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  avatar_color text not null default '#d41520',
  is_kids boolean not null default false,
  pin_hash text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seven_profiles_user_name_unique
  on public.seven_profiles (user_id, lower(name));

create index if not exists seven_profiles_user_id_idx
  on public.seven_profiles (user_id);

alter table public.seven_profiles enable row level security;

drop policy if exists "Users manage their own SEVEN profiles" on public.seven_profiles;
create policy "Users manage their own SEVEN profiles"
  on public.seven_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_seven_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists seven_profiles_updated_at on public.seven_profiles;
create trigger seven_profiles_updated_at
before update on public.seven_profiles
for each row execute function public.set_seven_profiles_updated_at();

-- Existing playback rows remain valid. This column lets every new row also
-- carry a proper relational profile reference, in addition to its unique key.
alter table public.playback_progress
  add column if not exists profile_id uuid references public.seven_profiles(id) on delete cascade;

create index if not exists playback_progress_profile_id_idx
  on public.playback_progress (profile_id, last_watched_at desc);

-- The existing RLS policy on playback_progress should remain user-scoped:
--   using (auth.uid() = user_id) with check (auth.uid() = user_id)
