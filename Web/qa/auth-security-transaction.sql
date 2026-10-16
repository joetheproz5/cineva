-- All fixture data and counters are rolled back. No real accounts are modified.
begin;
do $$
declare viewer uuid:=gen_random_uuid(); session_id uuid:=gen_random_uuid(); factor_id uuid:=gen_random_uuid();
  answer jsonb; blocked boolean:=false;
begin
  if has_function_privilege('anon','public.seven_auth_rate_limit(jsonb)','EXECUTE') or has_function_privilege('authenticated','public.seven_auth_rate_limit(jsonb)','EXECUTE') then raise exception 'Rate limiter permissions are unsafe'; end if;
  if has_function_privilege('authenticated','public.seven_settings_sync_secured_impl(bigint,jsonb)','EXECUTE') then raise exception 'Private RPC bypass is exposed'; end if;
  answer:=public.seven_auth_rate_limit(jsonb_build_array(jsonb_build_object('key',encode(sha256(viewer::text::bytea),'hex'),'limit',2,'seconds',600)));
  if (answer->>'allowed')::boolean is not true then raise exception 'First request rejected'; end if;
  perform public.seven_auth_rate_limit(jsonb_build_array(jsonb_build_object('key',encode(sha256(viewer::text::bytea),'hex'),'limit',2,'seconds',600)));
  answer:=public.seven_auth_rate_limit(jsonb_build_array(jsonb_build_object('key',encode(sha256(viewer::text::bytea),'hex'),'limit',2,'seconds',600)));
  if (answer->>'allowed')::boolean is not false or (answer->>'retry_after')::integer<1 then raise exception 'Limit was bypassed'; end if;
  insert into auth.users(id,email,raw_user_meta_data) values(viewer,'security-fixture-'||viewer||'@example.invalid','{}');
  insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(session_id,viewer,now(),now(),'aal1');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','session_id',session_id,'aal','aal1')::text,true);
  if public.seven_auth_assurance_ok() is not true then raise exception 'Unenrolled user was blocked'; end if;
  answer:=public.seven_settings_sync(0,'{"profiles":[{"id":"main","name":"Fixture"}]}');
  if (answer->>'revision')::integer<>1 then raise exception 'Existing account save broke'; end if;
  insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,secret,created_at,updated_at) values(factor_id,viewer,'Rolled-back fixture','totp','verified','fixture-not-an-authenticator-secret',now(),now());
  if public.seven_auth_assurance_ok() is not false then raise exception 'Low assurance bypassed MFA'; end if;
  begin perform public.seven_settings_sync(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Security-definer RPC bypassed MFA'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','session_id',session_id,'aal','aal2')::text,true);
  if public.seven_auth_assurance_ok() is not true then raise exception 'Verified session was blocked'; end if;
  answer:=public.seven_settings_sync(); if (answer->>'revision')::integer<>1 then raise exception 'Verified settings read broke'; end if;
  if (select count(*) from pg_policies where policyname='SEVEN requires MFA when enabled' and schemaname='public')<4 then raise exception 'Missing restrictive policies'; end if;
end $$;
rollback;
select 'PASS: shared throttling, RPC privileges, ordinary saves, low-AAL denial and verified-MFA access. All fixtures rolled back.' as verification;
