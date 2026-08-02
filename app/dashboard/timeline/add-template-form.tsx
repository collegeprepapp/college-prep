'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTemplate } from './actions'
import { EMPTY_TEMPLATE_FORM, type TemplateFormInput } from './constants'
import {
  ErrorBanner,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TemplateFormFields,
} from './template-form-fields'
import { SchoolField, type SchoolOption } from '@/components/school-field'

export function AddTemplateForm({
  schoolId,
  schools,
  role,
}: {
  schoolId: string | null
  schools: SchoolOption[]
  role: string | null
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState<TemplateFormInput>(EMPTY_TEMPLATE_FORM)
  // Only used by system_admin, who always picks. Seeded from their own
  // school_id when they have one, so the common case is preselected.
  const [pickedSchoolId, setPickedSchoolId] = useState(schoolId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function close() {
    setIsOpen(false)
    setValues(EMPTY_TEMPLATE_FORM)
    setPickedSchoolId(schoolId ?? '')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // system_admin submits whatever they picked; everyone else is pinned to
    // their own school.
    const chosenSchoolId =
      role === 'system_admin' ? pickedSchoolId : (schoolId ?? '')

    const result = await createTemplate(chosenSchoolId, values)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    close()
    router.refresh()
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`self-start ${PRIMARY_BUTTON_CLASS}`}
      >
        Add Template
      </button>
    )
  }

  return (
    <section className="rounded-lg border border-black/10 p-5 dark:border-white/15">
      <h3 className="text-base font-medium">Add Template</h3>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <TemplateFormFields
          idPrefix="add-template"
          values={values}
          onChange={setValues}
          disabled={isSubmitting}
        />

        <SchoolField
          idPrefix="add-template"
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
            {isSubmitting ? 'Saving…' : 'Save Template'}
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
