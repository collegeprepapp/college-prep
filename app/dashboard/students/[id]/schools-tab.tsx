'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  DEFAULT_APPLICATION_STATUS,
} from '@/lib/college-applications/status'
import {
  createApplication,
  deleteApplication,
  updateApplication,
  type ApplicationFormInput,
} from './applications-actions'

export type ApplicationRow = {
  id: string
  schoolName: string
  /** Stored lowercase value, e.g. 'applied'. */
  status: string
  /** Raw 'YYYY-MM-DD' for the date input, or '' when unset. */
  deadline: string
  /** Formatted on the server so the browser never re-derives a different date. */
  deadlineLabel: string
  notes: string
}

// One hue per status, same pill shape throughout. waitlisted uses orange rather
// than amber because amber is already 'applied' — the two are adjacent, so the
// label does the disambiguating and the colour only reinforces it. denied is
// deliberately the most muted: it is a closed outcome, not something to draw
// the eye on a list the student reads.
const STATUS_TONE: Record<string, string> = {
  researching: 'border-black/15 bg-black/5 dark:border-white/20 dark:bg-white/10',
  touring: 'border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400',
  applied:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  accepted:
    'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  committed:
    'border-purple-600/30 bg-purple-600/10 text-purple-700 dark:text-purple-400',
  waitlisted:
    'border-orange-600/30 bg-orange-600/10 text-orange-700 dark:text-orange-400',
  denied:
    'border-red-600/25 bg-red-600/5 text-red-700/80 dark:text-red-400/80',
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.researching

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {applicationStatusLabel(status)}
    </span>
  )
}

/**
 * The status <select>. Its option values are the stored lowercase strings and
 * its option text is the capitalized label, so the display-to-storage mapping
 * happens in both directions without a second lookup table.
 */
function StatusSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={INPUT_CLASS}
    >
      {APPLICATION_STATUSES.map((status) => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </select>
  )
}

const TD_CLASS = 'py-2 pr-4 align-top'

function ApplicationTableRow({
  application,
  studentId,
}: {
  application: ApplicationRow
  studentId: string
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<ApplicationFormInput>({
    schoolName: application.schoolName,
    status: application.status,
    deadline: application.deadline,
    notes: application.notes,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  function startEditing() {
    setValues({
      schoolName: application.schoolName,
      status: application.status,
      deadline: application.deadline,
      notes: application.notes,
    })
    setError(null)
    setIsConfirmingDelete(false)
    setIsEditing(true)
  }

  async function save() {
    setError(null)
    setIsSaving(true)

    const result = await updateApplication(application.id, studentId, values)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setIsEditing(false)
    router.refresh()
  }

  async function remove() {
    setError(null)
    setIsSaving(true)

    const result = await deleteApplication(application.id, studentId)
    setIsSaving(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    router.refresh()
  }

  if (isEditing) {
    // Cells become inputs in place. No <form> wrapper — a form element cannot
    // legally sit between <tr> and <td> — so Enter is wired up by hand.
    return (
      <tr className="border-b border-black/5 dark:border-white/10">
        <td className={TD_CLASS}>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              required
              aria-label="School name"
              disabled={isSaving}
              value={values.schoolName}
              onChange={(event) =>
                setValues((c) => ({ ...c, schoolName: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void save()
                }
              }}
              className={INPUT_CLASS}
            />
            <input
              type="text"
              aria-label="Notes"
              placeholder="Notes (optional)"
              disabled={isSaving}
              value={values.notes}
              onChange={(event) =>
                setValues((c) => ({ ...c, notes: event.target.value }))
              }
              className={INPUT_CLASS}
            />
            {error && <ErrorBanner message={error} />}
          </div>
        </td>

        <td className={TD_CLASS}>
          <StatusSelect
            id={`status-${application.id}`}
            value={values.status}
            onChange={(status) => setValues((c) => ({ ...c, status }))}
            disabled={isSaving}
          />
        </td>

        <td className={TD_CLASS}>
          <input
            type="date"
            aria-label="Deadline"
            disabled={isSaving}
            value={values.deadline}
            onChange={(event) =>
              setValues((c) => ({ ...c, deadline: event.target.value }))
            }
            className={INPUT_CLASS}
          />
        </td>

        <td className={TD_CLASS}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
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
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/10">
      <td className={TD_CLASS}>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{application.schoolName}</span>
          {application.notes && (
            <span className="text-xs opacity-70">{application.notes}</span>
          )}
          {error && <ErrorBanner message={error} />}
        </div>
      </td>

      <td className={TD_CLASS}>
        <StatusBadge status={application.status} />
      </td>

      <td className={TD_CLASS}>{application.deadlineLabel || '—'}</td>

      <td className={TD_CLASS}>
        <div className="flex gap-2">
          {isConfirmingDelete ? (
            <>
              <span className="self-center text-xs opacity-70">Remove?</span>
              <button
                type="button"
                onClick={remove}
                disabled={isSaving}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isSaving ? 'Removing…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isSaving}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={startEditing}
                aria-label={`Edit ${application.schoolName}`}
                className={SECONDARY_BUTTON_CLASS}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                aria-label={`Delete ${application.schoolName}`}
                className={SECONDARY_BUTTON_CLASS}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

const EMPTY_FORM: ApplicationFormInput = {
  schoolName: '',
  status: DEFAULT_APPLICATION_STATUS,
  deadline: '',
  notes: '',
}

/**
 * The student's college list.
 *
 * Edit and Delete appear on every row with no author check: migration 011 gates
 * on can_access_student() alone, so anyone who can see this list can manage all
 * of it. added_by is recorded on insert but grants nothing.
 */
export function SchoolsTab({
  applications,
  studentId,
}: {
  applications: ApplicationRow[]
  studentId: string
}) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [values, setValues] = useState<ApplicationFormInput>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function closeForm() {
    setIsAdding(false)
    setValues(EMPTY_FORM)
    setError(null)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await createApplication(studentId, values)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    closeForm()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Schools</h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add School
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-application-name"
                className="text-sm font-medium"
              >
                School Name
              </label>
              <input
                id="new-application-name"
                type="text"
                required
                disabled={isSubmitting}
                value={values.schoolName}
                onChange={(event) =>
                  setValues((c) => ({ ...c, schoolName: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-application-status"
                className="text-sm font-medium"
              >
                Status
              </label>
              <StatusSelect
                id="new-application-status"
                value={values.status}
                onChange={(status) => setValues((c) => ({ ...c, status }))}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new-application-deadline"
                className="text-sm font-medium"
              >
                Deadline
              </label>
              <input
                id="new-application-deadline"
                type="date"
                disabled={isSubmitting}
                value={values.deadline}
                onChange={(event) =>
                  setValues((c) => ({ ...c, deadline: event.target.value }))
                }
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-application-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="new-application-notes"
              rows={2}
              disabled={isSubmitting}
              value={values.notes}
              onChange={(event) =>
                setValues((c) => ({ ...c, notes: event.target.value }))
              }
              className={INPUT_CLASS}
            />
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? 'Saving…' : 'Save School'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {applications.length === 0 ? (
        <p className="text-sm opacity-70">No schools on this list yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                <th className="py-2 pr-4 font-medium">School</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Deadline</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <ApplicationTableRow
                  key={application.id}
                  application={application}
                  studentId={studentId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
