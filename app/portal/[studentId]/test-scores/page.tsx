import { getPortalViewer } from '../../access'
import { fetchTestScores } from '@/lib/student-record/queries'
import { TestScoresTab } from '@/components/student-tabs/test-scores-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  const scores = await fetchTestScores(supabase, studentId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Test Scores</h1>
        <p className="mt-1 text-sm opacity-70">SAT and ACT results on record.</p>
      </div>

      <TestScoresTab scores={scores} />
    </div>
  )
}
