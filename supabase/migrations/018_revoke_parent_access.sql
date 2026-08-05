-- 018_revoke_parent_access.sql
-- Lets a school take a parent's access away without destroying the record that
-- it was ever granted.
--
-- ===========================================================================
-- WHAT REVOKING DOES
-- ===========================================================================
-- Setting status to 'revoked' cuts the parent off everywhere at once, because
-- every parent-facing rule in the schema runs through is_linked_parent_of(),
-- and that function tests for status = 'accepted' specifically. One update
-- removes their access to:
--
--   students, test_scores, assigned_tasks   (via is_linked_parent_of directly)
--   notes, college_applications, scholarships, essays, activities, honors,
--   documents, and the storage objects behind them
--                                           (via can_access_student, which
--                                            calls is_linked_parent_of)
--
-- That breadth is the point — there is no second place to remember to update.
--
-- The row itself is kept rather than deleted, so the history of who was granted
-- access, by whom, and when it was taken away survives. Deleting a link is
-- reserved for invites that were never accepted (see cancelPendingInvite in the
-- application), where there is no history worth keeping.
--
-- A revoked parent can still see their own link row through
-- parent_student_links_safe — its WHERE clause matches on parent_profile_id
-- regardless of status — so the portal can tell them access ended rather than
-- silently showing nothing.
--
-- NO RLS CHANGES. The raw table has had zero policies for regular users since
-- 005; every write here happens through service-role server actions that do
-- their own caller checks.
--
-- Depends on 001-017.

-- ---------------------------------------------------------------------------
-- status vocabulary
-- ---------------------------------------------------------------------------
-- VERIFIED against the live database on 2026-08-05: the constraint 005 created
-- inline is named parent_student_links_status_check, and 'revoked' is rejected
-- today (23514), so this widening is doing real work. Recreated under the same
-- name, spelled out explicitly this time so a future migration need not go
-- discover it.

alter table public.parent_student_links
  drop constraint if exists parent_student_links_status_check;

alter table public.parent_student_links
  add constraint parent_student_links_status_check
  check (status in ('pending', 'accepted', 'revoked'));

alter table public.parent_student_links
  add column revoked_at timestamptz;

-- ---------------------------------------------------------------------------
-- Uniqueness has to become partial, or revocation is a one-way door
-- ---------------------------------------------------------------------------
-- VERIFIED live: the constraint from 005 is
-- parent_student_links_unique_parent_student, unique on
-- (student_id, parent_profile_id) across ALL rows.
--
-- That breaks re-granting. Revoke parent P for student S and the row
-- (S, P, revoked) stays. Invite P again and they accept: acceptance sets
-- parent_profile_id on the new row, producing a second (S, P) pair and a
-- duplicate key error — so a revoked parent could never be re-admitted without
-- someone deleting the historical row by hand, which is the very thing keeping
-- the row was meant to avoid.
--
-- Replaced with a PARTIAL unique index limited to accepted links: at most one
-- live link per parent per student, with any number of revoked ones alongside.
-- Partial uniqueness cannot be a table constraint, so this becomes an index.
--
-- Unchanged from before: parent_profile_id is null until acceptance and
-- Postgres treats nulls as distinct, so a student can still have any number of
-- pending invites outstanding.

alter table public.parent_student_links
  drop constraint if exists parent_student_links_unique_parent_student;

create unique index parent_student_links_one_accepted_parent_idx
  on public.parent_student_links (student_id, parent_profile_id)
  where status = 'accepted';

-- ---------------------------------------------------------------------------
-- is_linked_parent_of() — confirmed correct, deliberately NOT redefined
-- ---------------------------------------------------------------------------
-- Checked against migration 005 (the only place it is defined; no later
-- migration touches it). Its body is:
--
--   select exists (
--     select 1
--     from public.parent_student_links l
--     where l.student_id = target_student_id
--       and l.parent_profile_id = auth.uid()
--       and l.status = 'accepted'
--   );
--
-- The `status = 'accepted'` test is an equality, not a "not pending" check, so
-- 'revoked' was already excluded the moment the value became representable —
-- no code change is needed and none is made here. Redefining it identically
-- would only create a second copy to keep in step.
--
-- The confirmation is attached to the function in the database as well as
-- stated here, so it is visible to anyone inspecting the schema directly.

comment on function public.is_linked_parent_of(uuid) is
  'True only for links with status = ''accepted''. Pending and revoked links '
  'both return false, so revoking access (migration 018) takes effect '
  'everywhere this function is used, immediately and without further changes.';
