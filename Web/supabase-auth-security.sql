-- Apply before publishing the hardened auth endpoints. No email-confirmation settings change.
begin;
create table if not exists public.seven_auth_rate_buckets (
  bucket text primary key, window_start bigint not null, attempts integer not null,
  expires_at timestamptz not null
);
alter table public.seven_auth_rate_buckets enable row level security;
revoke all on public.seven_auth_rate_buckets from public,anon,authenticated;
create index if not exists seven_auth_rate_expiry on public.seven_auth_rate_buckets(expires_at);

create or replace function public.seven_auth_rate_limit(p_buckets jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; count_now integer; window_now bigint; epoch_now bigint:=extract(epoch from clock_timestamp())::bigint;
  allowed boolean:=true; wait_seconds integer:=0; size_seconds integer; max_attempts integer;
begin
  if jsonb_typeof(p_buckets)<>'array' or jsonb_array_length(p_buckets) not between 1 and 4 then raise exception 'Invalid buckets.'; end if;
  delete from public.seven_auth_rate_buckets where bucket in (select bucket from public.seven_auth_rate_buckets where expires_at<now() limit 100);
  for b in select value from jsonb_array_elements(p_buckets) order by value->>'key' loop
    size_seconds:=(b->>'seconds')::integer; max_attempts:=(b->>'limit')::integer;
    if (b->>'key') !~ '^[a-f0-9]{64}$' or size_seconds not between 60 and 86400 or max_attempts not between 1 and 1000 then raise exception 'Invalid bucket.'; end if;
    window_now:=(epoch_now/size_seconds)*size_seconds;
    insert into public.seven_auth_rate_buckets(bucket,window_start,attempts,expires_at)
    values(b->>'key',window_now,1,to_timestamp(window_now+size_seconds))
    on conflict(bucket) do update set window_start=excluded.window_start,
      attempts=case when seven_auth_rate_buckets.window_start=excluded.window_start then least(seven_auth_rate_buckets.attempts+1,max_attempts+1) else 1 end,
      expires_at=excluded.expires_at returning attempts into count_now;
    if count_now>max_attempts then allowed:=false; wait_seconds:=greatest(wait_seconds,window_now+size_seconds-epoch_now); end if;
  end loop;
  return jsonb_build_object('allowed',allowed,'retry_after',wait_seconds);
end $$;
revoke all on function public.seven_auth_rate_limit(jsonb) from public,anon,authenticated;
grant execute on function public.seven_auth_rate_limit(jsonb) to service_role;

-- Enforce MFA on direct database access too, not just by hiding the login UI.
create or replace function public.seven_auth_assurance_ok()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and
    (auth.jwt()->>'aal'='aal2' or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'));
$$;
revoke all on function public.seven_auth_assurance_ok() from public,anon;
grant execute on function public.seven_auth_assurance_ok() to authenticated;
do $$ declare target text; begin
  foreach target in array array['profiles','playback_progress','my_list','profile_watchlist','seven_profiles'] loop
    if to_regclass('public.'||target) is not null then
      execute format('drop policy if exists "SEVEN requires MFA when enabled" on public.%I',target);
      execute format('create policy "SEVEN requires MFA when enabled" on public.%I as restrictive for all to authenticated using ((select public.seven_auth_assurance_ok())) with check ((select public.seven_auth_assurance_ok()))',target);
    end if;
  end loop;
end $$;

-- Security-definer RPCs bypass RLS, so wrap the six own-account operations as well.
-- Keep their existing implementation private; rerunning this migration is safe.
do $$ declare item record; original regprocedure; begin
  for item in select * from (values
    ('seven_settings_sync','bigint,jsonb','p_expected_revision bigint default null,p_account jsonb default null','p_expected_revision,p_account','jsonb'),
    ('seven_parent_access_enabled','','','','boolean'),
    ('seven_parent_access_verify','text','code text','code','boolean'),
    ('seven_parent_access_set','text,text','current_code text,new_code text','current_code,new_code','boolean'),
    ('seven_parent_access_clear','text','current_code text','current_code','boolean'),
    ('seven_admin_record_watch_time','uuid,numeric','p_event_id uuid,p_seconds numeric','p_event_id,p_seconds','boolean')
  ) as specs(name,signature,args,pass,result) loop
    original:=to_regprocedure('public.'||item.name||'('||item.signature||')');
    if original is null then raise exception 'Required function is missing: %',item.name; end if;
    if to_regprocedure('public.'||item.name||'_secured_impl('||item.signature||')') is null then
      execute format('alter function public.%I(%s) rename to %I',item.name,item.signature,item.name||'_secured_impl');
    end if;
    execute format('revoke all on function public.%I(%s) from public,anon,authenticated',item.name||'_secured_impl',item.signature);
    execute format('create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path='''' as $body$ begin if not public.seven_auth_assurance_ok() or not public.seven_session_is_active() then raise exception ''Authentication or two-step verification required.'' using errcode=''42501''; end if; return public.%I(%s); end $body$',item.name,item.args,item.result,item.name||'_secured_impl',item.pass);
    execute format('revoke all on function public.%I(%s) from public,anon',item.name,item.signature);
    execute format('grant execute on function public.%I(%s) to authenticated',item.name,item.signature);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
