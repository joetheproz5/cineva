-- Real PostgreSQL regression. The fixture user and every change are rolled back.
begin;
do $$
declare
  fixture uuid := gen_random_uuid();
  initial jsonb := '{"profiles":[{"id":"main","name":"Fixture","preferences":{"language":"English"}}]}'::jsonb;
  changed jsonb := '{"profiles":[{"id":"main","name":"Changed"}]}'::jsonb;
  result jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(fixture,'sync-fixture-'||fixture||'@example.invalid','{}'::jsonb);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',fixture,'role','authenticated','is_anonymous',false)::text,true);
  result := public.seven_settings_sync();
  if (result->>'revision')::bigint<>0 then raise exception 'Unexpected initial revision'; end if;
  result := public.seven_settings_sync(0,initial);
  if (result->>'revision')::bigint<>1 or result->'account'<>initial then raise exception 'Initial save failed'; end if;
  result := public.seven_settings_sync(0,changed);
  if result->>'conflict'<>'true' or result->'account'<>initial or (result->>'revision')::bigint<>1 then raise exception 'Stale write was not rejected'; end if;
  result := public.seven_settings_sync(1,changed);
  if (result->>'revision')::bigint<>2 then raise exception 'Rebased save failed'; end if;
  begin
    perform public.seven_settings_sync(2,'{"profiles":[{"id":"main"},{"id":"main"}]}'::jsonb);
    raise exception 'Duplicate profile accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.seven_settings_sync(2,'{"profiles":[]}'::jsonb);
    raise exception 'Empty profile list accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',fixture,'role','authenticated','is_anonymous',true)::text,true);
  begin
    perform public.seven_settings_sync();
    raise exception 'Anonymous access accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  begin
    perform public.seven_settings_sync();
    raise exception 'Other-account access accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
select 'PASS: atomic save, stale-write rejection, rebase, profile validation and account isolation. Fixture rolled back.' as verification;
