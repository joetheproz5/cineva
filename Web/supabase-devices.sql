-- Run in this project's Supabase SQL Editor. Additive and safe to run again.
-- No refresh/access tokens, passwords, IP addresses or locations are stored here.
begin;
create table if not exists public.seven_device_activity (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_agent text not null default '' check (length(user_agent) <= 600),
  last_active_at timestamptz not null default now()
);
alter table public.seven_device_activity enable row level security;
revoke all on public.seven_device_activity from public, anon, authenticated;

create or replace function public.seven_device_session_status(p_user_id uuid, p_session_id uuid, p_user_agent text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auth.sessions s where s.id=p_session_id and s.user_id=p_user_id and (s.not_after is null or s.not_after>now())) then
    return jsonb_build_object('active',false);
  end if;
  if p_user_agent is not null then
    insert into public.seven_device_activity(session_id,user_id,user_agent,last_active_at)
    values(p_session_id,p_user_id,left(p_user_agent,600),now())
    on conflict(session_id) do update set user_agent=excluded.user_agent,last_active_at=excluded.last_active_at
    where seven_device_activity.last_active_at<now()-interval '1 minute' or seven_device_activity.user_agent<>excluded.user_agent;
  end if;
  return jsonb_build_object('active',true);
end; $$;

create or replace function public.seven_device_sessions_list(p_user_id uuid,p_current_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists(select 1 from auth.sessions s where s.id=p_current_session and s.user_id=p_user_id and (s.not_after is null or s.not_after>now())) then
    raise exception 'Session revoked' using errcode='28000';
  end if;
  select coalesce(jsonb_agg(row_to_json(d) order by d.is_current desc,d.last_active_at desc),'[]'::jsonb) into result
  from (select s.id,s.id=p_current_session as is_current,s.created_at,
          greatest(s.created_at,s.updated_at,s.refreshed_at,a.last_active_at) as last_active_at,
          coalesce(nullif(a.user_agent,''),s.user_agent,'') as user_agent
        from auth.sessions s left join public.seven_device_activity a on a.session_id=s.id and a.user_id=s.user_id
        where s.user_id=p_user_id and (s.not_after is null or s.not_after>now())
        order by (s.id=p_current_session) desc,greatest(s.created_at,s.updated_at,s.refreshed_at,a.last_active_at) desc limit 100) d;
  return result;
end; $$;

create or replace function public.seven_device_sessions_revoke(p_user_id uuid,p_current_session uuid,p_target_session uuid default null,p_others boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  -- Serialize account revocations; never revoke another owner's session.
  perform 1 from auth.users where id=p_user_id for update;
  if not exists(select 1 from auth.sessions s where s.id=p_current_session and s.user_id=p_user_id and (s.not_after is null or s.not_after>now())) then
    raise exception 'Session revoked' using errcode='28000';
  end if;
  if p_others then
    delete from auth.sessions where user_id=p_user_id and id<>p_current_session;
  elsif p_target_session is not null then
    delete from auth.sessions where user_id=p_user_id and id=p_target_session;
  else raise exception 'Choose a session';
  end if;
  get diagnostics affected = row_count;
  return affected;
end; $$;

-- These privileged RPCs are callable ONLY by our server, never by a browser JWT.
revoke all on function public.seven_device_session_status(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.seven_device_sessions_list(uuid,uuid) from public,anon,authenticated;
revoke all on function public.seven_device_sessions_revoke(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.seven_device_session_status(uuid,uuid,text) to service_role;
grant execute on function public.seven_device_sessions_list(uuid,uuid) to service_role;
grant execute on function public.seven_device_sessions_revoke(uuid,uuid,uuid,boolean) to service_role;

-- A revoked JWT must not keep reading account tables through direct REST/RLS.
create or replace function public.seven_session_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s where s.user_id=auth.uid()
    and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function public.seven_session_is_active() from public,anon;
grant execute on function public.seven_session_is_active() to authenticated;
do $$ declare target text; begin
  foreach target in array array['profiles','playback_progress','my_list','profile_watchlist','seven_profiles'] loop
    if to_regclass('public.'||target) is not null then
      execute format('drop policy if exists "SEVEN requires an active session" on public.%I',target);
      execute format('create policy "SEVEN requires an active session" on public.%I as restrictive for all to authenticated using ((select public.seven_session_is_active())) with check ((select public.seven_session_is_active()))',target);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
