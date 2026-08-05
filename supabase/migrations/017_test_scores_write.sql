-- 017_test_scores_write.sql
-- Write access for test_scores, which has been select-only since 003/005.
--
-- ===========================================================================
-- ACCESS MODEL
-- ===========================================================================
-- Shared, not authored, like every other student-scoped table since 011:
-- everyone who can see the student's record — an admin at their school, the
-- student themselves, or an accepted linked parent — can add, edit, and remove
-- test scores.
--
-- Worth being explicit about what that means here, because this table is
-- different in kind from a college list: a student can now edit their own
-- reported SAT score. That is the same exposure as the GPA field on
-- public.students (migration 006), and the same answer applies — these are
-- working numbers a counselor verifies against an official report, not the
-- official record itself. If test scores ever need to be authoritative, they
-- want admin-only writes, not this policy set.
--
-- The select policies from 003 (admins, the student) and 005 (linked parents)
-- are untouched. can_access_student() covers exactly that same union, so the
-- four operations now line up.
--
-- Depends on 001-016 (can_access_student comes from 010).

-- ---------------------------------------------------------------------------
-- added_by
-- ---------------------------------------------------------------------------
-- Added for consistency: college_applications, scholarships, essays,
-- activities, honors, and documents all carry one, and test_scores would
-- otherwise be the single student-scoped table that cannot answer "who entered
-- this". That question has real weight for a score — a row entered by the
-- student is self-reported, one entered by an admin came from the office — and
-- backfilling the column later would leave existing rows null anyway, which is
-- exactly what they are now while the table is empty.
--
-- Nullable and not defaulted in SQL: the application sets it, so service-role
-- imports stay honestly unattributed. It grants nothing and restricts nothing.

alter table public.test_scores
  add column added_by uuid references public.profiles (id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- test_scores predates the pattern — it was created in 003, before 010 added
-- the shared trigger function — so until now an edited score left no record of
-- when it changed. That mattered less while the table was read-only; it matters
-- now that three different people can edit a score.
--
-- NOT NULL with a default is still a metadata-only change on Postgres 11+, so
-- existing rows are not rewritten. They take now() as their updated_at, which
-- reads as "last touched when this migration ran" — the honest answer, since
-- the real edit history was never recorded.

alter table public.test_scores
  add column updated_at timestamptz not null default now();

-- Same generic function every other writable table uses; nothing
-- table-specific in it.
create trigger test_scores_set_updated_at
  before update on public.test_scores
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Write policies
-- ---------------------------------------------------------------------------

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else.
create policy "Anyone with student access can add test scores"
  on public.test_scores
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so a score cannot be moved onto a student the caller has no access
-- to. As elsewhere, added_by is not pinned here — RLS cannot compare against
-- the old value, so making it immutable would need a BEFORE UPDATE trigger.
create policy "Anyone with student access can update test scores"
  on public.test_scores
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete test scores"
  on public.test_scores
  for delete
  to authenticated
  using (public.can_access_student(student_id));
