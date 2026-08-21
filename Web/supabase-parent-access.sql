-- SEVEN parent access code security.
-- Run once in Supabase Dashboard → SQL Editor.
-- The code is never stored in account metadata or exposed to the browser.

create extension if not exists pgcrypto;

create table if not exists public.seven_parent_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seven_parent_access enable row level security;
revoke all on table public.seven_parent_access from anon, authenticated;

create or replace function public.seven_parent_access_enabled()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.seven_parent_access
    where user_id = auth.uid()
  );
$$;

create or replace function public.seven_parent_access_verify(code text)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  select code_hash into stored_hash
  from public.seven_parent_access
  where user_id = auth.uid();
  return stored_hash is not null and stored_hash = crypt(code, stored_hash);
end;
$$;

create or replace function public.seven_parent_access_set(current_code text, new_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  if new_code !~ '^[0-9]{4,8}$' then
    raise exception 'Parent access codes must use 4–8 digits.' using errcode = '22023';
  end if;
  select code_hash into stored_hash
  from public.seven_parent_access
  where user_id = auth.uid()
  for update;
  if stored_hash is not null and (current_code is null or stored_hash <> crypt(current_code, stored_hash)) then
    raise exception 'Current parent access code is not correct.' using errcode = '28000';
  end if;
  insert into public.seven_parent_access (user_id, code_hash)
  values (auth.uid(), crypt(new_code, gen_salt('bf', 12)))
  on conflict (user_id) do update set
    code_hash = excluded.code_hash,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.seven_parent_access_clear(current_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required.' using errcode = '28000';
  end if;
  select code_hash into stored_hash
  from public.seven_parent_access
  where user_id = auth.uid()
  for update;
  if stored_hash is null or current_code is null or stored_hash <> crypt(current_code, stored_hash) then
    raise exception 'Current parent access code is not correct.' using errcode = '28000';
  end if;
  delete from public.seven_parent_access where user_id = auth.uid();
  return true;
end;
$$;

revoke all on function public.seven_parent_access_enabled() from public;
revoke all on function public.seven_parent_access_verify(text) from public;
revoke all on function public.seven_parent_access_set(text, text) from public;
revoke all on function public.seven_parent_access_clear(text) from public;
grant execute on function public.seven_parent_access_enabled() to authenticated;
grant execute on function public.seven_parent_access_verify(text) to authenticated;
grant execute on function public.seven_parent_access_set(text, text) to authenticated;
grant execute on function public.seven_parent_access_clear(text) to authenticated;
