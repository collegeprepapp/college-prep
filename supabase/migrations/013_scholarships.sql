-- 013_scholarships.sql
-- Scholarships a student is researching, has applied for, or has heard back on.
-- One row per scholarship per student.
--
-- ===========================================================================
-- ACCESS MODEL — SHARED, NOT AUTHORED
-- ===========================================================================
-- Identical to college_applications (011), deliberately. Everyone who can see
-- the student's record — an admin at their school, the student themselves, or
-- an accepted linked parent — can read AND fully manage every row: add a
-- scholarship, change its status, move a deadline, delete it.
--
-- A scholarship list is a shared working document between a counselor, a
-- student, and their parents. Making rows author-owned would mean a student
-- could not correct a status a counselor entered, which is the opposite of how
-- the list is used.
--
-- added_by records who first added a row. It is bookkeeping, not access
-- control: it grants nothing, and anyone with student access can still edit or
-- delete a row someone else added. There is no record of who CHANGED or deleted
-- something — that would need a history table.
--
-- REUSED FROM 010, not redefined here:
--   public.can_access_student(uuid) — the admin / student / linked-parent test
--   public.set_updated_at()         — generic updated_at trigger function
-- Both are created by 010_notes.sql, which runs first. Redeclaring them would
-- leave two copies to keep in step.
--
-- Depends on 001-012.

create table public.scholarships (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  name       text        not null,
  amount     numeric,
  -- Named explicitly rather than left to Postgres. 011 wrote its check inline,
  -- and 012 then had to verify the auto-generated name against the live
  -- database before it could drop and recreate it. Naming it here means a
  -- future migration can target it without guessing.
  status     text        not null default 'researching'
                         constraint scholarships_status_check
                         check (
                           status in ('researching', 'applied', 'awarded', 'denied')
                         ),
  deadline   date,
  link       text,
  notes      text,
  -- Nullable and NOT defaulted in SQL: the application sets it on insert, so
  -- rows created by service-role tooling or an import are honestly left null
  -- rather than attributed to whoever happened to be connected.
  added_by   uuid        references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scholarships_student_id_idx on public.scholarships (student_id);

-- Same generic function notes and college_applications use; nothing
-- table-specific in it.
create trigger scholarships_set_updated_at
  before update on public.scholarships
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Every policy is the same single test, because access here is all-or-nothing
-- per student rather than per row.

alter table public.scholarships enable row level security;

create policy "Anyone with student access can view scholarships"
  on public.scholarships
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else. Null stays permitted so service-role tooling and imports —
-- where auth.uid() is null — are not forced to invent an author.
create policy "Anyone with student access can add scholarships"
  on public.scholarships
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so a scholarship cannot be moved onto a student the caller has no
-- access to.
--
-- Note the asymmetry with insert, carried over from 011: added_by is NOT pinned
-- here, so anyone with student access can still rewrite it on an existing row.
-- RLS cannot compare against the old value, so making it immutable needs a
-- BEFORE UPDATE trigger reverting it (the pattern used in 008 and 009) rather
-- than a policy clause.
create policy "Anyone with student access can update scholarships"
  on public.scholarships
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete scholarships"
  on public.scholarships
  for delete
  to authenticated
  using (public.can_access_student(student_id));
