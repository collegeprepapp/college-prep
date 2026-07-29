import { redirect } from 'next/navigation'
import { getPortalViewer } from '../access'

/**
 * The access guard for everything under /portal/[studentId].
 *
 * The sidebar only ever links to permitted ids, but that is presentation — this
 * is the check that matters, because the id comes from the URL and anyone can
 * type one. getPortalViewer() rebuilds the permitted set from the database on
 * every request rather than trusting anything passed down.
 *
 * RLS is still the backstop underneath: a student id that slipped past this
 * would return no rows to the page queries anyway.
 */
export default async function PortalStudentLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  const { students } = await getPortalViewer()

  if (!students.some((student) => student.id === studentId)) {
    redirect('/portal')
  }

  return <>{children}</>
}
