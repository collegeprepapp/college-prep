import { getPortalViewer } from '../../access'
import {
  fetchActivities,
  fetchHonors,
} from '@/lib/student-record/queries'
import { ActivitiesTab } from '@/components/student-tabs/activities-tab'
import { HonorsTab } from '@/components/student-tabs/honors-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  // One route, two sections: they are ranked lists for the same part of an
  // application, and splitting them would double the nav for no benefit.
  const activities = await fetchActivities(supabase, studentId)
  const honors = await fetchHonors(supabase, studentId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activities & Honors</h1>
        <p className="mt-1 text-sm opacity-70">Ranked for the Common App — drag to change the order.</p>
      </div>

      <ActivitiesTab activities={activities} studentId={studentId} />

      <div className="border-t border-black/10 pt-6 dark:border-white/15">
        <HonorsTab honors={honors} studentId={studentId} />
      </div>
    </div>
  )
}
