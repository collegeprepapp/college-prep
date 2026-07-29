-- 007_timeline.sql
-- College Timeline: per-school task templates, and the task rows students
-- actually work through.
--
-- AUTO-SURFACING MODEL — there is no scheduled job, no cron, no trigger that
-- creates tasks. Templates become real work lazily, driven by page visits:
--
--   1. A student's current grade is derived in application code from
--      students.graduation_year (the school year is not stored anywhere).
--   2. When someone opens that student's timeline, the app queries
--      timeline_templates for the student's school matching that grade level,
--      left-joined against existing assigned_tasks.
--   3. Any template with no matching assigned_tasks row is inserted right then,
--      copying title/description/icon and leaving assigned_by null.
--
-- assigned_by therefore carries meaning: null means "surfaced from a template
-- by this process", non-null means "an admin assigned this by hand".
--
-- The partial unique index below is what makes step 3 safe to run on every
-- visit — two concurrent page loads cannot double-insert the same template, the
-- second one conflicts. Application code should insert with ON CONFLICT DO
-- NOTHING rather than checking first, since a check-then-insert races.
--
-- Depends on 001-006, including get_my_role(), get_my_school_id(), and
-- is_linked_parent_of().

create table public.timeline_templates (
  id          uuid        primary key default gen_random_uuid(),
  school_id   uuid        not null references public.schools (id),
  title       text        not null,
  description text,
  -- A single emoji by convention. Not constrained: emoji can be multi-codepoint
  -- ZWJ sequences, so any length check either rejects valid input or is theater.
  icon        text,
  grade_level integer     not null check (grade_level between 6 and 12),
  season      text        not null
                          check (season in ('Fall', 'Winter', 'Spring', 'Summer')),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create table public.assigned_tasks (
  id           uuid        primary key default gen_random_uuid(),
  student_id   uuid        not null references public.students (id) on delete cascade,
  -- on delete set null: deleting a template must not delete work a student has
  -- already done. The task survives, detached from its origin.
  template_id  uuid        references public.timeline_templates (id) on delete set null,
  title        text        not null,
  description  text,
  icon         text,
  completed    boolean     not null default false,
  completed_at timestamptz,
  -- Null means auto-surfaced from a template; non-null means hand-assigned.
  assigned_by  uuid        references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- Partial, because template_id is nullable and Postgres treats nulls as
-- distinct: a plain unique constraint would not stop duplicates anyway, and
-- would wrongly limit how many hand-assigned (template_id null) tasks a student
-- can have.
create unique index assigned_tasks_student_template_idx
  on public.assigned_tasks (student_id, template_id)
  where template_id is not null;

create index timeline_templates_school_id_idx
  on public.timeline_templates (school_id);
create index assigned_tasks_student_id_idx
  on public.assigned_tasks (student_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: timeline_templates
-- ---------------------------------------------------------------------------

alter table public.timeline_templates enable row level security;

-- Everyone in the school reads templates, not just admins: students and parents
-- need them to understand what should be surfacing on the timeline.
create policy "School members can view their school's templates"
  on public.timeline_templates
  for select
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or school_id = public.get_my_school_id()
  );

create policy "Admins can insert templates for their school"
  on public.timeline_templates
  for insert
  to authenticated
  with check (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  );

create policy "Admins can update templates for their school"
  on public.timeline_templates
  for update
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  )
  with check (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  );

create policy "Admins can delete templates for their school"
  on public.timeline_templates
  for delete
  to authenticated
  using (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Row Level Security: assigned_tasks
-- ---------------------------------------------------------------------------
-- assigned_tasks carries no school_id of its own; every scoping rule reaches the
-- school through public.students. Split into one policy per audience rather than
-- one policy with three OR branches — permissive policies OR together, so the
-- result is identical, but each rule can be dropped or changed on its own.

alter table public.assigned_tasks enable row level security;

create policy "Admins can view tasks in their school"
  on public.assigned_tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and (
          public.get_my_role() = 'system_admin'
          or (
            public.get_my_role() = 'school_admin'
            and s.school_id = public.get_my_school_id()
          )
        )
    )
  );

create policy "Students can view their own tasks"
  on public.assigned_tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and s.profile_id = auth.uid()
    )
  );

create policy "Linked parents can view their child's tasks"
  on public.assigned_tasks
  for select
  to authenticated
  using (public.is_linked_parent_of(student_id));

create policy "Admins can insert tasks in their school"
  on public.assigned_tasks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and (
          public.get_my_role() = 'system_admin'
          or (
            public.get_my_role() = 'school_admin'
            and s.school_id = public.get_my_school_id()
          )
        )
    )
  );

create policy "Admins can update tasks in their school"
  on public.assigned_tasks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and (
          public.get_my_role() = 'system_admin'
          or (
            public.get_my_role() = 'school_admin'
            and s.school_id = public.get_my_school_id()
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and (
          public.get_my_role() = 'system_admin'
          or (
            public.get_my_role() = 'school_admin'
            and s.school_id = public.get_my_school_id()
          )
        )
    )
  );

-- Students check their own tasks off. See the trigger below for the "completed
-- and completed_at only" half of this rule — a policy cannot express it, because
-- RLS is row-level and has no way to see which columns an UPDATE touched.
create policy "Students can complete their own tasks"
  on public.assigned_tasks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      where s.id = assigned_tasks.student_id
        and s.profile_id = auth.uid()
    )
  );

-- No delete policies on assigned_tasks: deletes stay service-role only.

-- ---------------------------------------------------------------------------
-- Column-level guard for student updates
-- ---------------------------------------------------------------------------
-- The policy above lets a student update their own task row; on its own that
-- would also let them rewrite title, description, or reassign the task to
-- another student. WITH CHECK cannot compare against the old row, and column
-- GRANTs apply to the whole `authenticated` role (which would constrain admins
-- too), so the enforcement lives in a trigger.
--
-- Everything except completed / completed_at is reset to its previous value for
-- non-admin callers, making a stray column change a silent no-op instead of an
-- error. Drop this trigger and its function if you would rather handle it in
-- application code.

create or replace function public.enforce_assigned_task_student_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No JWT: service_role, or a direct database connection. RLS is being
  -- bypassed anyway, so this guard does not apply.
  if auth.uid() is null then
    return new;
  end if;

  if public.get_my_role() in ('system_admin', 'school_admin') then
    return new;
  end if;

  new.id          := old.id;
  new.student_id  := old.student_id;
  new.template_id := old.template_id;
  new.title       := old.title;
  new.description := old.description;
  new.icon        := old.icon;
  new.assigned_by := old.assigned_by;
  new.created_at  := old.created_at;

  return new;
end;
$$;

create trigger assigned_tasks_restrict_student_columns
  before update on public.assigned_tasks
  for each row
  execute function public.enforce_assigned_task_student_columns();
