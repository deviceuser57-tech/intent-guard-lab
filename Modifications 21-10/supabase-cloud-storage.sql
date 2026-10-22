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

-- Optional shared workspaces. Members must already have Supabase Auth accounts.
create table if not exists public.intent_guard_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.intent_guard_workspace_members (
  workspace_id uuid not null references public.intent_guard_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  added_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.intent_guard_workspace_registry (
  workspace_id uuid primary key references public.intent_guard_workspaces(id) on delete cascade,
  registry jsonb not null default '{"assets":[],"audit":[]}'::jsonb,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.intent_guard_workspaces enable row level security;
alter table public.intent_guard_workspace_members enable row level security;
alter table public.intent_guard_workspace_registry enable row level security;

create or replace function public.is_intent_guard_workspace_member(target_workspace uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.intent_guard_workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_intent_guard_workspace(target_workspace uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.intent_guard_workspace_members
    where workspace_id = target_workspace and user_id = auth.uid() and role in ('owner', 'editor')
  );
$$;

drop policy if exists "Members can read workspaces" on public.intent_guard_workspaces;
create policy "Members can read workspaces" on public.intent_guard_workspaces
  for select to authenticated using (public.is_intent_guard_workspace_member(id));

drop policy if exists "Members can read workspace membership" on public.intent_guard_workspace_members;
create policy "Members can read workspace membership" on public.intent_guard_workspace_members
  for select to authenticated using (public.is_intent_guard_workspace_member(workspace_id));

drop policy if exists "Members can read shared registry" on public.intent_guard_workspace_registry;
create policy "Members can read shared registry" on public.intent_guard_workspace_registry
  for select to authenticated using (public.is_intent_guard_workspace_member(workspace_id));

drop policy if exists "Editors can create shared registry" on public.intent_guard_workspace_registry;
create policy "Editors can create shared registry" on public.intent_guard_workspace_registry
  for insert to authenticated with check (public.can_edit_intent_guard_workspace(workspace_id) and updated_by = auth.uid());

drop policy if exists "Editors can update shared registry" on public.intent_guard_workspace_registry;
create policy "Editors can update shared registry" on public.intent_guard_workspace_registry
  for update to authenticated using (public.can_edit_intent_guard_workspace(workspace_id))
  with check (public.can_edit_intent_guard_workspace(workspace_id) and updated_by = auth.uid());

grant select on public.intent_guard_workspaces, public.intent_guard_workspace_members, public.intent_guard_workspace_registry to authenticated;
grant insert, update on public.intent_guard_workspace_registry to authenticated;

create or replace function public.create_intent_guard_workspace(workspace_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(workspace_name)) < 1 or char_length(trim(workspace_name)) > 120 then
    raise exception 'Workspace name must contain 1 to 120 characters';
  end if;
  insert into public.intent_guard_workspaces(name, owner_id)
    values (trim(workspace_name), auth.uid()) returning id into new_workspace_id;
  insert into public.intent_guard_workspace_members(workspace_id, user_id, role)
    values (new_workspace_id, auth.uid(), 'owner');
  return new_workspace_id;
end;
$$;

create or replace function public.invite_intent_guard_workspace_member(
  target_workspace uuid, member_email text, member_role text default 'editor'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare invited_user_id uuid;
begin
  if not public.can_edit_intent_guard_workspace(target_workspace) then
    raise exception 'Workspace owner/editor role required';
  end if;
  if member_role <> 'editor' then raise exception 'Only editor invitations are supported'; end if;
  select id into invited_user_id from auth.users where lower(email) = lower(trim(member_email)) limit 1;
  if invited_user_id is null then raise exception 'User must create a Supabase account before being invited'; end if;
  insert into public.intent_guard_workspace_members as existing(workspace_id, user_id, role)
    values (target_workspace, invited_user_id, 'editor')
    on conflict (workspace_id, user_id) do update set role = 'editor'
    where existing.role <> 'owner';
end;
$$;

grant execute on function public.create_intent_guard_workspace(text) to authenticated;
grant execute on function public.invite_intent_guard_workspace_member(uuid, text, text) to authenticated;
