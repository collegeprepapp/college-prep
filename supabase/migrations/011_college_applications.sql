-- 011_college_applications.sql
-- The list of colleges a student is considering, touring, applying to, or has
-- committed to. One row per school per student.
--
-- ===========================================================================
-- ACCESS MODEL — SHARED, NOT AUTHORED
-- ===========================================================================
-- Unlike notes (010), this table has no author and no private mode. Everyone
-- who can see the student's record — an admin at their school, the student
-- themselves, or an accepted linked parent — can read AND fully manage every
-- row: add a school, change its status, move a deadline, delete it.
--
-- That is deliberate. A college list is a shared working document between a
-- counselor, a student, and their parents; making rows author-owned would mean
-- a student could not fix a status a counselor entered, which is the opposite
-- of how the list is used in practice.
--
-- added_by records who first added a row, but it is bookkeeping, not access
-- control: it grants nothing, and anyone with student access can still edit or
-- delete a row someone else added. There is still no record of who CHANGED or
-- deleted something — that would need a history table.
--
-- REUSED FROM 010, not redefined here:
--   public.can_access_student(uuid) — the admin / student / linked-parent test
--   public.set_updated_at()         — generic updated_at trigger function
-- Both are created by 010_notes.sql, which runs first. Redeclaring them would
-- leave two copies to keep in step.
--
-- Depends on 001-010.

create table public.college_applications (
  id          uuid        primary key default gen_random_uuid(),
  student_id  uuid        not null references public.students (id) on delete cascade,
  school_name text        not null,
  status      text        not null default 'researching'
                          check (
                            status in (
                              'researching',
                              'touring',
                              'applied',
                              'accepted',
                              'committed'
                            )
                          ),
  deadline    date,
  notes       text,
  -- Who first added this school. Nullable and NOT defaulted in SQL: the
  -- application sets it on insert, so rows created by service-role tooling or
  -- an import script are honestly left null rather than being attributed to
  -- whoever happened to be connected.
  --
  -- Record-keeping only: it grants nothing, and anyone with student access can
  -- still edit or delete a row someone else added. It does not track later
  -- edits either, only the original insert.
  --
  -- The insert policy below does constrain it — a caller may only stamp their
  -- own id or leave it null — but the UPDATE policy does not, so added_by can
  -- still be rewritten after the fact by anyone with access. See the note there.
  added_by    uuid        references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index college_applications_student_id_idx
  on public.college_applications (student_id);

-- Same generic function notes uses; nothing table-specific in it.
create trigger college_applications_set_updated_at
  before update on public.college_applications
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Every policy is the same single test, because access here is all-or-nothing
-- per student rather than per row.

alter table public.college_applications enable row level security;

create policy "Anyone with student access can view applications"
  on public.college_applications
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else. Null stays permitted so service-role tooling and imports —
-- where auth.uid() is null — are not forced to invent an author.
create policy "Anyone with student access can add applications"
  on public.college_applications
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so an application cannot be moved onto a student the caller has no
-- access to.
--
-- Note the asymmetry with insert: added_by is NOT pinned here, so anyone with
-- student access can still rewrite it on an existing row. RLS cannot compare
-- against the old value, so making it immutable needs a BEFORE UPDATE trigger
-- reverting it (the pattern used in 008 and 009) rather than a policy clause.
create policy "Anyone with student access can update applications"
  on public.college_applications
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete applications"
  on public.college_applications
  for delete
  to authenticated
  using (public.can_access_student(student_id));
