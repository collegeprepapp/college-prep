import { getPortalViewer } from '../../access'
import { OverviewForm, type OverviewStudent } from './overview-form'

export default async function PortalOverviewPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer.
  const { supabase, role } = await getPortalViewer()

  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, graduation_year, gpa, class_rank, email')
    .eq('id', studentId)
    .maybeSingle()

  if (!student) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">My Info</h1>
        <p className="text-sm opacity-70">This record is not available.</p>
      </div>
    )
  }

  // Students edit their own record; linked parents read it. Migration 006 has no
  // parent update policy, so this only decides whether the form is offered — the
  // database refuses a parent write either way.
  const canEdit = role === 'student'

  const overviewStudent: OverviewStudent = {
    id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    graduation_year: student.graduation_year,
    gpa: student.gpa,
    class_rank: student.class_rank,
    email: student.email,
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Info</h1>
        <p className="mt-1 text-sm opacity-70">
          {student.first_name} {student.last_name}
          {role === 'parent' ? ' · view only' : ''}
        </p>
      </div>

      {/* The field grid lives in the client component so each value can swap
          to an input in place; canEdit renders it read-only for parents. */}
      <OverviewForm student={overviewStudent} canEdit={canEdit} />
    </div>
  )
}
