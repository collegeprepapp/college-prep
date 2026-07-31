'use client'

import { useState } from 'react'
import { createStudent } from './actions'
import {
  EMPTY_STUDENT_FORM,
  type StudentFormInput,
} from '@/lib/students/form'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StudentFormFields,
} from '@/components/student-form-fields'

export function AddStudentForm({ schoolId }: { schoolId: string | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState<StudentFormInput>(EMPTY_STUDENT_FORM)
  // Only used when the viewer has no school of their own (system_admin). The
  // schools table has no select policy, so there is no list to choose from.
  const [manualSchoolId, setManualSchoolId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function close() {
    setIsOpen(false)
    setValues(EMPTY_STUDENT_FORM)
    setManualSchoolId('')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // Redirects to the new student on success, so control does not return here.
    const result = await createStudent(schoolId ?? manualSchoolId, values)

    setIsSubmitting(false)
    if (result && !result.ok) {
      setError(result.error)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`self-start ${PRIMARY_BUTTON_CLASS}`}
      >
        Add Student
      </button>
    )
  }

  return (
    <section className="rounded-lg border border-black/10 p-5 dark:border-white/15">
      <h3 className="text-base font-medium">Add Student</h3>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <StudentFormFields
          idPrefix="add-student"
          values={values}
          onChange={setValues}
          disabled={isSubmitting}
        />

        {schoolId === null && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-student-school" className="text-sm font-medium">
              School ID
            </label>
            <input
              id="add-student-school"
              type="text"
              required
              disabled={isSubmitting}
              value={manualSchoolId}
              onChange={(event) => setManualSchoolId(event.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            />
            <p className="text-xs opacity-60">
              Your account is not tied to one school, so paste the school UUID.
            </p>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={PRIMARY_BUTTON_CLASS}
          >
            {isSubmitting ? 'Saving…' : 'Save Student'}
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
    </section>
  )
}
