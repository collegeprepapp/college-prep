import { getPortalViewer } from '../../access'
import {
  fetchActivities,
  fetchCommonAppPlanner,
  fetchCommonAppTesting,
  fetchHonors,
  fetchTestScores,
} from '@/lib/student-record/queries'
import { CommonAppTab } from '@/components/student-tabs/common-app-tab'

export default async function PortalCommonAppPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  // The working lists feed the "based on" labels and dropdowns; the real test
  // scores feed the "Insert from Test Scores" control.
  const [activities, honors, testScores] = await Promise.all([
    fetchActivities(supabase, studentId),
    fetchHonors(supabase, studentId),
    fetchTestScores(supabase, studentId),
  ])

  const {
    commonAppActivities,
    commonAppHonors,
    activitySources,
    honorSources,
  } = await fetchCommonAppPlanner(supabase, studentId, activities, honors)

  const { testing, scoreOptions } = await fetchCommonAppTesting(
    supabase,
    studentId,
    testScores
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Common App Planner
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Your activities and honors, written the way the application asks for
          them.
        </p>
      </div>

      <CommonAppTab
        activities={commonAppActivities}
        honors={commonAppHonors}
        activitySources={activitySources}
        honorSources={honorSources}
        testing={testing}
        scoreOptions={scoreOptions}
        studentId={studentId}
      />
    </div>
  )
}
