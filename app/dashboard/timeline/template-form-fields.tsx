'use client'

import {
  AUDIENCES,
  AUDIENCE_LABELS,
  GRADE_LEVELS,
  SEASONS,
  type Audience,
  type TemplateFormInput,
} from './constants'

export const INPUT_CLASS =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50'

export const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50'

export const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20'

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
    >
      {message}
    </p>
  )
}

/**
 * Shared by the add and edit forms so both feed the same server-side parser in
 * actions.ts. idPrefix keeps label/input ids unique when several are on screen.
 */
export function TemplateFormFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: TemplateFormInput
  onChange: (values: TemplateFormInput) => void
  disabled?: boolean
}) {
  function set<K extends keyof TemplateFormInput>(
    key: K,
    value: TemplateFormInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <div className="flex w-20 flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-icon`} className="text-sm font-medium">
            Icon
          </label>
          <input
            id={`${idPrefix}-icon`}
            type="text"
            disabled={disabled}
            value={values.icon}
            onChange={(event) => set('icon', event.target.value)}
            placeholder="📌"
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-title`} className="text-sm font-medium">
            Title
          </label>
          <input
            id={`${idPrefix}-title`}
            type="text"
            required
            disabled={disabled}
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idPrefix}-description`}
          className="text-sm font-medium"
        >
          Description
        </label>
        <textarea
          id={`${idPrefix}-description`}
          rows={2}
          disabled={disabled}
          value={values.description}
          onChange={(event) => set('description', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-grade`} className="text-sm font-medium">
            Grade Level
          </label>
          <select
            id={`${idPrefix}-grade`}
            disabled={disabled}
            value={values.gradeLevel}
            onChange={(event) => set('gradeLevel', event.target.value)}
            className={INPUT_CLASS}
          >
            {GRADE_LEVELS.map((grade) => (
              <option key={grade} value={String(grade)}>
                Grade {grade}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-season`} className="text-sm font-medium">
            Season
          </label>
          <select
            id={`${idPrefix}-season`}
            disabled={disabled}
            value={values.season}
            onChange={(event) => set('season', event.target.value)}
            className={INPUT_CLASS}
          >
            {SEASONS.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-audience`}
            className="text-sm font-medium"
          >
            Audience
          </label>
          <select
            id={`${idPrefix}-audience`}
            disabled={disabled}
            value={values.audience}
            onChange={(event) => set('audience', event.target.value)}
            className={INPUT_CLASS}
          >
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {AUDIENCE_LABELS[audience as Audience]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
