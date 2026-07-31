'use client'

import type { StudentFormInput } from '@/lib/students/form'


export const INPUT_CLASS =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50'

export const PRIMARY_BUTTON_CLASS =
  'rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50'

export const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20'

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
 * The six editable student columns. Shared by the create and edit forms so the
 * two stay in step — both feed the same server-side parser in actions.ts.
 *
 * idPrefix keeps label/input ids unique when both forms exist on one page.
 */
export function StudentFormFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: StudentFormInput
  onChange: (values: StudentFormInput) => void
  disabled?: boolean
}) {
  function set<K extends keyof StudentFormInput>(
    key: K,
    value: StudentFormInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-first-name`} className="text-sm font-medium">
          First Name
        </label>
        <input
          id={`${idPrefix}-first-name`}
          type="text"
          required
          disabled={disabled}
          value={values.firstName}
          onChange={(event) => set('firstName', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-last-name`} className="text-sm font-medium">
          Last Name
        </label>
        <input
          id={`${idPrefix}-last-name`}
          type="text"
          required
          disabled={disabled}
          value={values.lastName}
          onChange={(event) => set('lastName', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idPrefix}-graduation-year`}
          className="text-sm font-medium"
        >
          Graduation Year
        </label>
        <input
          id={`${idPrefix}-graduation-year`}
          type="number"
          required
          min={1900}
          max={2100}
          step={1}
          disabled={disabled}
          value={values.graduationYear}
          onChange={(event) => set('graduationYear', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-email`} className="text-sm font-medium">
          Email
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          disabled={disabled}
          value={values.email}
          onChange={(event) => set('email', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-gpa`} className="text-sm font-medium">
          GPA
        </label>
        <input
          id={`${idPrefix}-gpa`}
          type="number"
          min={0}
          max={9.99}
          step={0.01}
          disabled={disabled}
          value={values.gpa}
          onChange={(event) => set('gpa', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-class-rank`} className="text-sm font-medium">
          Class Rank
        </label>
        <input
          id={`${idPrefix}-class-rank`}
          type="text"
          disabled={disabled}
          value={values.classRank}
          onChange={(event) => set('classRank', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  )
}
