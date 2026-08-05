import { getPortalViewer } from '../../access'
import { fetchScholarships } from '@/lib/student-record/queries'
import { ScholarshipsTab } from '@/components/student-tabs/scholarships-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  const scholarships = await fetchScholarships(supabase, studentId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scholarships</h1>
        <p className="mt-1 text-sm opacity-70">Outside scholarships being researched or applied for.</p>
      </div>

      <ScholarshipsTab scholarships={scholarships} studentId={studentId} />
    </div>
  )
}
