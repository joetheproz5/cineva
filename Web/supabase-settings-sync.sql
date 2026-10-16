-- Atomic own-account settings saves. Existing settings remain in Auth metadata.
-- Installing these functions does not change any account's current settings.
begin;
create or replace function public.seven_settings_sync(p_expected_revision bigint default null, p_account jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  metadata jsonb;
  current_account jsonb;
  current_revision bigint;
begin
  if owner_id is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then
    raise exception 'Sign in required.' using errcode='42501';
  end if;
  select coalesce(raw_user_meta_data,'{}'::jsonb) into metadata from auth.users where id=owner_id for update;
  if not found then raise exception 'Sign in required.' using errcode='42501'; end if;
  current_account := coalesce(metadata->'seven_account','{}'::jsonb);
  current_revision := coalesce((metadata->>'seven_settings_revision')::bigint,0);
  if p_expected_revision is null and p_account is null then
    return jsonb_build_object('account',current_account,'revision',current_revision);
  end if;
  if p_expected_revision is null or p_expected_revision<0 or p_account is null or jsonb_typeof(p_account)<>'object' or octet_length(p_account::text)>1000000 then
    raise exception 'Invalid settings request.' using errcode='22023';
  end if;
  if p_expected_revision<>current_revision then
    return jsonb_build_object('conflict',true,'account',current_account,'revision',current_revision);
  end if;
  if jsonb_typeof(p_account->'profiles') is distinct from 'array' or jsonb_array_length(p_account->'profiles') not between 1 and 5 then
    raise exception 'An account must have between one and five profiles.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_account->'profiles') p where jsonb_typeof(p)<>'object' or coalesce(p->>'id','') !~ '^[A-Za-z0-9_-]{1,80}$') or
     (select count(*) from jsonb_array_elements(p_account->'profiles'))<>(select count(distinct p->>'id') from jsonb_array_elements(p_account->'profiles') p) then
    raise exception 'Invalid profile identifiers.' using errcode='22023';
  end if;
  current_revision := current_revision+1;
  update auth.users set raw_user_meta_data=metadata||jsonb_build_object('seven_account',p_account,'seven_settings_revision',current_revision),updated_at=now() where id=owner_id;
  return jsonb_build_object('account',p_account,'revision',current_revision);
end;
$$;
revoke all on function public.seven_settings_sync(bigint,jsonb) from public,anon;
grant execute on function public.seven_settings_sync(bigint,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
