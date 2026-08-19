-- SEVEN application data. Supabase owns auth.users; do not create or edit it directly.
-- Run this entire file once in Supabase Dashboard → SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for anyone who created an account before this script was run.
insert into public.profiles (id, email, display_name)
select id, email, raw_user_meta_data ->> 'display_name'
from auth.users
on conflict (id) do nothing;

create table if not exists public.playback_progress (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content_key text not null,
  content_type text not null check (content_type in ('movie', 'tv')),
  tmdb_id bigint not null,
  season integer,
  episode integer,
  title text not null,
  poster_path text,
  progress_seconds numeric not null default 0,
  duration_seconds numeric not null default 0,
  is_watched boolean not null default false,
  last_watched_at timestamptz not null default now(),
  primary key (user_id, content_key)
);

alter table public.profiles enable row level security;
alter table public.playback_progress enable row level security;

drop policy if exists "Users view only their profile" on public.profiles;
create policy "Users view only their profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users update only their profile" on public.profiles;
create policy "Users update only their profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users manage only their playback progress" on public.playback_progress;
create policy "Users manage only their playback progress"
on public.playback_progress for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.playback_progress to authenticated;

create index if not exists playback_progress_recent_idx
on public.playback_progress (user_id, last_watched_at desc);
