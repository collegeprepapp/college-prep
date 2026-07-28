-- 005_parent_student_links.sql
-- Parent-to-student invite links, and the parent read access they unlock.
--
-- PATTERN TO REPEAT: every future table that a parent should be able to read
-- through their child needs its OWN select policy calling
-- public.is_linked_parent_of(<student_id column>). Granting it here on students
-- and test_scores does NOT cascade. At minimum the planned notes, essays,
-- schools list, scholarships, activities, and transcripts tables will each need
-- their own policy added following the same pattern below.
--
-- NO WRITE POLICIES: there are deliberately no insert/update/delete policies on
-- parent_student_links. Invite creation and invite acceptance run through server
-- actions using the service role key, because accepting an invite has to create
-- an auth user first — that cannot happen through a simple RLS-governed insert.
--
-- NO SELECT POLICIES EITHER: the raw table is fully locked down (RLS on, zero
-- policies) exactly like public.schools in 001, because every row carries an
-- invite_token that is a bearer credential. Only service-role code reads the
-- table. Regular users read public.parent_student_links_safe instead — a view
-- that drops invite_token and reproduces the three access rules in its WHERE
-- clause. See the security notes on the view below; its behavior depends on
-- ownership, not on policies.
--
-- Depends on 001-004. Requires Postgres 15+ (security_invoker view option).

-- gen_random_bytes() comes from pgcrypto (unlike gen_random_uuid(), which is
-- core Postgres 13+). Supabase pre-installs pgcrypto into the extensions schema;
-- this line is a no-op there and covers local/self-hosted setups.
create extension if not exists pgcrypto with schema extensions;

create table public.parent_student_links (
  id                uuid        primary key default gen_random_uuid(),
  student_id        uuid        not null references public.students (id) on delete cascade,
  -- Null until the invite is accepted; set to the parent's profile at that point.
  parent_profile_id uuid        references public.profiles (id),
  invited_by        uuid        not null references public.profiles (id),
  status            text        not null default 'pending'
                                check (status in ('pending', 'accepted')),
  invite_token      text        not null unique
                                default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,

  -- One link per parent per student. parent_profile_id is null until acceptance,
  -- and Postgres treats nulls as distinct, so this does NOT limit how many
  -- pending invites a student can have — only how many accepted links each
  -- parent can hold for the same student.
  constraint parent_student_links_unique_parent_student
    unique (student_id, parent_profile_id)
);

create index parent_student_links_student_id_idx
  on public.parent_student_links (student_id);
create index parent_student_links_parent_profile_id_idx
  on public.parent_student_links (parent_profile_id);

-- ---------------------------------------------------------------------------
-- RLS helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same reason as get_my_role(): policies on students
-- and test_scores call this, and it reads parent_student_links. Running as the
-- owner bypasses RLS inside the function, which is also what lets it read a
-- table that has no select policies at all. Empty search_path means everything
-- must be schema-qualified.

create or replace function public.is_linked_parent_of(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.parent_student_links l
    where l.student_id = target_student_id
      and l.parent_profile_id = auth.uid()
      and l.status = 'accepted'
  );
$$;

revoke execute on function public.is_linked_parent_of(uuid) from public;
grant execute on function public.is_linked_parent_of(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security: parent_student_links (locked down)
-- ---------------------------------------------------------------------------
-- RLS enabled with zero policies == no access for anon/authenticated, same as
-- public.schools in 001. service_role bypasses RLS, so server actions still
-- read and write the raw table (including invite_token) normally.

alter table public.parent_student_links enable row level security;

revoke all on public.parent_student_links from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Safe read view
-- ---------------------------------------------------------------------------
-- Every column except invite_token, filtered by the same three rules that would
-- otherwise be select policies.
--
-- SECURITY MODEL — read before editing:
--   * security_invoker = false (the pre-15 default, stated explicitly here) means
--     this view executes with the privileges of its OWNER, not the caller. That
--     is load-bearing: the owner is the table owner, so it bypasses the locked
--     down RLS above and can see rows the caller cannot read directly. Flipping
--     this to true makes the view return zero rows to everyone, because the base
--     table has no select policies.
--   * Supabase's database linter reports this as a "security definer view"
--     (lint 0010). That warning is expected and intended here.
--   * auth.uid() still resolves to the CALLER, not the owner — it reads the
--     per-request JWT claims GUC, which owner-privilege execution does not
--     change. The WHERE clause below is therefore per-user, as intended.
--   * Consequence of owner privileges: the subqueries on public.students below
--     also bypass students' RLS. The school scoping is enforced explicitly in
--     the predicates rather than inherited, so the result is the same today —
--     but this view no longer gets students' policies as a second layer.
--   * If public.parent_student_links ever gets FORCE ROW LEVEL SECURITY, the
--     owner stops bypassing RLS and this view goes blank.

create view public.parent_student_links_safe
with (security_invoker = false) as
select
  l.id,
  l.student_id,
  l.parent_profile_id,
  l.invited_by,
  l.status,
  l.created_at,
  l.accepted_at
from public.parent_student_links l
where
  -- Parent: their own link row.
  l.parent_profile_id = auth.uid()

  -- Student: links pointing at their own record.
  or exists (
    select 1
    from public.students s
    where s.id = l.student_id
      and s.profile_id = auth.uid()
  )

  -- Admins: school_admin within their own school, system_admin everywhere.
  or exists (
    select 1
    from public.students s
    where s.id = l.student_id
      and (
        public.get_my_role() = 'system_admin'
        or (
          public.get_my_role() = 'school_admin'
          and s.school_id = public.get_my_school_id()
        )
      )
  );

-- Ownership is part of the security model above, not incidental.
alter view public.parent_student_links_safe owner to postgres;

revoke all on public.parent_student_links_safe from public, anon;
grant select on public.parent_student_links_safe to authenticated;

-- ---------------------------------------------------------------------------
-- Parent read access on existing tables
-- ---------------------------------------------------------------------------
-- Permissive policies OR together, so these widen access for linked parents
-- without touching the admin and student policies from 003.

create policy "Linked parents can view their child's record"
  on public.students
  for select
  to authenticated
  using (public.is_linked_parent_of(id));

create policy "Linked parents can view their child's test scores"
  on public.test_scores
  for select
  to authenticated
  using (public.is_linked_parent_of(test_scores.student_id));
