-- Aggregate-only SEVEN operations dashboard.
-- Run in Supabase Dashboard -> SQL Editor. Safe to run again for updates.
-- No account identifiers, emails, titles, or playback records are copied into analytics.

create table if not exists public.seven_admin_daily_metrics (
  metric_day date primary key,
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  download_clicks bigint not null default 0 check (download_clicks >= 0),
  watch_seconds numeric not null default 0 check (watch_seconds >= 0),
  mac_clicks bigint not null default 0 check (mac_clicks >= 0),
  ios_clicks bigint not null default 0 check (ios_clicks >= 0),
  windows_clicks bigint not null default 0 check (windows_clicks >= 0),
  android_clicks bigint not null default 0 check (android_clicks >= 0)
);

-- Safe to re-run after this dashboard is already installed.
alter table public.seven_admin_daily_metrics
  add column if not exists watch_seconds numeric not null default 0 check (watch_seconds >= 0);

create table if not exists public.seven_admin_visitor_hashes (
  visitor_day date not null,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  primary key (visitor_day, visitor_hash)
);

-- Random idempotency keys only: no user, profile, title, or account identifier.
create table if not exists public.seven_admin_watch_events (
  event_id uuid primary key,
  created_at timestamptz not null default pg_catalog.now()
);

-- One privacy-safe snapshot imports legacy saved positions as an estimate.
-- Playback progress stores each title's latest position, not historical sessions.
create table if not exists public.seven_admin_watch_baseline (
  singleton boolean primary key default true check (singleton),
  legacy_seconds numeric not null default 0 check (legacy_seconds >= 0),
  captured_at timestamptz not null default pg_catalog.now()
);

alter table public.seven_admin_daily_metrics enable row level security;
alter table public.seven_admin_visitor_hashes enable row level security;
alter table public.seven_admin_watch_events enable row level security;
alter table public.seven_admin_watch_baseline enable row level security;
revoke all on table public.seven_admin_daily_metrics from public, anon, authenticated, service_role;
revoke all on table public.seven_admin_visitor_hashes from public, anon, authenticated, service_role;
revoke all on table public.seven_admin_watch_events from public, anon, authenticated, service_role;
revoke all on table public.seven_admin_watch_baseline from public, anon, authenticated, service_role;

-- Import existing all-account progress exactly once, then start the live counter
-- from zero so saved positions and newly measured playback are not double-counted.
do $$
declare
  v_inserted integer;
begin
  insert into public.seven_admin_watch_baseline (singleton, legacy_seconds)
  select true, coalesce(pg_catalog.sum(
    case
      when duration_seconds > 0 then least(greatest(progress_seconds, 0), duration_seconds)
      else greatest(progress_seconds, 0)
    end
  ), 0)
  from public.playback_progress
  where true
  on conflict (singleton) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.seven_admin_daily_metrics set watch_seconds = 0 where watch_seconds <> 0;
  end if;
end;
$$;

