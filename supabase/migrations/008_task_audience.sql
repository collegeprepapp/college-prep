-- 008_task_audience.sql
-- Adds an audience to timeline tasks: some steps are the student's to do, some
-- are the parent's, some are shared.
--
-- ===========================================================================
-- AUDIENCE / COMPLETION PERMISSION MODEL
-- ===========================================================================
-- Who may check a task off is decided in two places, and you have to read both
-- together to understand the behavior:
--
--   1. RLS policies (below) decide WHO CAN TOUCH THE ROW at all:
--        - admins            -> any task in their school   (from 007)
--        - the student       -> their own tasks            (from 007)
--        - linked parents    -> their child's tasks        (added here)
--
--   2. The BEFORE UPDATE trigger (below) decides WHAT THEY MAY CHANGE, and
--      enforces the audience:
--        - admin           -> unrestricted. Can edit any column, any audience.
--        - the student     -> completed / completed_at only, and only when
--                             audience is 'student' or 'both'.
--        - linked parent   -> completed / completed_at only, and only when
--                             audience is 'parent' or 'both'.
--
-- Two different failure modes, on purpose:
--
--   * WRONG COLUMN -> silently ignored. A non-admin who submits a change to
--     title, description, icon, audience, etc. gets a successful update in
--     which those columns kept their old values. This matches the behavior
--     introduced in 007; a PATCH that includes untouched fields is normal
--     client behavior and should not fail.
--
--   * WRONG AUDIENCE -> hard rejection. A student trying to complete a
--     parent-only task (or vice versa) raises an exception and the whole
--     statement aborts. This is a real authorization error, not sloppy input,
--     so it must not look like it succeeded.
--
-- The audience is read from the STORED row (old.audience), never from the
-- incoming one, so a caller cannot widen their own permission by submitting a
-- new audience in the same statement.
--
-- APPLICATION CODE: the auto-surfacing step described in 007 copies title,
-- description, and icon from timeline_templates into assigned_tasks. It must
-- now copy audience as well — a task that silently defaults to 'student' would
-- be invisible to the parent it was written for. No such code exists in the
-- repo yet, so there is nothing to update today; this is a note for whoever
-- builds it.
--
-- Depends on 001-007.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
-- Existing rows in both tables become 'student', which matches how 007 behaved
-- before this migration existed.

alter table public.timeline_templates
  add column audience text not null default 'student'
    check (audience in ('student', 'parent', 'both'));

alter table public.assigned_tasks
  add column audience text not null default 'student'
    check (audience in ('student', 'parent', 'both'));

-- ---------------------------------------------------------------------------
-- Parent update access
-- ---------------------------------------------------------------------------
-- Parents already had select on assigned_tasks from 007. This adds update, so a
-- parent can check off the steps that are theirs. The audience half of the rule
-- lives in the trigger below, not here — a policy cannot see which columns an
-- UPDATE touched.

create policy "Linked parents can complete their child's tasks"
  on public.assigned_tasks
  for update
  to authenticated
  using (public.is_linked_parent_of(student_id))
  with check (public.is_linked_parent_of(student_id));

-- ---------------------------------------------------------------------------
-- Replace the completion-restriction trigger
-- ---------------------------------------------------------------------------
-- 007's version knew only about students. Dropped and rebuilt under a name that
-- reflects what it now covers.

drop trigger if exists assigned_tasks_restrict_student_columns
  on public.assigned_tasks;
drop function if exists public.enforce_assigned_task_student_columns();

create or replace function public.enforce_assigned_task_completion_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
  caller_is_student boolean;
  caller_is_parent boolean;
begin
  -- No JWT: service_role, or a direct database connection. RLS is being
  -- bypassed anyway, so this guard does not apply.
  if auth.uid() is null then
    return new;
  end if;

  caller_role := public.get_my_role();

  if caller_role in ('system_admin', 'school_admin') then
    return new;
  end if;

  select exists (
    select 1
    from public.students s
    where s.id = old.student_id
      and s.profile_id = auth.uid()
  )
  into caller_is_student;

  caller_is_parent := public.is_linked_parent_of(old.student_id);

  -- Audience gate. Checked against the stored row, so submitting a different
  -- audience in the same UPDATE cannot unlock anything.
  if caller_is_student then
    if old.audience not in ('student', 'both') then
      raise exception
        'This task is assigned to the parent, not the student.'
        using errcode = 'check_violation';
    end if;
  elsif caller_is_parent then
    if old.audience not in ('parent', 'both') then
      raise exception
        'This task is assigned to the student, not the parent.'
        using errcode = 'check_violation';
    end if;
  else
    -- RLS should already have filtered this row out; reaching here means the
    -- policies and this trigger have drifted apart.
    raise exception
      'Not permitted to update this task.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Column gate: completed and completed_at are the only fields a non-admin can
  -- move. Everything else is reset to its stored value rather than raising, so a
  -- full-row PATCH from a client still succeeds.
  new.id          := old.id;
  new.student_id  := old.student_id;
  new.template_id := old.template_id;
  new.title       := old.title;
  new.description := old.description;
  new.icon        := old.icon;
  new.assigned_by := old.assigned_by;
  new.created_at  := old.created_at;
  new.audience    := old.audience;

  return new;
end;
$$;

create trigger assigned_tasks_enforce_completion_rules
  before update on public.assigned_tasks
  for each row
  execute function public.enforce_assigned_task_completion_rules();
