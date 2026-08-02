import 'server-only'

import { getViewer } from '../access'
import { AddStudentForm } from './add-student-form'
import { StudentTable } from './student-table'

/**
 * The student list, rendered at both /dashboard and /dashboard/students.
 *
 * Uses getViewer() rather than requireAdmin() on purpose: requireAdmin()
 * redirects non-admins to /dashboard, and this component renders AT /dashboard,
 * so that would be a redirect loop. app/dashboard/layout.tsx is what keeps
 * non-admins out of this whole section, and the RLS policies from 003 are the
 * real boundary underneath — a non-admin who somehow rendered this would get
 * back only rows the database already lets them see.
 *
 * Fetching stays here; the table and its search box are a client component,
 * since filtering happens in the browser against the already-loaded roster.
 */
export async function StudentList() {
  const { supabase, schoolId, role } = await getViewer()

  // No school filter here on purpose: the RLS policies from 003 already scope
  // school_admin to their own school and let system_admin see every school.
  const { data: students, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, graduation_year, gpa')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  // RLS scopes this: school_admin sees only their own school, system_admin
  // sees all. Empty means migration 009's select policy is not applied yet, and
  // SchoolField falls back to a raw UUID input.
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .order('name', { ascending: true })

  const rows = students ?? []

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Students</h1>

      <AddStudentForm
        schoolId={schoolId}
        schools={schools ?? []}
        role={role}
      />

      {error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Could not load students: {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="text-sm opacity-70">No students yet.</p>
      )}

      {rows.length > 0 && <StudentTable students={rows} />}
    </main>
  )
}
