import { getPortalViewer } from '../../access'
import { fetchParentLinks } from '@/lib/student-record/queries'
import { ParentsTab } from '@/components/student-tabs/parents-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase, role } = await getPortalViewer()

  const links = await fetchParentLinks(supabase, studentId)

  // createParentInvite authorizes admins and the student themselves, never a
  // parent — so a parent viewing this page sees the list without the invite
  // form. The action re-checks regardless.
  const canInvite = role === 'student'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Parent Access</h1>
        <p className="mt-1 text-sm opacity-70">Who can see this record, and invites not yet accepted.</p>
      </div>

      <ParentsTab
        links={links}
        studentId={studentId}
        canInvite={canInvite}
      />
    </div>
  )
}
