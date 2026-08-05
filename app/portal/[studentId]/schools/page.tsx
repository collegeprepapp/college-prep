import { getPortalViewer } from '../../access'
import { fetchApplications } from '@/lib/student-record/queries'
import { SchoolsTab } from '@/components/student-tabs/schools-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  const applications = await fetchApplications(supabase, studentId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        <p className="mt-1 text-sm opacity-70">The college list, with deadlines and application status.</p>
      </div>

      <SchoolsTab applications={applications} studentId={studentId} />
    </div>
  )
}
