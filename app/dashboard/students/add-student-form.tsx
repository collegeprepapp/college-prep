'use client'

import { useState } from 'react'
import { createStudent } from './actions'
import {
  EMPTY_STUDENT_FORM,
  type StudentFormInput,
} from '@/lib/students/form'
import {
  ErrorBanner,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StudentFormFields,
} from '@/components/student-form-fields'
import { SchoolField, type SchoolOption } from '@/components/school-field'

export function AddStudentForm({
  schoolId,
  schools,
  role,
}: {
  schoolId: string | null
  schools: SchoolOption[]
  role: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState<StudentFormInput>(EMPTY_STUDENT_FORM)
  // Only used by system_admin, who always picks. Seeded from their own
  // school_id when they have one, so the common case is preselected.
  const [pickedSchoolId, setPickedSchoolId] = useState(schoolId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function close() {
    setIsOpen(false)
    setValues(EMPTY_STUDENT_FORM)
    setPickedSchoolId(schoolId ?? '')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // Redirects to the new student on success, so control does not return here.
    // system_admin submits whatever they picked; everyone else is pinned to
    // their own school.
    const chosenSchoolId =
      role === 'system_admin' ? pickedSchoolId : (schoolId ?? '')

    const result = await createStudent(chosenSchoolId, values)

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

        <SchoolField
          idPrefix="add-student"
          role={role}
          schools={schools}
          value={pickedSchoolId}
          onChange={setPickedSchoolId}
          disabled={isSubmitting}
        />

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
