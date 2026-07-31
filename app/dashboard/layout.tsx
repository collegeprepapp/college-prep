import { redirect } from 'next/navigation'
import { getPortalAccess } from '../portal/access'
import { getViewer, isAdminRole } from './access'
import { DashboardNav } from './dashboard-nav'

/**
 * Admin chrome for everything under /dashboard.
 *
 * The redirect rule here cannot be the usual requireAdmin(): that sends
 * non-admins to /dashboard, which is this layout — an immediate loop. Nor can a
 * non-admin simply be sent to /portal, because the portal bounces viewers with
 * nothing to see back to /dashboard, which is the loop this project already hit
 * once. So the three cases are handled separately:
 *
 *   admin                       -> nav + children
 *   student/parent with records -> /portal
 *   anyone else                 -> children with NO admin nav
 *
 * That last case covers a student whose CRM record does not exist yet, a parent
 * whose invites are all pending, and profiles with no role at all. They fall
 * through to app/dashboard/page.tsx, which shows them an explanatory notice and
 * its own sign-out button. Admin-only pages beneath this layout still run their
 * own requireAdmin() and bounce such a viewer to /dashboard, where the notice
 * is — one hop, no cycle.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getViewer()

  if (isAdminRole(role)) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <DashboardNav />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    )
  }

  const access = await getPortalAccess()

  if (access.kind === 'portal') {
    redirect('/portal')
  }

  return <>{children}</>
}
