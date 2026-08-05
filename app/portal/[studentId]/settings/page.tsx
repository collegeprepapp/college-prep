import { getPortalViewer } from '../../access'
import { ChangePasswordForm } from './change-password-form'

export default async function PortalSettingsPage() {
  // Nothing here is student-scoped — it is the signed-in user's own account —
  // but the guard runs anyway so this page is not the one exception in the
  // portal that skips it. The action re-derives the user from the session.
  await getPortalViewer()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm opacity-70">Your account.</p>
      </div>

      <ChangePasswordForm />
    </div>
  )
}
