import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'
import { getPortalAccess } from '../portal/access'
import { getViewer, isAdminRole } from './access'
import { DashboardSidebar } from './dashboard-sidebar'

/**
 * Admin chrome for everything under /dashboard.
 *
 * The redirect rule here cannot be the usual requireAdmin(): that sends
 * non-admins to /dashboard, which is this layout — an immediate loop. Nor can a
 * non-admin simply be sent to /portal, because the portal bounces viewers with
 * nothing to see back to /dashboard, which is the loop this project already hit
 * once. So the three cases are handled separately:
 *
 *   admin                       -> sidebar + children
 *   student/parent with records -> /portal
 *   anyone else                 -> a notice, rendered here
 *
 * That last case covers a student whose CRM record does not exist yet, a parent
 * whose invites are all pending, and profiles with no role at all. The notice
 * lives in this layout rather than in a page so that no admin page below it has
 * to reason about non-admin viewers at all.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { role } = await getViewer()

  if (isAdminRole(role)) {
    return (
      <div className="flex min-h-full flex-1">
        <DashboardSidebar />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    )
  }

  const access = await getPortalAccess()

  if (access.kind === 'portal') {
    redirect('/portal')
  }

  const message =
    access.kind === 'empty' && access.role === 'parent'
      ? 'No students are linked to your account yet. Your school will send an invite when a record is ready.'
      : access.kind === 'empty'
        ? 'Your student record is not set up yet. Your school will finish this shortly.'
        : 'Your account does not have access to this area yet. Contact your school for help.'

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">College Prep</h1>
          <p className="mt-1 max-w-prose text-sm opacity-70">{message}</p>
        </div>
        <SignOutButton />
      </div>
    </main>
  )
}
