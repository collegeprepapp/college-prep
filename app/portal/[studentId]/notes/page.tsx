import { getPortalViewer } from '../../access'
import { fetchNotes } from '@/lib/student-record/queries'
import { NotesTab } from '@/components/student-tabs/notes-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const notes = await fetchNotes(supabase, studentId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm opacity-70">Notes shared with you, plus any you have written yourself.</p>
      </div>

      <NotesTab
        notes={notes}
        studentId={studentId}
        viewerProfileId={user?.id ?? ''}
      />
    </div>
  )
}
