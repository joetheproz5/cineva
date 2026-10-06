-- Preserve existing Watchlist entries under the account's original Main profile.
alter table public.account_watchlist rename to profile_watchlist;
alter table public.profile_watchlist
  add column profile_id text not null default 'main'
  check (char_length(profile_id) between 1 and 80);

alter table public.profile_watchlist drop constraint account_watchlist_pkey;
alter table public.profile_watchlist
  add constraint profile_watchlist_pkey
  primary key (user_id, profile_id, content_type, tmdb_id);

drop policy if exists "Users manage their own account Watchlist" on public.profile_watchlist;
drop policy if exists "Only permanent accounts use account Watchlist" on public.profile_watchlist;
create policy "Users manage their own profile Watchlist"
on public.profile_watchlist for all to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "Only permanent accounts use profile Watchlist"
on public.profile_watchlist as restrictive for all to authenticated
using (((select auth.jwt()) ->> 'is_anonymous')::boolean is false)
with check (((select auth.jwt()) ->> 'is_anonymous')::boolean is false);

drop index if exists public.account_watchlist_recent_idx;
create index profile_watchlist_recent_idx
on public.profile_watchlist (user_id, profile_id, added_at desc);

revoke all on public.profile_watchlist from public, anon;
grant select, insert, update, delete on public.profile_watchlist to authenticated;
