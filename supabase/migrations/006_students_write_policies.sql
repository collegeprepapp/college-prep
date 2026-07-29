-- 006_students_write_policies.sql
-- Insert and update policies for public.students. Select policies stay as they
-- were in 003; this migration only adds write access.
--
-- NO STUDENT INSERT POLICY, deliberately. A student record has to be created by
-- an admin before that student can have a login linked to it (students.profile_id
-- points at a profile that does not exist yet at CRM-entry time), so there is no
-- situation where a student role legitimately creates their own row. Only
-- school_admin and system_admin can insert.
--
-- NO DELETE POLICIES either — deletes remain service-role only for now.
--
-- Depends on 001-005, including the SECURITY DEFINER helpers get_my_role() and
-- get_my_school_id().

-- Insert: school_admin may only create students inside their own school;
-- system_admin may create them anywhere. WITH CHECK is the only clause an insert
-- policy takes — it is evaluated against the row being written.
create policy "Admins can insert students"
  on public.students
  for insert
  to authenticated
  with check (
    public.get_my_role() = 'system_admin'
    or (
      public.get_my_role() = 'school_admin'
      and school_id = public.get_my_school_id()
    )
  );

-- Update (admins): USING picks which existing rows may be targeted, WITH CHECK
-- validates the row after the update. Both are spelled out rather than letting
-- WITH CHECK default to USING, so it is explicit that a school_admin can neither
-- reach into another school nor move a student out of their own.
create policy "Admins can update students in their school"
  on public.students
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

-- Update (self): a student with a linked login may update their own row.
--
-- WARNING — this is row-level, not column-level. RLS cannot restrict WHICH
-- columns an update touches, so this policy lets a student rewrite any field on
-- their own record, including gpa, class_rank, graduation_year, and school_id.
-- The WITH CHECK below only stops them from reassigning the row to someone else.
-- Narrowing this to safe columns requires column-level privileges, e.g.:
--
--   revoke update on public.students from authenticated;
--   grant update (first_name, last_name, email) on public.students to authenticated;
--
-- That is intentionally NOT done here, since it would also constrain admins and
-- changes the shape of what this migration was asked to do.
create policy "Students can update their own record"
  on public.students
  for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
