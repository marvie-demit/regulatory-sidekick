-- ============================================================================
-- NotJustAnyQMS — 0001_init.sql
-- Multi-tenant schema + Row-Level Security + Storage + bootstrap RPCs.
-- Apply to a fresh Supabase project (SQL editor, or `supabase db push`).
-- Tenant = organization. Content stays in content.json (not in the DB);
-- these tables hold only per-org STATE, referencing content by id ("P1.1").
-- ============================================================================

begin;

-- Clean slate so this migration is safe to re-run (drops any partial prior run).
-- Fine on a fresh project; it WOULD delete data on a populated one — setup only.
drop policy if exists ev_obj_select on storage.objects;
drop policy if exists ev_obj_insert on storage.objects;
drop policy if exists ev_obj_delete on storage.objects;
drop schema if exists app cascade;
drop function if exists public.create_org_with_owner(text);
drop function if exists public.accept_invitation(text);
drop table if exists audit_log, evidence, quiz_score, org_device_profile,
  task_completion, activity_status, invitations, memberships, organizations cascade;
drop type if exists activity_state cascade;
drop type if exists activity_status cascade;
drop type if exists member_role cascade;

create extension if not exists pgcrypto;   -- gen_random_uuid(), digest()

-- ============ enums ============
create type member_role     as enum ('admin', 'member', 'viewer');
create type activity_state as enum ('not_started', 'in_progress', 'done', 'na');
-- UI labels map in ONE module: 'Not started'<->not_started, 'In progress'<->in_progress,
-- 'Done'<->done, 'N-A'<->na.

-- ============ core tenancy ============
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table memberships (
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on memberships(user_id);
create index on memberships(org_id);

create table invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  email       text not null,
  role        member_role not null default 'member',
  token_hash  text unique not null,            -- store the HASH; the raw token is emailed
  invited_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);
create unique index on invitations(org_id, lower(email)) where accepted_at is null;

-- ============ per-org state (replaces the 4 localStorage keys) ============
create table activity_status (              -- <- mdsi_ck
  org_id      uuid not null references organizations(id) on delete cascade,
  activity_id text not null,
  status      activity_state not null default 'not_started',
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (org_id, activity_id)
);

create table task_completion (              -- <- mdsi_tasks (row present = done)
  org_id      uuid not null references organizations(id) on delete cascade,
  activity_id text not null,
  step_index  int  not null,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (org_id, activity_id, step_index)
);

create table org_device_profile (           -- <- mdsi_profile (configured=false ~ null today)
  org_id     uuid primary key references organizations(id) on delete cascade,
  configured boolean not null default false,
  modules    text[] not null default '{}',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table quiz_score (                   -- <- mdsi_qz (per-org best score per phase)
  org_id     uuid not null references organizations(id) on delete cascade,
  phase      smallint not null check (phase between 1 and 4),
  best_score int not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (org_id, phase)
);

-- ============ evidence + audit (new SaaS capabilities) ============
create table evidence (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  activity_id  text not null,
  sub_index    int,
  storage_path text not null,
  file_name    text,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);
create index on evidence(org_id, activity_id);

create table audit_log (                     -- append-only
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  actor_id    uuid references auth.users(id),
  action      text not null,
  entity_type text,
  entity_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index on audit_log(org_id, created_at desc);

-- ============================================================================
-- app schema: SECURITY DEFINER helpers, NOT exposed via the API.
-- They bypass RLS on memberships so policies that call them don't recurse.
-- (select auth.uid()) / (select app.x()) => evaluated once per query (InitPlan).
-- ============================================================================
create schema app;
-- authenticated must resolve the helper functions referenced in RLS policies:
-- USAGE on the schema + EXECUTE on each function (granted below).
grant usage on schema app to authenticated;

create or replace function app.is_member(p_org uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()));
$$;

create or replace function app.has_role(p_org uuid, p_role public.member_role) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = p_role);
$$;

create or replace function app.can_write(p_org uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
      and m.role in ('admin', 'member'));   -- viewer = read-only
$$;

revoke all on function app.is_member(uuid)                         from public, anon;
revoke all on function app.has_role(uuid, public.member_role)      from public, anon;
revoke all on function app.can_write(uuid)                         from public, anon;
grant execute on function app.is_member(uuid)                      to authenticated;
grant execute on function app.has_role(uuid, public.member_role)   to authenticated;
grant execute on function app.can_write(uuid)                      to authenticated;

-- ============ enable RLS on every table ============
alter table organizations      enable row level security;
alter table memberships        enable row level security;
alter table invitations        enable row level security;
alter table activity_status    enable row level security;
alter table task_completion    enable row level security;
alter table org_device_profile enable row level security;
alter table quiz_score         enable row level security;
alter table evidence           enable row level security;
alter table audit_log          enable row level security;

