-- 010_notes.sql
-- Counselor / student / parent notes attached to a student record.
--
-- ===========================================================================
-- THE PRIVATE / SHARED MODEL
-- ===========================================================================
-- visibility has exactly two values and no per-role targeting:
--
--   'private' (the default)
--       Only the author can read the note. Not the student, not their parents,
--       not other admins at the same school, not even a system_admin. This is
--       the counselor's own working memory.
--
--   'shared'
--       Readable by anyone who can already see the student's record — admins
--       at that student's school, the student themselves, and accepted linked
--       parents. All of them, together. There is NO way to share with the
--       student but not the parent, or with one admin but not another.
--
-- If per-audience targeting is wanted later (the way assigned_tasks.audience
-- works in 008), it needs a new column and new policies; do not try to encode
-- it by convention in the content.
--
-- Authorship is separate from visibility. Only the author may edit or delete a
-- note, whatever its visibility — a shared note is readable by many and
-- writable by one.
--
-- Depends on 001-009, including get_my_role(), get_my_school_id(), and
-- is_linked_parent_of().

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------
-- "Can this caller see the student's record at all?" — the same three-way test
-- the students policies in 003/005 apply, expressed once so the note policies
-- below do not each restate it.
--
-- SECURITY DEFINER for the usual reason: it reads public.students, and running
-- as the owner keeps the check independent of whatever policies that table
-- carries. Empty search_path, so every reference is schema-qualified.

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    exists (
      select 1
      from public.students s
      where s.id = target_student_id
        and (
          public.get_my_role() = 'system_admin'
          or (
            public.get_my_role() = 'school_admin'
            and s.school_id = public.get_my_school_id()
          )
          -- The student themselves.
          or s.profile_id = auth.uid()
        )
    )
    -- Accepted parent links only; is_linked_parent_of() checks the status.
    or public.is_linked_parent_of(target_student_id)
  );
$$;

revoke execute on function public.can_access_student(uuid) from public;
grant execute on function public.can_access_student(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.notes (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students (id) on delete cascade,
  -- No ON DELETE here: a profile should not be removable while their notes
  -- stand, and losing authorship would orphan the edit/delete rules below.
  author_id  uuid        not null references public.profiles (id),
  content    text        not null,
  visibility text        not null default 'private'
                         check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_student_id_idx on public.notes (student_id);
create index notes_author_id_idx on public.notes (author_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- Generic on purpose: any future table with an updated_at column can attach
-- this same function rather than defining its own.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notes_set_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.notes enable row level security;

-- Two permissive select policies, OR'd together by Postgres: a caller reads a
-- note if they wrote it, OR if it is shared and they can see the student.
-- Splitting them keeps "private means author-only" legible on its own.

create policy "Authors can read their own notes"
  on public.notes
  for select
  to authenticated
  using (author_id = auth.uid());

create policy "Shared notes are readable by anyone with student access"
  on public.notes
  for select
  to authenticated
  using (
    visibility = 'shared'
    and public.can_access_student(student_id)
  );

-- Insert: you may write a note about a student whose record you can see, and
-- only under your own name. author_id = auth.uid() works because profiles.id is
-- the auth user id (migration 002).
create policy "Users with student access can add notes"
  on public.notes
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and public.can_access_student(student_id)
  );

-- Update: author only. The WITH CHECK repeats author_id so a note cannot be
-- signed over to someone else, and re-tests student access so an author cannot
-- move their note onto a student they have no business writing about — without
-- that, a shared note could be relocated into another school's records.
create policy "Authors can update their own notes"
  on public.notes
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and public.can_access_student(student_id)
  );

create policy "Authors can delete their own notes"
  on public.notes
  for delete
  to authenticated
  using (author_id = auth.uid());
