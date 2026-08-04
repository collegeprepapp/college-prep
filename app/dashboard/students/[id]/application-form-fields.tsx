'use client'

import { useState } from 'react'
import { INPUT_CLASS } from '@/components/student-form-fields'
import { APPLICATION_STATUSES } from '@/lib/college-applications/status'
import type { ApplicationFormInput } from '@/lib/college-applications/form'

/**
 * Every editable field on a college_applications row, shared by the add form
 * and the inline edit row so the two cannot drift.
 *
 * School name and status sit in the always-visible block; the other fourteen
 * are behind a "More details" disclosure, so quick-adding a school stays a
 * two-field operation. The disclosure starts open when editing, since an
 * existing row usually has values in there already.
 */
export function ApplicationFormFields({
  idPrefix,
  values,
  onChange,
  disabled,
  detailsOpenByDefault = false,
}: {
  idPrefix: string
  values: ApplicationFormInput
  onChange: (values: ApplicationFormInput) => void
  disabled?: boolean
  detailsOpenByDefault?: boolean
}) {
  const [showDetails, setShowDetails] = useState(detailsOpenByDefault)

  function set<K extends keyof ApplicationFormInput>(
    key: K,
    value: ApplicationFormInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  function textField(
    key: keyof ApplicationFormInput,
    label: string,
    type: 'text' | 'date' | 'email' | 'url' | 'number' = 'text',
    extra?: React.InputHTMLAttributes<HTMLInputElement>
  ) {
    const id = `${idPrefix}-${key}`

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          type={type}
          disabled={disabled}
          // ?? '' rather than a bare cast: a missing key would otherwise make
          // this input uncontrolled on first render and controlled after the
          // first keystroke.
          value={(values[key] as string | undefined) ?? ''}
          onChange={(event) => set(key, event.target.value)}
          className={INPUT_CLASS}
          {...extra}
        />
      </div>
    )
  }

  function checkboxField(
    key: 'requiresCommonAppEssay' | 'requiresSupplementalEssay',
    label: string
  ) {
    const id = `${idPrefix}-${key}`

    return (
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          checked={values[key] ?? false}
          onChange={(event) => set(key, event.target.checked)}
          className="size-4"
        />
        {label}
      </label>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-schoolName`}
            className="text-sm font-medium"
          >
            School Name
          </label>
          <input
            id={`${idPrefix}-schoolName`}
            type="text"
            required
            disabled={disabled}
            value={values.schoolName ?? ''}
            onChange={(event) => set('schoolName', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-status`} className="text-sm font-medium">
            Status
          </label>
          <select
            id={`${idPrefix}-status`}
            disabled={disabled}
            value={values.status ?? 'researching'}
            onChange={(event) => set('status', event.target.value)}
            className={INPUT_CLASS}
          >
            {APPLICATION_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {textField('deadline', 'Official Deadline', 'date')}
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((open) => !open)}
        aria-expanded={showDetails}
        className="self-start text-sm underline underline-offset-2 opacity-70 hover:opacity-100"
      >
        {showDetails ? 'Hide details' : 'More details'}
      </button>

      {showDetails && (
        <div className="flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/15">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {textField('dateToured', 'Date Toured', 'date')}
            {textField('goalCompletionDate', 'Goal Completion Date', 'date')}
            {textField('scholarshipAmount', 'Scholarship Amount', 'text', {
              inputMode: 'decimal',
              placeholder: '0.00',
            })}
          </div>

          <div className="flex flex-wrap gap-6">
            {checkboxField('requiresCommonAppEssay', 'Common App essay required')}
            {checkboxField(
              'requiresSupplementalEssay',
              'Supplemental essay required'
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {textField('recommendationsNeeded', 'Recommendations Needed', 'number', {
              min: 0,
              max: 99,
              step: 1,
            })}
            {textField('admissionRepName', 'Admissions Rep', 'text')}
            {textField('admissionRepEmail', 'Rep Email', 'email')}
          </div>

          {textField('recommendationNotes', 'Recommendation Notes', 'text')}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textField('websiteLink', 'Website', 'url', {
              placeholder: 'https://',
            })}
            {textField('scholarshipInfoLink', 'Scholarship Info Link', 'url', {
              placeholder: 'https://',
            })}
            {textField('resumeLink', 'Resume Link', 'url', {
              placeholder: 'https://',
            })}
            {textField('otherLinks', 'Other Links', 'text')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${idPrefix}-notes`} className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id={`${idPrefix}-notes`}
              rows={2}
              disabled={disabled}
              value={values.notes ?? ''}
              onChange={(event) => set('notes', event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </div>
  )
}
