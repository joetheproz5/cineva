-- Apply after supabase-auth-security.sql. Does not opt in or sign out any existing user.
begin;
create table if not exists public.seven_email_security_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false, updated_at timestamptz not null default now()
);
create table if not exists public.seven_email_session_proofs (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null, verified_at timestamptz not null default now()
);
create table if not exists public.seven_email_challenges (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null, purpose text not null check(purpose in ('enable','signin','disable')),
  email text not null, expires_at timestamptz not null, created_at timestamptz not null default now(),
  attempts integer not null default 0, consumed boolean not null default false
);
alter table public.seven_email_security_preferences enable row level security;
alter table public.seven_email_session_proofs enable row level security;
alter table public.seven_email_challenges enable row level security;
revoke all on public.seven_email_security_preferences,public.seven_email_session_proofs,public.seven_email_challenges from public,anon,authenticated;

create or replace function public.seven_email_session_ok()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
   not exists(select 1 from public.seven_email_security_preferences where user_id=auth.uid() and enabled)
   or exists(select 1 from public.seven_email_session_proofs p join auth.users u on u.id=p.user_id
     join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
     where p.user_id=auth.uid() and p.session_id=(auth.jwt()->>'session_id')::uuid
       and lower(p.email)=lower(u.email) and u.email_confirmed_at is not null
       and p.verified_at >= (select updated_at from public.seven_email_security_preferences where user_id=auth.uid()))
 );
$$;
revoke all on function public.seven_email_session_ok() from public,anon;
grant execute on function public.seven_email_session_ok() to authenticated;

-- Preserve native authenticator assurance AND require the email proof when opted in.
create or replace function public.seven_auth_assurance_ok()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and
   (auth.jwt()->>'aal'='aal2' or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified'))
   and public.seven_email_session_ok();
$$;

-- Only the server may create/consume challenges or grant a session. No client metadata flags.
create or replace function public.seven_email_security(p_action text,p_user uuid,p_session uuid,
 p_challenge uuid default null,p_purpose text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_email text; v_enabled boolean; v_verified boolean; v_updated timestamptz;
 v_challenge public.seven_email_challenges%rowtype; v_new_id uuid;
begin
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user) then
   return jsonb_build_object('active',false); end if;
 select lower(email) into v_email from auth.users where id=p_user and email_confirmed_at is not null;
 if v_email is null then return jsonb_build_object('active',true,'confirmed',false); end if;
 -- Lock one account for all policy/challenge mutations, including first-time enrollment.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,485721));
 select enabled,updated_at into v_enabled,v_updated from public.seven_email_security_preferences where user_id=p_user;
 v_enabled:=coalesce(v_enabled,false);
 select exists(select 1 from public.seven_email_session_proofs where user_id=p_user and session_id=p_session
   and email=v_email and verified_at>=v_updated) into v_verified;
 if p_action='status' then
   return jsonb_build_object('active',true,'confirmed',true,'enabled',v_enabled,'required',v_enabled and not v_verified);
 end if;
 if p_action='start' then
   if p_purpose not in ('enable','signin','disable') or p_purpose is null then raise exception 'Invalid purpose'; end if;
   if (p_purpose='enable' and v_enabled) or (p_purpose in ('signin','disable') and not v_enabled) then
     return jsonb_build_object('conflict',true); end if;
   if p_purpose='disable' and not v_verified then return jsonb_build_object('required',true); end if;
   select * into v_challenge from public.seven_email_challenges where session_id=p_session for update;
   if found and v_challenge.created_at>now()-interval '60 seconds' then
     return jsonb_build_object('cooldown',true,'retryAfter',60); end if;
   v_new_id:=gen_random_uuid();
   insert into public.seven_email_challenges(session_id,user_id,id,purpose,email,expires_at)
     values(p_session,p_user,v_new_id,p_purpose,v_email,now()+interval '10 minutes')
     on conflict(session_id) do update set id=excluded.id,purpose=excluded.purpose,email=excluded.email,
       expires_at=excluded.expires_at,created_at=now(),attempts=0,consumed=false;
   return jsonb_build_object('id',v_new_id,'expiresIn',600);
 end if;
 select * into v_challenge from public.seven_email_challenges where session_id=p_session and user_id=p_user for update;
 if not found or v_challenge.id is distinct from p_challenge or v_challenge.email<>v_email
   or v_challenge.expires_at<=now() or v_challenge.consumed or v_challenge.attempts>6
   or (p_action='attempt' and v_challenge.attempts>=6) then
   return jsonb_build_object('valid',false); end if;
 if p_action='cancel' then
   update public.seven_email_challenges set consumed=true,created_at=now()-interval '61 seconds' where session_id=p_session;
   return jsonb_build_object('ok',true);
 end if;
 if p_action='attempt' then
   update public.seven_email_challenges set attempts=attempts+1 where session_id=p_session;
   return jsonb_build_object('valid',true,'purpose',v_challenge.purpose);
 end if;
 if p_action<>'finish' then raise exception 'Invalid action'; end if;
 update public.seven_email_challenges set consumed=true where session_id=p_session;
 if v_challenge.purpose='enable' then
   if v_enabled then return jsonb_build_object('valid',false); end if;
   insert into public.seven_email_security_preferences(user_id,enabled,updated_at) values(p_user,true,now())
     on conflict(user_id) do update set enabled=true,updated_at=now();
   delete from public.seven_email_session_proofs where user_id=p_user;
 elsif v_challenge.purpose='disable' then
   if not v_enabled or not v_verified then return jsonb_build_object('valid',false); end if;
   update public.seven_email_security_preferences set enabled=false,updated_at=now() where user_id=p_user;
   delete from public.seven_email_session_proofs where user_id=p_user;
 elsif not v_enabled then return jsonb_build_object('valid',false);
 end if;
 insert into public.seven_email_session_proofs(session_id,user_id,email,verified_at) values(p_session,p_user,v_email,now())
   on conflict(session_id) do update set email=excluded.email,verified_at=now();
 return jsonb_build_object('valid',true,'enabled',v_challenge.purpose<>'disable');
end $$;
revoke all on function public.seven_email_security(text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.seven_email_security(text,uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
