'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTemplate } from './actions'
import { EMPTY_TEMPLATE_FORM, type TemplateFormInput } from './constants'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TemplateFormFields,
} from './template-form-fields'

export function AddTemplateForm({ schoolId }: { schoolId: string | null }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState<TemplateFormInput>(EMPTY_TEMPLATE_FORM)
  // Only shown when the viewer has no school of their own (system_admin). The
  // schools table has no select policy, so there is no list to pick from.
  const [manualSchoolId, setManualSchoolId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function close() {
    setIsOpen(false)
    setValues(EMPTY_TEMPLATE_FORM)
    setManualSchoolId('')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await createTemplate(schoolId ?? manualSchoolId, values)
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

        {schoolId === null && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="add-template-school" className="text-sm font-medium">
              School ID
            </label>
            <input
              id="add-template-school"
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
