-- Per-profile SEVEN Watchlist. Favourites remain in public.my_list.

create table if not exists public.profile_watchlist (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  profile_id text not null default 'main' check (char_length(profile_id) between 1 and 80),
  content_type text not null check (content_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  title text not null default 'Untitled' check (char_length(title) between 1 and 500),
  poster_path text,
  backdrop_path text,
  release_date date,
  vote_average numeric check (vote_average is null or vote_average between 0 and 10),
  added_at timestamptz not null default now(),
  primary key (user_id, profile_id, content_type, tmdb_id)
);

alter table public.profile_watchlist enable row level security;

drop policy if exists "Users manage their own profile Watchlist" on public.profile_watchlist;
create policy "Users manage their own profile Watchlist"
on public.profile_watchlist for all to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- Supabase anonymous-auth users also assume the authenticated role. Require a
-- non-anonymous JWT for every operation, independently of permissive policies.
drop policy if exists "Only permanent accounts use profile Watchlist" on public.profile_watchlist;
create policy "Only permanent accounts use profile Watchlist"
on public.profile_watchlist as restrictive for all to authenticated
using (((select auth.jwt()) ->> 'is_anonymous')::boolean is false)
with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is false);

revoke all on public.profile_watchlist from public, anon;
grant select, insert, update, delete on public.profile_watchlist to authenticated;

create index if not exists profile_watchlist_recent_idx
on public.profile_watchlist (user_id, profile_id, added_at desc);
