-- 002_profiles.sql
-- User profiles, roles, and the first pass of RLS on profiles.
--
-- INCOMPLETE BY DESIGN: this migration only covers "see your own profile" and
-- "admins see profiles in their school". A future migration will add a policy
-- allowing parents to see their linked children's profiles — that rule cannot
-- be written yet because the parent-student link table does not exist until the
-- CRM/student records work lands. A partial-looking policy set here is expected,
-- not an oversight.
--
-- Recursion note: RLS policies on profiles must NOT query profiles directly, or
-- Postgres re-enters the same policy while evaluating it and errors out with
-- infinite recursion. The get_my_role() / get_my_school_id() helpers below are
-- SECURITY DEFINER, so they run as the function owner and bypass RLS on
-- profiles, breaking the loop. Always use the helpers inside profiles policies.

create table public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  school_id  uuid        references public.schools (id),
  role       text        not null check (role in ('system_admin', 'school_admin', 'student', 'parent')),
  first_name text,
  last_name  text,
  created_at timestamptz not null default now(),

  -- Every role is scoped to a school except system_admin, which is global.
  constraint profiles_school_id_required
    check (role = 'system_admin' or school_id is not null)
);

create index profiles_school_id_idx on public.profiles (school_id);

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER + an empty search_path: the empty search_path is required so
-- the function body cannot be hijacked by a caller-controlled search_path, which
-- means every object reference inside must be schema-qualified.

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.get_my_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.get_my_role() from public;
revoke execute on function public.get_my_school_id() from public;

grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.get_my_school_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- Anyone signed in can read their own profile row.
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- school_admin reads every profile in their own school; system_admin reads all.
-- Permissive policies are OR'd together, so this stacks with the policy above.
create policy "Admins can view profiles in their school"
  on public.profiles
  for select
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  );

-- No insert/update/delete policies yet: writes are service_role only for now.
