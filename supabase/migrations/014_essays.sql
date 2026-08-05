-- 014_essays.sql
-- Student essays, plus an append-only history of saved revisions.
--
-- ===========================================================================
-- ACCESS MODEL
-- ===========================================================================
-- essays follows college_applications (011) and scholarships (013): shared, not
-- authored. Everyone who can see the student's record — an admin at their
-- school, the student themselves, or an accepted linked parent — can read and
-- fully manage every essay. A counselor editing a draft alongside the student
-- is the point of the feature, so author-ownership would get in the way.
--
-- added_by records who created the essay; saved_by records who saved a given
-- revision. Both are bookkeeping, not access control.
--
-- essay_versions is INTENTIONALLY IMMUTABLE. It has select and insert policies
-- and no update or delete policy at all, so under RLS a revision cannot be
-- altered or removed once written — that is what makes the history worth
-- trusting. Deleting the parent essay still cascades the versions away, and
-- service_role bypasses RLS entirely, so this is durability against ordinary
-- app traffic, not a legal retention guarantee.
--
-- REUSED FROM 010, not redefined here:
--   public.can_access_student(uuid) — the admin / student / linked-parent test
--   public.set_updated_at()         — generic updated_at trigger function
--
-- NOT AUTOMATED HERE: nothing writes an essay_versions row automatically. The
-- application decides when a save is worth snapshotting, and keeps
-- essays.word_count in step with essays.content. Neither is enforced by the
-- database, so a buggy client can leave word_count stale or skip a revision.
--
-- Depends on 001-013.

-- ---------------------------------------------------------------------------
-- essays
-- ---------------------------------------------------------------------------

create table public.essays (
  id                     uuid        primary key default gen_random_uuid(),
  student_id             uuid        not null references public.students (id) on delete cascade,
  -- Set for a supplemental tied to one school. ON DELETE SET NULL so removing a
  -- school from the college list never destroys the essay written for it — the
  -- essay survives, detached.
  college_application_id uuid        references public.college_applications (id) on delete set null,
  title                  text        not null,
  prompt                 text,
  -- Named explicitly so a future migration can alter the vocabulary without
  -- first having to discover the auto-generated constraint name (see 012).
  essay_type             text        not null default 'common_app'
                                     constraint essays_essay_type_check
                                     check (
                                       essay_type in (
                                         'common_app',
                                         'supplemental',
                                         'scholarship',
                                         'other'
                                       )
                                     ),
  -- Defaults to empty rather than null: an essay always has a body, it just
  -- starts blank. Keeps the editor from having to handle a null document.
  content                text        not null default '',
  word_count             integer     not null default 0,
  added_by               uuid        references public.profiles (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index essays_student_id_idx on public.essays (student_id);
create index essays_college_application_id_idx
  on public.essays (college_application_id);

create trigger essays_set_updated_at
  before update on public.essays
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- essay_versions
-- ---------------------------------------------------------------------------
-- No updated_at column and no trigger: a revision is written once and never
-- changes, so there is nothing to keep current.

create table public.essay_versions (
  id         uuid        primary key default gen_random_uuid(),
  essay_id   uuid        not null references public.essays (id) on delete cascade,
  content    text        not null,
  word_count integer     not null,
  saved_by   uuid        references public.profiles (id),
  created_at timestamptz not null default now()
);

-- Composite, descending on created_at: history is read newest-first for one
-- essay at a time, so this serves both the lookup and the ordering from a
-- single index scan rather than sorting afterward.
create index essay_versions_essay_id_created_at_idx
  on public.essay_versions (essay_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: essays
-- ---------------------------------------------------------------------------

alter table public.essays enable row level security;

create policy "Anyone with student access can view essays"
  on public.essays
  for select
  to authenticated
  using (public.can_access_student(student_id));

-- The added_by clause makes the column a record rather than a claim: a caller
-- may stamp their own id or leave it null, but cannot attribute the row to
-- someone else. Null stays permitted so service-role tooling and imports —
-- where auth.uid() is null — are not forced to invent an author.
create policy "Anyone with student access can add essays"
  on public.essays
  for insert
  to authenticated
  with check (
    public.can_access_student(student_id)
    and (added_by is null or added_by = auth.uid())
  );

-- USING picks which rows may be targeted; WITH CHECK re-tests the row after the
-- change, so an essay cannot be moved onto a student the caller has no access
-- to. As in 011/013, added_by is not pinned here — RLS cannot compare against
-- the old value, so making it immutable would need a BEFORE UPDATE trigger.
create policy "Anyone with student access can update essays"
  on public.essays
  for update
  to authenticated
  using (public.can_access_student(student_id))
  with check (public.can_access_student(student_id));

create policy "Anyone with student access can delete essays"
  on public.essays
  for delete
  to authenticated
  using (public.can_access_student(student_id));

-- ---------------------------------------------------------------------------
-- Row Level Security: essay_versions
-- ---------------------------------------------------------------------------
-- essay_versions carries no student_id of its own; access is reached through
-- the parent essay. The subquery on public.essays is evaluated as the caller,
-- so essays' own select policy applies to it as well — the two agree today, but
-- tightening essays' select would narrow version visibility with it.
--
-- Note there is no UPDATE and no DELETE policy. That omission is the immutability.

alter table public.essay_versions enable row level security;

create policy "Anyone with student access can view essay versions"
  on public.essay_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.essays e
      where e.id = essay_versions.essay_id
        and public.can_access_student(e.student_id)
    )
  );

-- saved_by gets the same self-attribution check as added_by above. It matters
-- more here than anywhere else: a revision history whose authorship can be
-- forged at write time is not a history worth keeping.
create policy "Anyone with student access can add essay versions"
  on public.essay_versions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.essays e
      where e.id = essay_versions.essay_id
        and public.can_access_student(e.student_id)
    )
    and (saved_by is null or saved_by = auth.uid())
  );
