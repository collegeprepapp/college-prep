-- 023_common_app_additional_info.sql
-- The Common App's Additional Information section.
--
-- The third singleton in this schema, after common_app_testing (021) and
-- common_app_profile (022). Same shape, same three consequences — repeated here
-- because each one is a bug that only shows up after the first save:
--
--   1. student_id is UNIQUE, so a blind INSERT succeeds once and fails
--      afterwards with 23505. Writes should UPSERT. The constraint below is a
--      plain named unique constraint, NOT a partial index, so PostgREST can
--      infer the conflict target:
--
--        .upsert({ student_id, content }, { onConflict: 'student_id' })
--
--      (A partial unique index cannot be inferred and returns 42P10 — that is
--      why 018's index is handled differently.)
--
--   2. No row exists until someone saves, so reads need maybeSingle() and the
--      form needs an empty state. Return an empty answer rather than null and
--      let the upsert decide on save whether that is an insert or an update.
--
--   3. No added_by. With one row per student, "who last touched the shared
--      answer" is what updated_at already records.
--
-- No delete policy, matching 021 and 022: clearing this section means blanking
-- the field. Deleting would only return the student to their starting state,
-- and the next upsert would recreate the row.
--
-- ===========================================================================
-- ONE COLUMN, DELIBERATELY
-- ===========================================================================
-- content is a single nullable text field because that is what the real section
-- is: one open box. The Common App asks whether there is anything else the
-- student wants considered, and the answer is prose — not fields.
--
-- Nothing is validated here. The real form caps this at roughly 650 words, but
-- that belongs in lib/common-app/constants.ts with the other limits, for the
-- reasons given in 020: the cap changes between application cycles, and pinning
-- it in SQL turns a form update into a migration. It is also guidance rather
-- than enforcement everywhere else in this planner — the counter turns red and
-- the student trims it, instead of the database silently rejecting a paste.
--
-- ===========================================================================
-- WHAT TENDS TO GO IN THIS BOX
-- ===========================================================================
-- Worth knowing before deciding who can read it. Additional Information is
-- where a student explains a bad semester: a death in the family, an illness, a
-- diagnosis, a period of homelessness, an immigration issue. It is frequently
-- the most sensitive free text in the whole application.
--
-- Access here is the same shared rule as the rest of the record — every admin
-- at the student's school, the student, and any accepted linked parent can read
-- it. That is consistent, and consistency is the right default, but it is worth
-- a conscious decision rather than an inherited one: the parent case is the
-- pointed one, since a student may be explaining something they would not want
-- a linked parent to read. Tightening it later means a per-table policy here,
-- not a change to can_access_student(), which the whole schema depends on.
--
-- Depends on 010 (can_access_student, set_updated_at) and 003 (students).

-- ---------------------------------------------------------------------------
-- common_app_additional_info
-- ---------------------------------------------------------------------------

create table public.common_app_additional_info (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade
                         constraint common_app_additional_info_student_id_key unique,
  content    text,
  -- not null, unlike a bare `default now()`: the default only applies when the
  -- column is omitted, and a caller that explicitly writes null would otherwise
  -- leave a row with no modification time. Matches 021 and 022.
  updated_at timestamptz not null default now()
);

-- No separate index on student_id: the unique constraint creates one.

-- Fires on UPDATE only; an INSERT takes the column default.
create trigger common_app_additional_info_set_updated_at
  before update on public.common_app_additional_info
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.common_app_additional_info enable row level security;

create policy "Anyone with student access can view common app additional info"
  on public.common_app_additional_info
  for select
  to authenticated
  using (public.can_access_student(student_id));

create policy "Anyone with student access can add common app additional info"
  on public.common_app_additional_info
  for insert
  to authenticated
  with check (public.can_access_student(student_id));

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so the answer cannot be moved onto a student the caller has no access
-- to. Both halves matter for an upsert, which may take either path.
create policy "Anyone with student access can update common app additional info"
  on public.common_app_additional_info
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

-- No DELETE policy. See the header.
