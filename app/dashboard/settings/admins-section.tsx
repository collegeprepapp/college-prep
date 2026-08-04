'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { createSchoolAdmin } from './actions'

export type AdminRow = {
  id: string
  name: string
  role: string
}

const EMPTY_FORM = { firstName: '', lastName: '', email: '' }

export function AdminsSection({
  admins,
  schoolId,
}: {
  admins: AdminRow[]
  schoolId: string
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Held in memory only, and only until this component unmounts or the notice
  // is dismissed. Nothing persists it — there is no way to show it again.
  const [newPassword, setNewPassword] = useState<{
    email: string
    password: string
  } | null>(null)

  function close() {
    setIsOpen(false)
    setValues(EMPTY_FORM)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await createSchoolAdmin(
      values.firstName,
      values.lastName,
      values.email,
      schoolId
    )

    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setNewPassword({
      email: values.email.trim(),
      password: result.temporaryPassword,
    })
    close()
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">Manage Admins</h2>
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add Admin
          </button>
        )}
      </div>

      {newPassword && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium">
            Temporary password for {newPassword.email}
          </p>
          <code className="select-all rounded border border-black/10 bg-black/5 px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-white/10">
            {newPassword.password}
          </code>
          <p className="text-xs opacity-80">
            Share this password with them now — it will not be shown again. If
            it is lost, they will need a password reset.
          </p>
          <button
            type="button"
            onClick={() => setNewPassword(null)}
            className={`self-start ${SECONDARY_BUTTON_CLASS}`}
          >
            Done
          </button>
        </div>
      )}

      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-5 dark:border-white/15"
        >
          <h3 className="text-base font-medium">Add Admin</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-first-name" className="text-sm font-medium">
                First Name
              </label>
              <input
                id="admin-first-name"
                type="text"
                required
                autoComplete="off"
                disabled={isSubmitting}
                value={values.firstName}
                onChange={(event) =>
                  setValues((c) => ({ ...c, firstName: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-last-name" className="text-sm font-medium">
                Last Name
              </label>
              <input
                id="admin-last-name"
                type="text"
                required
                autoComplete="off"
                disabled={isSubmitting}
                value={values.lastName}
                onChange={(event) =>
                  setValues((c) => ({ ...c, lastName: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="off"
                disabled={isSubmitting}
                value={values.email}
                onChange={(event) =>
                  setValues((c) => ({ ...c, email: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? 'Creating…' : 'Create Admin'}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {admins.length === 0 ? (
        <p className="text-sm opacity-70">No admins found for this school.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr
                  key={admin.id}
                  className="border-b border-black/5 dark:border-white/10"
                >
                  <td className="py-2 pr-4 font-medium">{admin.name}</td>
                  <td className="py-2 pr-4 opacity-70">{admin.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
