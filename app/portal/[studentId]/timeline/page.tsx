import { getPortalViewer } from '../../access'

export default async function PortalTimelinePage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The parent layout already verified this id is one of the viewer's, so the
  // lookup here is just to get the name.
  const { students } = await getPortalViewer()
  const student = students.find((candidate) => candidate.id === studentId)

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        {student ? `${student.first_name} ${student.last_name}` : 'Student'}
      </h1>
      <p className="text-sm opacity-70">Timeline coming next.</p>
    </div>
  )
}
