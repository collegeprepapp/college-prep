'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { updateSchoolName } from './actions'

/**
 * School name, edited in place. Slug is displayed but never editable —
 * migration 009's trigger reverts any change to it, so it is shown as the fixed
 * identifier it is.
 */
export function SchoolSection({
  schoolId,
  name,
  slug,
  otherSchoolCount,
}: {
  schoolId: string
  name: string
  slug: string
  /** Schools this viewer can see beyond this one; only system_admin has any. */
  otherSchoolCount: number
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setValue(name)
    setError(null)
    setJustSaved(false)
    setIsEditing(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateSchoolName(schoolId, value)
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
      <div>
        <h2 className="text-lg font-medium">School Info</h2>
        {otherSchoolCount > 0 && (
          <p className="mt-1 text-sm opacity-70">
            Editing <span className="font-medium">{name}</span>. You can see{' '}
            {otherSchoolCount} other{' '}
            {otherSchoolCount === 1 ? 'school' : 'schools'} — switching between
            them is not built yet.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide opacity-60">
              {isEditing ? (
                <label htmlFor="settings-school-name">School Name</label>
              ) : (
                'School Name'
              )}
            </dt>
            <dd className="mt-0.5">
              {isEditing ? (
                <input
                  id="settings-school-name"
                  type="text"
                  required
                  disabled={isSaving}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className={INPUT_CLASS}
                />
              ) : (
                <span className="text-sm">{name}</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide opacity-60">
              Identifier
            </dt>
            <dd className="mt-0.5 font-mono text-sm opacity-70">{slug}</dd>
          </div>
        </dl>

        {error && <ErrorBanner message={error} />}

        {justSaved && !isEditing && (
          <p className="text-sm opacity-70">School name saved.</p>
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
            Edit school name
          </button>
        )}
      </form>
    </section>
  )
}
