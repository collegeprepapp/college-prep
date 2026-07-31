'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTemplate, updateTemplate } from './actions'
import {
  AUDIENCE_LABELS,
  type Audience,
  type TemplateFormInput,
} from './constants'
import {
  ErrorBanner,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TemplateFormFields,
} from './template-form-fields'

export type TemplateRowData = {
  id: string
  icon: string | null
  title: string
  description: string | null
  gradeLevel: number
  season: string
  audience: string
}

function toFormInput(template: TemplateRowData): TemplateFormInput {
  return {
    icon: template.icon ?? '',
    title: template.title,
    description: template.description ?? '',
    gradeLevel: String(template.gradeLevel),
    season: template.season,
    audience: template.audience,
  }
}

export function TemplateRow({ template }: { template: TemplateRowData }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<TemplateFormInput>(() =>
    toFormInput(template)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Two-step delete: the button turns into a confirm/cancel pair rather than
  // firing on the first click.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  function startEditing() {
    setValues(toFormInput(template))
    setError(null)
    setIsConfirmingDelete(false)
    setIsEditing(true)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateTemplate(template.id, values)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setIsEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    setError(null)
    setIsSaving(true)

    const result = await deleteTemplate(template.id)
    setIsSaving(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    router.refresh()
  }

  if (isEditing) {
    return (
      <li className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <TemplateFormFields
            idPrefix={`edit-${template.id}`}
            values={values}
            onChange={setValues}
            disabled={isSaving}
          />

          {error && <ErrorBanner message={error} />}

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
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {template.icon ? `${template.icon} ` : ''}
            {template.title}
          </span>

          {template.description && (
            <span className="text-xs opacity-70">{template.description}</span>
          )}

          <span className="mt-1 text-xs opacity-60">
            {template.season} ·{' '}
            {AUDIENCE_LABELS[template.audience as Audience] ??
              template.audience}
          </span>
        </div>

        <div className="flex shrink-0 gap-2">
          {isConfirmingDelete ? (
            <>
              <span className="self-center text-xs opacity-70">Delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isSaving ? 'Deleting…' : 'Confirm'}
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
                className={SECONDARY_BUTTON_CLASS}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className={SECONDARY_BUTTON_CLASS}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
    </li>
  )
}
