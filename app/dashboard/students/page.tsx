import Link from 'next/link'
import { requireAdmin } from './access'
import { AddStudentForm } from './add-student-form'

export default async function StudentsPage() {
  const { supabase, schoolId } = await requireAdmin()

  // No school filter here on purpose: the RLS policies from 003 already scope
  // school_admin to their own school and let system_admin see every school.
  const { data: students, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, graduation_year, gpa')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  const rows = students ?? []

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">College Prep</h1>
        <Link
          href="/dashboard"
          className="mt-1 inline-block text-sm underline opacity-70 hover:opacity-100"
        >
          ← Back to dashboard
        </Link>
      </div>

      <h2 className="text-lg font-medium">Students</h2>

      {/* requireAdmin() above means only admins ever reach this page. */}
      <AddStudentForm schoolId={schoolId} />

      {error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Could not load students: {error.message}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p className="text-sm opacity-70">No students yet.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                <th className="py-2 pr-4 font-medium">First Name</th>
                <th className="py-2 pr-4 font-medium">Last Name</th>
                <th className="py-2 pr-4 font-medium">Grad Year</th>
                <th className="py-2 pr-4 font-medium">GPA</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-black/5 dark:border-white/10"
                >
                  <td className="py-2 pr-4">{student.first_name}</td>
                  <td className="py-2 pr-4">{student.last_name}</td>
                  <td className="py-2 pr-4">{student.graduation_year}</td>
                  <td className="py-2 pr-4">{student.gpa ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/dashboard/students/${student.id}`}
                      className="underline opacity-70 hover:opacity-100"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
