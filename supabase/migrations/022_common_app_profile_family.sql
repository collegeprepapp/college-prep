-- 022_common_app_profile_family.sql
-- The Common App's Profile and Family sections.
--
-- Two shapes, both already established elsewhere in this schema:
--
--   common_app_profile        singleton, one row per student, like
--                             common_app_testing (021)
--   common_app_family_members list, ranked, like activities/honors (015)
--
-- ===========================================================================
-- common_app_profile IS A SINGLETON
-- ===========================================================================
-- student_id is UNIQUE — a student has one profile, not a list of them. Same
-- two consequences as 021, repeated because they are easy to miss:
--
--   1. A blind INSERT succeeds once and fails afterwards with 23505. Writes
--      should UPSERT. student_id carries a plain unique constraint, so ON
--      CONFLICT inference works:
--
--        .upsert({ student_id, ... }, { onConflict: 'student_id' })
--
--   2. No row exists until someone saves, so reads need maybeSingle() and the
--      form needs an empty state.
--
-- No delete policy, matching 021: clearing the profile means blanking its
-- fields. Deleting would only return the student to their starting state, and
-- the next upsert would recreate the row.
--
-- No added_by either — with one row per student, "who last touched the shared
-- answer" is what updated_at already records.
--
-- ===========================================================================
-- THIS IS THE MOST SENSITIVE TABLE IN THE SCHEMA
-- ===========================================================================
-- Between them these two tables hold a minor's legal name, home address, phone
-- number, personal email, and their family's occupations, employers, and
-- education levels.
--
-- Two things follow from that, neither of which SQL can enforce:
--
--   * The family rows describe people who are NOT users of this system and
--     never agreed to be in it. They cannot see or correct what is recorded
--     about them, so whatever retention or deletion policy the school operates
--     has to cover these rows, not just student-owned data.
--
--   * Access is the same shared rule as everywhere else: every admin at the
--     student's school, the student, and any accepted linked parent can read
--     ALL of it. That is deliberate and matches how the rest of the record
--     works — but it is a wider audience than a home address usually gets, and
--     is worth a conscious decision rather than an inherited default. Tightening
--     it later means per-table policies, not a change to can_access_student().
--
-- Nothing here is validated in SQL. Addresses, phone numbers, and country names
-- vary too much to constrain usefully, and this is a draft where a half-filled
-- profile has to be saveable.
--
-- Depends on 010 (helpers) and 003 (students).

-- ---------------------------------------------------------------------------
-- common_app_profile
-- ---------------------------------------------------------------------------

create table public.common_app_profile (
  id                   uuid        primary key default gen_random_uuid(),
  student_id           uuid        not null references public.students (id) on delete cascade
                                   constraint common_app_profile_student_id_key unique,
  -- Legal name as it appears on official documents, kept separate from the
  -- students table's first_name/last_name: those are what the school calls the
  -- student day to day, which is often not what the application needs.
  legal_first_name     text,
  legal_middle_name    text,
  legal_last_name      text,
  preferred_first_name text,
  address_line1        text,
  address_line2        text,
  city                 text,
  state                text,
  postal_code          text,
  country              text,
  phone                text,
  personal_email       text,
  updated_at           timestamptz not null default now()
);

-- No separate index on student_id: the unique constraint creates one.

-- Fires on UPDATE only; an INSERT takes the column default.
create trigger common_app_profile_set_updated_at
  before update on public.common_app_profile
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- common_app_family_members
-- ---------------------------------------------------------------------------

create table public.common_app_family_members (
  id              uuid        primary key default gen_random_uuid(),
  student_id      uuid        not null references public.students (id) on delete cascade,
  relationship    text,
  full_name       text,
  occupation      text,
  employer        text,
  education_level text,
  -- Ranked so the order on the application is deliberate. Nothing enforces
  -- uniqueness or contiguity, so order by (sort_order, full_name) to keep ties
  -- from shifting between page loads.
  sort_order      integer     not null default 0,
  added_by        uuid        references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index common_app_family_members_student_id_idx
  on public.common_app_family_members (student_id);

create trigger common_app_family_members_set_updated_at
  before update on public.common_app_family_members
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: common_app_profile
-- ---------------------------------------------------------------------------

alter table public.common_app_profile enable row level security;

create policy "Anyone with student access can view common app profile"
  on public.common_app_profile
  for select
  to authenticated
  using (public.can_access_student(student_id));

create policy "Anyone with student access can add common app profile"
  on public.common_app_profile
  for insert
  to authenticated
  with check (public.can_access_student(student_id));

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change. Both halves matter for an upsert, which may take either path.
create policy "Anyone with student access can update common app profile"
  on public.common_app_profile
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

-- No DELETE policy. See the header.

-- ---------------------------------------------------------------------------
-- Row Level Security: common_app_family_members
-- ---------------------------------------------------------------------------
-- The list pattern from 015, delete included: a family member added by mistake
-- should be removable, unlike the profile which is blanked rather than dropped.

alter table public.common_app_family_members enable row level security;

create policy "Anyone with student access can view common app family"
  on public.common_app_family_members
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else. Null stays permitted so service-role tooling and imports —
-- where auth.uid() is null — are not forced to invent an author.
create policy "Anyone with student access can add common app family"
  on public.common_app_family_members
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- As elsewhere, added_by is not pinned here — RLS cannot compare against the
-- old value, so making it immutable would need a BEFORE UPDATE trigger.
create policy "Anyone with student access can update common app family"
  on public.common_app_family_members
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete common app family"
  on public.common_app_family_members
  for delete
  to authenticated
  using (public.can_access_student(student_id));
