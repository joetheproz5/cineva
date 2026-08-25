-- Watch party transport (run once in the Supabase SQL editor)
create table if not exists public.watch_party_messages (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.watch_party_messages enable row level security;

drop policy if exists "party insert" on public.watch_party_messages;
create policy "party insert" on public.watch_party_messages for insert to anon with check (true);

drop policy if exists "party select" on public.watch_party_messages;
create policy "party select" on public.watch_party_messages for select to anon using (created_at > now() - interval '20 minutes');

drop policy if exists "party delete" on public.watch_party_messages;
create policy "party delete" on public.watch_party_messages for delete to anon using (created_at < now() - interval '20 minutes');

create index if not exists watch_party_messages_code_created on public.watch_party_messages (code, created_at);
