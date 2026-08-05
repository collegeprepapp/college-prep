import { getPortalViewer } from '../../access'
import {
  fetchApplications,
  fetchEssays,
} from '@/lib/student-record/queries'
import { EssaysTab } from '@/components/student-tabs/essays-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  // The college list feeds the "For School" dropdown on each essay.
  const applications = await fetchApplications(supabase, studentId)
  const { essays, essaySchools } = await fetchEssays(
    supabase,
    studentId,
    applications
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Essays</h1>
        <p className="mt-1 text-sm opacity-70">Drafts and their version history.</p>
      </div>

      <EssaysTab
        essays={essays}
        schools={essaySchools}
        studentId={studentId}
      />
    </div>
  )
}