-- organizations
create policy org_select on organizations for select using ((select app.is_member(id)));
create policy org_insert on organizations for insert with check (created_by = (select auth.uid()));
create policy org_update on organizations for update
  using ((select app.has_role(id, 'admin'))) with check ((select app.has_role(id, 'admin')));

-- memberships  (SELECT uses auth.uid() directly -> no recursion)
create policy mem_select on memberships for select
  using (user_id = (select auth.uid()) or (select app.is_member(org_id)));
create policy mem_write_admin on memberships for all
  using ((select app.has_role(org_id, 'admin'))) with check ((select app.has_role(org_id, 'admin')));

-- invitations: admin-only (acceptance happens via the RPC, before membership exists)
create policy inv_admin on invitations for all
  using ((select app.has_role(org_id, 'admin'))) with check ((select app.has_role(org_id, 'admin')));

-- per-org state: read = member, write = can_write (admin/member; viewer read-only)
create policy as_select on activity_status    for select using ((select app.is_member(org_id)));
create policy as_write  on activity_status    for all    using ((select app.can_write(org_id))) with check ((select app.can_write(org_id)));
create policy tc_select on task_completion    for select using ((select app.is_member(org_id)));
create policy tc_write  on task_completion    for all    using ((select app.can_write(org_id))) with check ((select app.can_write(org_id)));
create policy dp_select on org_device_profile for select using ((select app.is_member(org_id)));
create policy dp_write  on org_device_profile for all    using ((select app.can_write(org_id))) with check ((select app.can_write(org_id)));
create policy qs_select on quiz_score         for select using ((select app.is_member(org_id)));
create policy qs_write  on quiz_score         for all    using ((select app.can_write(org_id))) with check ((select app.can_write(org_id)));

-- evidence
create policy ev_select on evidence for select using ((select app.is_member(org_id)));
create policy ev_insert on evidence for insert
  with check ((select app.can_write(org_id)) and uploaded_by = (select auth.uid()));
create policy ev_delete on evidence for delete
  using ((select app.can_write(org_id)) and (uploaded_by = (select auth.uid()) or (select app.has_role(org_id, 'admin'))));

-- audit_log: read = member, insert = member & self; immutable (no update/delete policy)
create policy au_select on audit_log for select using ((select app.is_member(org_id)));
create policy au_insert on audit_log for insert
  with check ((select app.is_member(org_id)) and actor_id = (select auth.uid()));

-- ============================================================================
-- Storage: private 'evidence' bucket. Path = org/<org_id>/<activity_id>/<file>.
-- foldername(name) -> {'org','<org_id>','<activity_id>'}; org_id is element [2].
-- ============================================================================
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
  on conflict (id) do nothing;

create policy ev_obj_select on storage.objects for select
  using (bucket_id = 'evidence' and (select app.is_member(((storage.foldername(name))[2])::uuid)));
create policy ev_obj_insert on storage.objects for insert
  with check (bucket_id = 'evidence' and (select app.can_write(((storage.foldername(name))[2])::uuid)));
create policy ev_obj_delete on storage.objects for delete
  using (bucket_id = 'evidence' and (select app.can_write(((storage.foldername(name))[2])::uuid)));

-- ============================================================================
-- Bootstrap RPCs (SECURITY DEFINER) — needed where RLS would block the first write.
-- In PUBLIC (not app) so the client can call them via supabase.rpc(); the
-- private app.* helpers stay unexposed. Each is granted to authenticated only.
-- ============================================================================
create or replace function public.create_org_with_owner(p_name text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  insert into public.organizations(name, created_by) values (p_name, v_uid) returning id into v_org;
  insert into public.memberships(org_id, user_id, role) values (v_org, v_uid, 'admin');
  insert into public.org_device_profile(org_id, configured) values (v_org, false);
  insert into public.audit_log(org_id, actor_id, action, entity_type, entity_id)
    values (v_org, v_uid, 'org.create', 'organization', v_org::text);
  return v_org;
end; $$;
revoke all on function public.create_org_with_owner(text) from public, anon;
grant execute on function public.create_org_with_owner(text) to authenticated;

create or replace function public.accept_invitation(p_raw_token text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare v_inv public.invitations; v_uid uuid := (select auth.uid()); v_hash text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');
  select * into v_inv from public.invitations
    where token_hash = v_hash and accepted_at is null and expires_at > now();
  if not found then raise exception 'invalid or expired invitation'; end if;
  insert into public.memberships(org_id, user_id, role)
    values (v_inv.org_id, v_uid, v_inv.role)
    on conflict (org_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  insert into public.audit_log(org_id, actor_id, action, entity_type, entity_id)
    values (v_inv.org_id, v_uid, 'invitation.accept', 'invitation', v_inv.id::text);
  return v_inv.org_id;
end; $$;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- Make PostgREST pick up the new public functions immediately.
notify pgrst, 'reload schema';

commit;