create or replace function public.seven_admin_record_visit(p_fingerprint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (pg_catalog.now() at time zone 'utc')::date;
  v_inserted integer;
begin
  if p_fingerprint !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  -- The random browser token rotates daily; keep only short-lived HMACs for deduplication.
  delete from public.seven_admin_visitor_hashes
  where visitor_day < v_day - 30;

  insert into public.seven_admin_visitor_hashes (visitor_day, visitor_hash)
  values (v_day, p_fingerprint)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  insert into public.seven_admin_daily_metrics (metric_day, unique_visitors)
  values (v_day, 1)
  on conflict (metric_day) do update
    set unique_visitors = public.seven_admin_daily_metrics.unique_visitors + 1;
  return true;
end;
$$;

create or replace function public.seven_admin_record_download(p_platform text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (pg_catalog.now() at time zone 'utc')::date;
begin
  if p_platform not in ('mac', 'ios', 'windows', 'android') then
    return false;
  end if;

  insert into public.seven_admin_daily_metrics (
    metric_day, download_clicks, mac_clicks, ios_clicks, windows_clicks, android_clicks
  )
  values (
    v_day,
    1,
    case when p_platform = 'mac' then 1 else 0 end,
    case when p_platform = 'ios' then 1 else 0 end,
    case when p_platform = 'windows' then 1 else 0 end,
    case when p_platform = 'android' then 1 else 0 end
  )
  on conflict (metric_day) do update set
    download_clicks = public.seven_admin_daily_metrics.download_clicks + 1,
    mac_clicks = public.seven_admin_daily_metrics.mac_clicks + case when p_platform = 'mac' then 1 else 0 end,
    ios_clicks = public.seven_admin_daily_metrics.ios_clicks + case when p_platform = 'ios' then 1 else 0 end,
    windows_clicks = public.seven_admin_daily_metrics.windows_clicks + case when p_platform = 'windows' then 1 else 0 end,
    android_clicks = public.seven_admin_daily_metrics.android_clicks + case when p_platform = 'android' then 1 else 0 end;
  return true;
end;
$$;

create or replace function public.seven_admin_record_watch_time(p_event_id uuid, p_seconds numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (pg_catalog.now() at time zone 'utc')::date;
  v_inserted integer;
begin
  -- Only an authenticated member's player can report playback time.
  if auth.uid() is null or p_event_id is null or p_seconds is null or p_seconds < 0.5 or p_seconds > 300 then
    return false;
  end if;

  delete from public.seven_admin_watch_events
  where created_at < pg_catalog.now() - interval '30 days';

  insert into public.seven_admin_watch_events (event_id)
  values (p_event_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  insert into public.seven_admin_daily_metrics (metric_day, watch_seconds)
  values (v_day, p_seconds)
  on conflict (metric_day) do update
    set watch_seconds = public.seven_admin_daily_metrics.watch_seconds + excluded.watch_seconds;
  return true;
end;
$$;

create or replace function public.seven_admin_get_stats(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select
      least(greatest(coalesce(p_days, 30), 7), 30) as days,
      (pg_catalog.now() at time zone 'utc')::date as today
  ),
  days as (
    select (settings.today - (settings.days - 1) + series.day_offset)::date as metric_day
    from settings
    cross join pg_catalog.generate_series(0, settings.days - 1) as series(day_offset)
  )
  select pg_catalog.jsonb_build_object(
    'generatedAt', pg_catalog.now(),
    'days', settings.days,
    'totals', pg_catalog.jsonb_build_object(
      'accounts', (select pg_catalog.count(*) from auth.users),
      'verifiedAccounts', (select pg_catalog.count(*) from auth.users where email_confirmed_at is not null),
      'allTimeVisitors', (select coalesce(pg_catalog.sum(unique_visitors), 0) from public.seven_admin_daily_metrics),
      'allTimeDownloadClicks', (select coalesce(pg_catalog.sum(download_clicks), 0) from public.seven_admin_daily_metrics),
      'hoursWatched', (
        select pg_catalog.round((
          coalesce((select legacy_seconds from public.seven_admin_watch_baseline where singleton), 0)
          + coalesce(pg_catalog.sum(watch_seconds), 0)
        ) / 3600.0, 1)
        from public.seven_admin_daily_metrics
      ),
      'visitorsToday', coalesce((select unique_visitors from public.seven_admin_daily_metrics where metric_day = settings.today), 0),
      'downloadsToday', coalesce((select download_clicks from public.seven_admin_daily_metrics where metric_day = settings.today), 0)
    ),
    'daily', (
      select coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'date', days.metric_day,
            'visitors', coalesce(metrics.unique_visitors, 0),
            'downloads', coalesce(metrics.download_clicks, 0),
            'signups', signup_counts.signups,
            'macClicks', coalesce(metrics.mac_clicks, 0),
            'iosClicks', coalesce(metrics.ios_clicks, 0),
            'windowsClicks', coalesce(metrics.windows_clicks, 0),
            'androidClicks', coalesce(metrics.android_clicks, 0)
          ) order by days.metric_day
        ),
        '[]'::jsonb
      )
      from days
      left join public.seven_admin_daily_metrics as metrics on metrics.metric_day = days.metric_day
      cross join lateral (
        select pg_catalog.count(*)::bigint as signups
        from auth.users as users
        where (users.created_at at time zone 'utc')::date = days.metric_day
      ) as signup_counts
    )
  )
  from settings;
$$;

revoke all on function public.seven_admin_record_visit(text) from public, anon, authenticated;
revoke all on function public.seven_admin_record_download(text) from public, anon, authenticated;
revoke all on function public.seven_admin_record_watch_time(uuid, numeric) from public, anon, authenticated, service_role;
revoke all on function public.seven_admin_get_stats(integer) from public, anon, authenticated;
grant execute on function public.seven_admin_record_visit(text) to service_role;
grant execute on function public.seven_admin_record_download(text) to service_role;
grant execute on function public.seven_admin_record_watch_time(uuid, numeric) to authenticated;
grant execute on function public.seven_admin_get_stats(integer) to service_role;
