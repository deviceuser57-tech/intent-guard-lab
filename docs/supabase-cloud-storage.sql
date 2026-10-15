-- Run this migration in the user's Supabase SQL editor before enabling cloud registry sync.
-- RLS is owner-scoped: each authenticated user can only access their own registry snapshot.
create table if not exists public.intent_guard_registry (
  user_id uuid primary key references auth.users(id) on delete cascade,
  registry jsonb not null default '{"assets":[],"audit":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.intent_guard_registry enable row level security;

drop policy if exists "Users can read own registry" on public.intent_guard_registry;
create policy "Users can read own registry"
  on public.intent_guard_registry for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own registry" on public.intent_guard_registry;
create policy "Users can insert own registry"
  on public.intent_guard_registry for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own registry" on public.intent_guard_registry;
create policy "Users can update own registry"
  on public.intent_guard_registry for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.intent_guard_registry from anon;
grant select, insert, update on public.intent_guard_registry to authenticated;
