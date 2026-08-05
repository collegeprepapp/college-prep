import { getPortalViewer } from '../../access'
import { fetchDocuments } from '@/lib/student-record/queries'
import { DocsTab } from '@/components/student-tabs/docs-tab'

export default async function Page({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer;
  // RLS scopes every query below to what they may actually read.
  const { supabase } = await getPortalViewer()

  const documents = await fetchDocuments(supabase, studentId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm opacity-70">Transcripts, letters, and anything else on file.</p>
      </div>

      <DocsTab documents={documents} studentId={studentId} />
    </div>
  )
}
