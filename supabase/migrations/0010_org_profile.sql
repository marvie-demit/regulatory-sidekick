-- 0010: company / workspace profile fields on organizations.
-- Additive and all nullable. The existing policies already cover these columns:
--   org_select = app.is_member(id)  (any member can read the profile)
--   org_update = app.has_role(id,'admin')  (only admins can edit)
-- so no RLS change is needed.

alter table public.organizations
  add column if not exists website  text,
  add column if not exists linkedin text,
  add column if not exists industry text,
  add column if not exists country  text,
  add column if not exists about    text;
