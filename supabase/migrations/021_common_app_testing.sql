-- 021_common_app_testing.sql
-- The Common App's testing section: whether a student is applying test-optional
-- and, if not, which scores they intend to report.
--
-- ===========================================================================
-- ONE ROW PER STUDENT — THIS IS A SINGLETON TABLE
-- ===========================================================================
-- Unlike every other planner table, student_id is UNIQUE. A student has one
-- testing answer, not a list of them, so this holds at most a single row each.
--
-- Two consequences the application has to respect:
--
--   1. A blind INSERT fails the second time with 23505. Writes should UPSERT.
--      student_id carries a plain unique constraint (not a partial index), so
--      ON CONFLICT inference works and PostgREST's upsert can use it:
--
--        supabase.from('common_app_testing')
--          .upsert({ student_id, ... }, { onConflict: 'student_id' })
--
--      That is worth stating because the equivalent on assigned_tasks does NOT
--      work — its uniqueness is a partial index, which Postgres refuses to
--      infer (42P10, see migration 007).
--
--   2. There is no row until someone saves. Reads must handle "no answer yet"
--      rather than assuming a row exists; maybeSingle() rather than single().
--
-- NO DELETE POLICY, deliberately. Clearing this section means blanking its
-- fields, not removing the row — deleting would only put the student back in
-- the state they started in, and the upsert would recreate it on the next save
-- anyway.
--
-- No added_by either: with one row per student, "who last touched it" is a
-- question about a shared answer, not authorship of a list entry. updated_at
-- records when it last changed, which is the part that matters.
--
-- No separate index on student_id: the unique constraint creates one.
--
-- reported_scores is free text on purpose. Which scores a student reports is a
-- judgement written in prose ("SAT 1340 superscored, not reporting ACT"), not
-- something to model as columns — public.test_scores already holds the actual
-- numbers.
--
-- Access follows the shared pattern: anyone who can see the student's record
-- can read and write this. See migration 013 for the reasoning.
--
-- Depends on 010 (helpers) and 003 (students).

create table public.common_app_testing (
  id              uuid        primary key default gen_random_uuid(),
  student_id      uuid        not null references public.students (id) on delete cascade
                              constraint common_app_testing_student_id_key unique,
  test_optional   boolean     not null default false,
  reported_scores text,
  notes           text,
  updated_at      timestamptz not null default now()
);

-- Fires on UPDATE only; an INSERT takes the column default.
create trigger common_app_testing_set_updated_at
  before update on public.common_app_testing
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.common_app_testing enable row level security;

create policy "Anyone with student access can view common app testing"
  on public.common_app_testing
  for select
  to authenticated
  using (public.can_access_student(student_id));

create policy "Anyone with student access can add common app testing"
  on public.common_app_testing
  for insert
  to authenticated
  with check (public.can_access_student(student_id));

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so the answer cannot be moved onto a student the caller has no access
-- to. Both halves matter for an upsert, which may take either path.
create policy "Anyone with student access can update common app testing"
  on public.common_app_testing
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

-- No DELETE policy. See the header.
