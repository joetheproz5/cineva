-- SEVEN My List. Run once in Supabase Dashboard → SQL Editor.
-- Each saved title belongs to exactly one signed-in user and SEVEN profile.

create table if not exists public.my_list (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  profile_id text not null default 'main' check (char_length(profile_id) between 1 and 80),
  content_type text not null check (content_type in ('movie', 'tv')),
  tmdb_id bigint not null check (tmdb_id > 0),
  title text not null,
  poster_path text,
  backdrop_path text,
  release_date date,
  vote_average numeric,
  added_at timestamptz not null default now(),
  primary key (user_id, profile_id, content_type, tmdb_id)
);

alter table public.my_list enable row level security;

drop policy if exists "Users manage their own My List" on public.my_list;
create policy "Users manage their own My List"
on public.my_list for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.my_list to authenticated;

create index if not exists my_list_recent_idx
on public.my_list (user_id, profile_id, added_at desc);
