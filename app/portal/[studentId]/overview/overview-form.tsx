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
  MAX_GPA,
  MAX_GRADUATION_YEAR,
  MIN_GRADUATION_YEAR,
  type StudentFormInput,
} from '@/lib/students/form'
import { updateOwnStudentRecord } from './actions'

export type OverviewStudent = {
  id: string
  first_name: string
  last_name: string
  graduation_year: number
  gpa: number | null
  class_rank: string | null
  email: string | null
}

type FieldDef = {
  key: keyof StudentFormInput
  label: string
  display: (student: OverviewStudent) => React.ReactNode
  input: React.InputHTMLAttributes<HTMLInputElement>
}

/**
 * One definition per field drives both modes, so the read-only value and the
 * input that replaces it can never end up in different grid cells.
 */
const FIELDS: FieldDef[] = [
  {
    key: 'firstName',
    label: 'First Name',
    display: (student) => student.first_name,
    input: { type: 'text', required: true, autoComplete: 'given-name' },
  },
  {
    key: 'lastName',
    label: 'Last Name',
    display: (student) => student.last_name,
    input: { type: 'text', required: true, autoComplete: 'family-name' },
  },
  {
    key: 'graduationYear',
    label: 'Graduation Year',
    display: (student) => student.graduation_year,
    input: {
      type: 'number',
      required: true,
      min: MIN_GRADUATION_YEAR,
      max: MAX_GRADUATION_YEAR,
      step: 1,
    },
  },
  {
    key: 'gpa',
    label: 'GPA',
    display: (student) => student.gpa ?? '—',
    input: { type: 'number', min: 0, max: MAX_GPA, step: 0.01 },
  },
  {
    key: 'classRank',
    label: 'Class Rank',
    display: (student) => student.class_rank ?? '—',
    input: { type: 'text' },
  },
  {
    key: 'email',
    label: 'Email',
    display: (student) => student.email ?? '—',
    input: { type: 'email', autoComplete: 'email' },
  },
]

function toFormInput(student: OverviewStudent): StudentFormInput {
  return {
    firstName: student.first_name,
    lastName: student.last_name,
    graduationYear: String(student.graduation_year),
    email: student.email ?? '',
    gpa: student.gpa === null ? '' : String(student.gpa),
    classRank: student.class_rank ?? '',
  }
}

/**
 * The student's record, editable in place: clicking Edit swaps each displayed
 * value for an input in the same grid cell rather than opening a second form.
 *
 * Renders read-only with no buttons when canEdit is false (a linked parent).
 * That is presentation only — migration 006 has no parent update policy, so the
 * database refuses a parent write regardless.
 *
 * On save it calls router.refresh() rather than mirroring saved values in local
 * state, so what shows is what Postgres actually stored — numeric(3,2) rounds
 * GPA, for one.
 */
export function OverviewForm({
  student,
  canEdit,
}: {
  student: OverviewStudent
  canEdit: boolean
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<StudentFormInput>(() =>
    toFormInput(student)
  )
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    // Re-seed from props so a previous cancel does not leave stale edits.
    setValues(toFormInput(student))
    setError(null)
    setJustSaved(false)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateOwnStudentRecord(student.id, values)
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {FIELDS.map((field) => {
          const inputId = `overview-${field.key}`

          return (
            <div key={field.key}>
              <dt className="text-xs uppercase tracking-wide opacity-60">
                {isEditing ? (
                  <label htmlFor={inputId}>{field.label}</label>
                ) : (
                  field.label
                )}
              </dt>
              <dd className="mt-0.5">
                {isEditing ? (
                  <input
                    id={inputId}
                    {...field.input}
                    value={values[field.key]}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    disabled={isSaving}
                    className={INPUT_CLASS}
                  />
                ) : (
                  <span className="text-sm">{field.display(student)}</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {error && <ErrorBanner message={error} />}

      {justSaved && !isEditing && (
        <p className="text-sm opacity-70">Changes saved.</p>
      )}

      {canEdit &&
        (isEditing ? (
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
              onClick={cancelEditing}
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
            Edit my info
          </button>
        ))}
    </form>
  )
}
