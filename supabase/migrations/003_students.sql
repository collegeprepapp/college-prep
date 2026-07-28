-- 003_students.sql
-- Student records and standardized test scores.
--
-- INCOMPLETE BY DESIGN — two follow-ups are expected:
--   1. Parent read access. Parents cannot yet be granted access to their
--      children's students / test_scores rows, because the parent_student_links
--      table does not exist until the CRM/student records work lands. A future
--      migration adds those select policies.
--   2. Write policies. This migration is read-only: there are no insert, update,
--      or delete policies on either table, so writes are service_role only for
--      now. Admin write policies land in a follow-up once the CRM UI is being
--      built and the actual write paths are known.
--
-- Depends on 001_schools.sql and 002_profiles.sql, including the SECURITY
-- DEFINER helpers public.get_my_role() and public.get_my_school_id().

create table public.students (
  id              uuid         primary key default gen_random_uuid(),
  school_id       uuid         not null references public.schools (id),
  -- Nullable: a student record exists in the CRM whether or not that student
  -- has ever been given a login. Set once they have an auth account.
  profile_id      uuid         references public.profiles (id),
  first_name      text         not null,
  last_name       text         not null,
  graduation_year integer      not null,
  email           text,
  gpa             numeric(3,2),
  class_rank      text,
  created_at      timestamptz  not null default now()
);

create table public.test_scores (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  test_type  text        not null check (test_type in ('SAT', 'ACT')),
  score      integer     not null,
  test_date  date,
  created_at timestamptz not null default now()
);

create index students_school_id_idx on public.students (school_id);
create index test_scores_student_id_idx on public.test_scores (student_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.students enable row level security;
alter table public.test_scores enable row level security;

-- students: school_admin sees their own school's students; system_admin sees all.
create policy "Admins can view students in their school"
  on public.students
  for select
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  );

-- students: a student with a linked login sees their own record.
create policy "Students can view their own record"
  on public.students
  for select
  to authenticated
  using (profile_id = auth.uid());

-- test_scores: scoped through the owning student row.
--
-- Note: these subqueries read public.students, which has its own RLS. The
-- subquery is evaluated under the caller's permissions, so a row is visible
-- here only if the matching students row is also visible to that caller. The
-- two policy sets above are aligned with these, so the behavior matches intent
-- today — but tightening students' policies later will silently narrow
-- test_scores visibility too. This is not recursion (different table), so no
-- SECURITY DEFINER helper is needed.
create policy "Admins can view test scores in their school"
  on public.test_scores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = test_scores.student_id
        and (
          public.get_my_role() = 'system_admin'
          or (
            public.get_my_role() = 'school_admin'
            and s.school_id = public.get_my_school_id()
          )
        )
    )
  );

create policy "Students can view their own test scores"
  on public.test_scores
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = test_scores.student_id
        and s.profile_id = auth.uid()
    )
  );
