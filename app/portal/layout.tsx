import { getPortalViewer } from './access'
import { PortalSidebar } from './portal-sidebar'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Redirects anonymous visitors to /login, and anyone who is not a student or
  // a linked parent to /dashboard.
  const { students } = await getPortalViewer()

  return (
    <div className="flex min-h-full flex-1">
      <PortalSidebar students={students} />
      <main className="flex-1 p-10">{children}</main>
    </div>
  )
}
