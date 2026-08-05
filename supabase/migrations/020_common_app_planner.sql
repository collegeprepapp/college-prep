-- 020_common_app_planner.sql
-- A drafting space shaped like the Common App's own activity and honors
-- sections, separate from the working lists in public.activities and
-- public.honors.
--
-- ===========================================================================
-- WHY THESE ARE SEPARATE TABLES
-- ===========================================================================
-- activities/honors (015) are how a student tracks what they actually did:
-- loose, added over years, ranked by importance. These tables are what gets
-- typed into the application — the same material, reshaped into the exact
-- fields and vocabularies the form asks for, and edited without disturbing the
-- source list.
--
-- source_activity_id / source_honor_id record where an entry came from, so a
-- planner row can be traced back to the activity it was drafted from. ON DELETE
-- SET NULL, deliberately: removing an activity from the working list must not
-- silently delete application text a student has already written. The draft
-- survives, detached.
--
-- ===========================================================================
-- hours_per_week AND weeks_per_year ARE BACK — ON PURPOSE
-- ===========================================================================
-- Migration 019 removed exactly these two columns from public.activities and
-- replaced them with a single total_hours, because asking a student to model
-- their year is a bad way to CAPTURE what they did.
--
-- The Common App asks for them anyway. This table mirrors the form, so it has
-- to carry the form's fields — that is the whole point of it being a separate
-- table. Nothing derives one from the other: a student entering 220 total hours
-- in the working list still has to decide how that splits when drafting, and no
-- migration should try to guess for them.
--
-- numeric rather than integer, matching total_hours, so 2.5 hours a week is
-- representable.
--
-- ===========================================================================
-- ARRAY COLUMNS
-- ===========================================================================
-- participation_grades, participation_timing, and grade_level are text[]
-- because the form takes multiple selections ("9, 10, 11", "During school year,
-- During summer"). They are nullable AND can hold an empty array, which are
-- different states: null means never answered, '{}' means answered with nothing
-- selected. Application code should pick one to write and stick to it.
--
-- Values are not constrained to a vocabulary here. The Common App's option
-- lists change between cycles, and a check constraint would turn a form update
-- into a migration; the lists live in application code instead.
--
-- Everything except student_id and sort_order is nullable: this is a draft, and
-- a half-filled entry has to be saveable.
--
-- Access follows scholarships (013) exactly — shared, not authored. See there
-- for the reasoning.
--
-- Depends on 010 (helpers) and 015 (the source tables).

-- ---------------------------------------------------------------------------
-- common_app_activities
-- ---------------------------------------------------------------------------

create table public.common_app_activities (
  id                   uuid        primary key default gen_random_uuid(),
  student_id           uuid        not null references public.students (id) on delete cascade,
  source_activity_id   uuid        references public.activities (id) on delete set null,
  activity_type        text,
  position_title       text,
  organization_name    text,
  description          text,
  participation_grades text[],
  participation_timing text[],
  hours_per_week       numeric,
  weeks_per_year       numeric,
  continue_in_college  boolean,
  -- Ranked, like the source list. Nothing enforces uniqueness or contiguity, so
  -- order by (sort_order, position_title) to keep ties from shifting between
  -- page loads.
  sort_order           integer     not null default 0,
  added_by             uuid        references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index common_app_activities_student_id_idx
  on public.common_app_activities (student_id);
create index common_app_activities_source_activity_id_idx
  on public.common_app_activities (source_activity_id);

create trigger common_app_activities_set_updated_at
  before update on public.common_app_activities
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- common_app_honors
-- ---------------------------------------------------------------------------

create table public.common_app_honors (
  id                   uuid        primary key default gen_random_uuid(),
  student_id           uuid        not null references public.students (id) on delete cascade,
  source_honor_id      uuid        references public.honors (id) on delete set null,
  title                text,
  grade_level          text[],
  level_of_recognition text,
  description          text,
  sort_order           integer     not null default 0,
  added_by             uuid        references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index common_app_honors_student_id_idx
  on public.common_app_honors (student_id);
create index common_app_honors_source_honor_id_idx
  on public.common_app_honors (source_honor_id);

create trigger common_app_honors_set_updated_at
  before update on public.common_app_honors
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: common_app_activities
-- ---------------------------------------------------------------------------
-- Every policy is the same single test, because access is all-or-nothing per
-- student rather than per row.

alter table public.common_app_activities enable row level security;

create policy "Anyone with student access can view common app activities"
  on public.common_app_activities
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else. Null stays permitted so service-role tooling and imports —
-- where auth.uid() is null — are not forced to invent an author.
create policy "Anyone with student access can add common app activities"
  on public.common_app_activities
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so an entry cannot be moved onto a student the caller has no access
-- to. As elsewhere, added_by is not pinned here — RLS cannot compare against
-- the old value.
create policy "Anyone with student access can update common app activities"
  on public.common_app_activities
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete common app activities"
  on public.common_app_activities
  for delete
  to authenticated
  using (public.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Row Level Security: common_app_honors
-- ---------------------------------------------------------------------------
-- Identical to common_app_activities above.

alter table public.common_app_honors enable row level security;

create policy "Anyone with student access can view common app honors"
  on public.common_app_honors
  for select
  to authenticated
  using (public.can_access_student(student_id));

create policy "Anyone with student access can add common app honors"
  on public.common_app_honors
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

create policy "Anyone with student access can update common app honors"
  on public.common_app_honors
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete common app honors"
  on public.common_app_honors
  for delete
  to authenticated
  using (public.can_access_student(student_id));
