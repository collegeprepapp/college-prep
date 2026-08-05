-- 015_activities_and_honors.sql
-- Extracurricular activities and honors/awards, the two list sections a
-- Common App activities section is built from.
--
-- ===========================================================================
-- ACCESS MODEL
-- ===========================================================================
-- Both tables follow scholarships (013) exactly: shared, not authored. Everyone
-- who can see the student's record — an admin at their school, the student
-- themselves, or an accepted linked parent — can read and fully manage every
-- row. A counselor and a student build these lists together, so
-- author-ownership would only get in the way.
--
-- added_by records who first added a row. It is bookkeeping, not access
-- control: it grants nothing, and anyone with student access can still edit or
-- delete a row someone else added.
--
-- REUSED FROM 010, not redefined here:
--   public.can_access_student(uuid) — the admin / student / linked-parent test
--   public.set_updated_at()         — generic updated_at trigger function
--
-- ORDERING: sort_order exists so a student can rank these by importance, which
-- is how application forms want them. Nothing in the database keeps the values
-- unique, contiguous, or gap-free — the application decides what a reorder
-- means, and ties should be broken by a second sort key (name or created_at)
-- rather than left to chance.
--
-- YEAR FIELDS ARE TEXT, not integer, on purpose. Real answers are ranges and
-- grade levels — "2024-2026", "9th-12th", "Junior year" — not a single number.
--
-- Depends on 001-014.

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------

create table public.activities (
  id                 uuid        primary key default gen_random_uuid(),
  student_id         uuid        not null references public.students (id) on delete cascade,
  name               text        not null,
  years_participated text,
  -- The two figures the Common App asks for alongside each activity. Integers
  -- (unlike the year fields) because they are genuinely counts, and nullable
  -- because a student often adds an activity before knowing them. Left
  -- unconstrained: a "20 hours/week, 52 weeks/year" claim is a conversation for
  -- a counselor to have, not something to reject at the database.
  hours_per_week     integer,
  weeks_per_year     integer,
  description        text,
  leadership_actions text,
  sort_order         integer     not null default 0,
  added_by           uuid        references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index activities_student_id_idx on public.activities (student_id);

create trigger activities_set_updated_at
  before update on public.activities
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- honors
-- ---------------------------------------------------------------------------

create table public.honors (
  id                uuid        primary key default gen_random_uuid(),
  student_id        uuid        not null references public.students (id) on delete cascade,
  name              text        not null,
  year_earned       text,
  organization_name text,
  description       text,
  sort_order        integer     not null default 0,
  added_by          uuid        references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index honors_student_id_idx on public.honors (student_id);

create trigger honors_set_updated_at
  before update on public.honors
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: activities
-- ---------------------------------------------------------------------------
-- Every policy is the same single test, because access is all-or-nothing per
-- student rather than per row.

alter table public.activities enable row level security;

create policy "Anyone with student access can view activities"
  on public.activities
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else. Null stays permitted so service-role tooling and imports —
-- where auth.uid() is null — are not forced to invent an author.
create policy "Anyone with student access can add activities"
  on public.activities
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so an activity cannot be moved onto a student the caller has no
-- access to. As in 011/013/014, added_by is not pinned here — RLS cannot
-- compare against the old value.
create policy "Anyone with student access can update activities"
  on public.activities
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete activities"
  on public.activities
  for delete
  to authenticated
  using (public.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Row Level Security: honors
-- ---------------------------------------------------------------------------
-- Identical to activities above.

alter table public.honors enable row level security;

create policy "Anyone with student access can view honors"
  on public.honors
  for select
  to authenticated
  using (public.can_access_student(student_id));

create policy "Anyone with student access can add honors"
  on public.honors
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

create policy "Anyone with student access can update honors"
  on public.honors
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete honors"
  on public.honors
  for delete
  to authenticated
  using (public.can_access_student(student_id));
