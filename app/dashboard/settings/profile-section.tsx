'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { updateOwnProfile } from './actions'

/**
 * First/last name, edited in place: clicking Edit swaps each value for an input
 * in the same grid cell, matching the portal's My Info page.
 *
 * Role and school are shown but never editable — migration 009's trigger
 * reverts changes to either, for admins as well, so offering them would be a
 * field that silently does nothing.
 */
export function ProfileSection({
  firstName,
  lastName,
  role,
  schoolName,
}: {
  firstName: string
  lastName: string
  role: string
  schoolName: string | null
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState({ firstName, lastName })
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setValues({ firstName, lastName })
    setError(null)
    setJustSaved(false)
    setIsEditing(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateOwnProfile(values.firstName, values.lastName)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setIsEditing(false)
    setJustSaved(true)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">My Profile</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide opacity-60">
              {isEditing ? (
                <label htmlFor="settings-first-name">First Name</label>
              ) : (
                'First Name'
              )}
            </dt>
            <dd className="mt-0.5">
              {isEditing ? (
                <input
                  id="settings-first-name"
                  type="text"
                  required
                  autoComplete="given-name"
                  disabled={isSaving}
                  value={values.firstName}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      firstName: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              ) : (
                <span className="text-sm">{firstName || '—'}</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide opacity-60">
              {isEditing ? (
                <label htmlFor="settings-last-name">Last Name</label>
              ) : (
                'Last Name'
              )}
            </dt>
            <dd className="mt-0.5">
              {isEditing ? (
                <input
                  id="settings-last-name"
                  type="text"
                  required
                  autoComplete="family-name"
                  disabled={isSaving}
                  value={values.lastName}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      lastName: event.target.value,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              ) : (
                <span className="text-sm">{lastName || '—'}</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide opacity-60">Role</dt>
            <dd className="mt-0.5 text-sm">{role}</dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide opacity-60">
              School
            </dt>
            <dd className="mt-0.5 text-sm">{schoolName ?? '—'}</dd>
          </div>
        </dl>

        {error && <ErrorBanner message={error} />}

        {justSaved && !isEditing && (
          <p className="text-sm opacity-70">Profile saved.</p>
        )}

        {isEditing ? (
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className={`self-start ${SECONDARY_BUTTON_CLASS}`}
          >
            Edit my profile
          </button>
        )}
      </form>
    </section>
  )
}
