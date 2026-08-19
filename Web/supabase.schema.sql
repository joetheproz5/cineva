create table if not exists public.playback_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
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

alter table public.playback_progress enable row level security;

create policy "Users manage only their playback progress"
on public.playback_progress for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists playback_progress_recent_idx
on public.playback_progress (user_id, last_watched_at desc);
