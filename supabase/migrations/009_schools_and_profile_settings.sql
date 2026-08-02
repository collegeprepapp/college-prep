-- 009_schools_and_profile_settings.sql
-- Opens up the two tables a Settings page needs: reading/renaming a school, and
-- letting anyone edit their own name.
--
-- ===========================================================================
-- WHAT MAY CHANGE, AND WHO DECIDES
-- ===========================================================================
-- As in 006 and 008, the rules split across two mechanisms, because RLS is
-- row-level and cannot see WHICH columns an UPDATE touched:
--
--   RLS policies  -> who may touch the row at all
--   BEFORE UPDATE -> which columns they may actually move
--
-- schools
--   select : anyone authenticated, for their own school; system_admin, any
--   update : school_admin (own school) and system_admin (any)
--            -> name only. slug is reverted by trigger, so links built from it
--               never break under an admin's hands.
--   no insert/delete policies: creating or removing a school stays service-role.
--
-- profiles
--   update : anyone authenticated, on their own row
--            -> first_name / last_name only. role and school_id are reverted by
--               trigger FOR EVERYONE, admins included. An admin must not be able
--               to self-promote to system_admin or move themselves into another
--               school; those columns change only through service-role code.
--
-- Both triggers revert silently rather than raising, matching 008: a client that
-- PATCHes a whole row still succeeds, it just does not move the locked columns.
-- Neither trigger applies when auth.uid() is null (service_role, or a direct
-- database connection), which is what keeps admin tooling able to fix these.
--
-- Depends on 001-008, including get_my_role() and get_my_school_id().

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
-- Until now this table had RLS on with zero policies, so nothing but the
-- service role could read it. That is why the "Add Student" and "Add Template"
-- forms ask a system_admin to paste a school UUID — there was no readable list.
-- The select policy below makes a real picker possible.

create policy "Users can view their own school"
  on public.schools
  for select
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or id = public.get_my_school_id()
  );

create policy "Admins can update their own school"
  on public.schools
  for update
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and id = public.get_my_school_id()
    )
  );

-- Column guard: name is editable, everything else is pinned. Without this the
-- update policy above would also let an admin rewrite slug, which is a stable
-- identifier (walnut-grove) that URLs and lookups are expected to rely on.
create or replace function public.enforce_school_update_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- No JWT: service_role, or a direct database connection.
  if auth.uid() is null then
    return new;
  end if;

  new.id         := old.id;
  new.slug       := old.slug;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger schools_restrict_update_columns
  before update on public.schools
  for each row
  execute function public.enforce_school_update_columns();

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- 002 gave this table select policies only. This adds self-update.
--
-- The predicate is a direct `id = auth.uid()` comparison rather than a subquery
-- on profiles, so it does not re-enter the table's own policies — no need for a
-- SECURITY DEFINER helper here.

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Column guard: first_name and last_name only.
--
-- Note there is NO admin exemption, unlike the assigned_tasks trigger in 008.
-- That is the point: role and school_id are privilege, and a caller must never
-- be able to grant themselves more of either by editing their own row. A
-- school_admin who could set role = 'system_admin' would own every school.
--
-- SECURITY INVOKER (the default) is deliberate — this function reads nothing
-- and needs no elevated rights, so it gets none.
create or replace function public.enforce_profile_self_update_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- No JWT: service_role, or a direct database connection. Role and school
  -- assignment happen here, out of band from any user-facing request.
  if auth.uid() is null then
    return new;
  end if;

  new.id         := old.id;
  new.role       := old.role;
  new.school_id  := old.school_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger profiles_restrict_self_update_columns
  before update on public.profiles
  for each row
  execute function public.enforce_profile_self_update_columns();
