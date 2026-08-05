'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { DeleteIconButton, EditIconButton } from '@/components/icon-button'
import {
  ACTIVITY_TYPES,
  CHARACTER_LIMITS,
  COMMON_APP_ACTIVITY_LIMIT,
  COMMON_APP_HONOR_LIMIT,
  EMPTY_COMMON_APP_ACTIVITY,
  EMPTY_COMMON_APP_HONOR,
  PARTICIPATION_GRADES,
  PARTICIPATION_TIMING,
  RECOGNITION_LEVELS,
  type CommonAppActivityInput,
  type CommonAppHonorInput,
} from '@/lib/common-app/constants'
import {
  createCommonAppActivity,
  createCommonAppHonor,
  deleteCommonAppActivity,
  deleteCommonAppHonor,
  reorderCommonAppActivities,
  reorderCommonAppHonors,
  updateCommonAppActivity,
  updateCommonAppHonor,
} from './common-app-actions'
import { SortableList } from './sortable-list'

export type CommonAppActivityRow = {
  id: string
  sourceActivityId: string
  /** Resolved server-side; '' when unlinked or the source was deleted. */
  sourceName: string
  activityType: string
  positionTitle: string
  organizationName: string
  description: string
  participationGrades: string[]
  participationTiming: string[]
  hoursPerWeek: number | null
  weeksPerYear: number | null
  continueInCollege: boolean
}

export type CommonAppHonorRow = {
  id: string
  sourceHonorId: string
  sourceName: string
  title: string
  gradeLevel: string[]
  levelOfRecognition: string
  description: string
}

/** For the "based on" dropdowns — the student's working lists. */
export type SourceOption = { id: string; name: string }

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

/**
 * Live character counter.
 *
 * Guidance, not a limit: the input has no maxLength and nothing rejects an
 * over-length value, because silently truncating pasted text would lose a
 * counselor's wording. Going over turns the count red instead.
 */
function CharacterCount({ value, limit }: { value: string; limit: number }) {
  const over = value.length > limit

  return (
    <span
      className={`text-xs ${over ? 'font-medium text-red-600 dark:text-red-400' : 'opacity-60'}`}
    >
      {value.length}/{limit}
      {over ? ' — over the Common App limit' : ''}
    </span>
  )
}

/** Multi-select rendered as checkboxes; the form takes several at once. */
function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
  disabled,
}: {
  legend: string
  options: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option]
    )
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
              className="size-4"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SourceSelect({
  id,
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  options: SourceOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        disabled={disabled || options.length === 0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">
          {options.length === 0 ? 'Nothing to link to yet' : 'Not linked'}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <p className="text-xs opacity-60">
        Reference only — linking does not copy anything across.
      </p>
    </div>
  )
}

function SourceLabel({ name }: { name: string }) {
  if (!name) {
    return null
  }

  return (
    <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-60 dark:border-white/20">
      based on: {name}
    </span>
  )
}

/** Header with the soft count, e.g. "7 of 10". */
function SectionHeader({
  title, hint, count, limit, onAdd, adding,
}: {
  title: string
  hint: string
  count: number
  limit: number
  onAdd: () => void
  adding: boolean
}) {
  const over = count > limit

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-base font-medium">
          {title}
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-normal ${
              over
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-black/15 opacity-70 dark:border-white/20'
            }`}
          >
            {count} of {limit}
          </span>
        </h3>
        <p className="mt-0.5 text-xs opacity-60">
          {hint}
          {over
            ? ` Drafting more than ${limit} is fine — the top ${limit} are what get submitted.`
            : ''}
        </p>
      </div>

      {!adding && (
        <button type="button" onClick={onAdd} className={PRIMARY_BUTTON_CLASS}>
          Add Entry
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity entry
// ---------------------------------------------------------------------------

function toActivityInput(row: CommonAppActivityRow): CommonAppActivityInput {
  return {
    sourceActivityId: row.sourceActivityId,
    activityType: row.activityType,
    positionTitle: row.positionTitle,
    organizationName: row.organizationName,
    description: row.description,
    participationGrades: row.participationGrades,
    participationTiming: row.participationTiming,
    hoursPerWeek: row.hoursPerWeek === null ? '' : String(row.hoursPerWeek),
    weeksPerYear: row.weeksPerYear === null ? '' : String(row.weeksPerYear),
    continueInCollege: row.continueInCollege,
  }
}

function ActivityFields({
  idPrefix,
  values,
  onChange,
  sources,
  disabled,
}: {
  idPrefix: string
  values: CommonAppActivityInput
  onChange: (next: CommonAppActivityInput) => void
  sources: SourceOption[]
  disabled?: boolean
}) {
  function set<K extends keyof CommonAppActivityInput>(
    key: K,
    value: CommonAppActivityInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-type`} className="text-sm font-medium">
            Activity Type
          </label>
          <select
            id={`${idPrefix}-type`}
            disabled={disabled}
            value={values.activityType ?? ''}
            onChange={(event) => set('activityType', event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Not chosen</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <SourceSelect
          id={`${idPrefix}-source`}
          label="Based on"
          options={sources}
          value={values.sourceActivityId ?? ''}
          onChange={(value) => set('sourceActivityId', value)}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-position`} className="text-sm font-medium">
          Position / Leadership
        </label>
        <input
          id={`${idPrefix}-position`}
          type="text"
          disabled={disabled}
          value={values.positionTitle ?? ''}
          onChange={(event) => set('positionTitle', event.target.value)}
          className={INPUT_CLASS}
        />
        <CharacterCount
          value={values.positionTitle ?? ''}
          limit={CHARACTER_LIMITS.positionTitle}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-org`} className="text-sm font-medium">
          Organization
        </label>
        <input
          id={`${idPrefix}-org`}
          type="text"
          disabled={disabled}
          value={values.organizationName ?? ''}
          onChange={(event) => set('organizationName', event.target.value)}
          className={INPUT_CLASS}
        />
        <CharacterCount
          value={values.organizationName ?? ''}
          limit={CHARACTER_LIMITS.organizationName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-description`} className="text-sm font-medium">
          Description
        </label>
        <textarea
          id={`${idPrefix}-description`}
          rows={3}
          disabled={disabled}
          value={values.description ?? ''}
          onChange={(event) => set('description', event.target.value)}
          className={INPUT_CLASS}
        />
        <CharacterCount
          value={values.description ?? ''}
          limit={CHARACTER_LIMITS.activityDescription}
        />
      </div>

      <CheckboxGroup
        legend="Participation Grades"
        options={PARTICIPATION_GRADES}
        selected={values.participationGrades ?? []}
        onChange={(next) => set('participationGrades', next)}
        disabled={disabled}
      />

      <CheckboxGroup
        legend="Timing"
        options={PARTICIPATION_TIMING}
        selected={values.participationTiming ?? []}
        onChange={(next) => set('participationTiming', next)}
        disabled={disabled}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-hours`} className="text-sm font-medium">
            Hours per week
          </label>
          <input
            id={`${idPrefix}-hours`}
            type="number"
            min={0}
            max={168}
            step={0.5}
            disabled={disabled}
            value={values.hoursPerWeek ?? ''}
            onChange={(event) => set('hoursPerWeek', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-weeks`} className="text-sm font-medium">
            Weeks per year
          </label>
          <input
            id={`${idPrefix}-weeks`}
            type="number"
            min={0}
            max={52}
            step={1}
            disabled={disabled}
            value={values.weeksPerYear ?? ''}
            onChange={(event) => set('weeksPerYear', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            disabled={disabled}
            checked={values.continueInCollege ?? false}
            onChange={(event) => set('continueInCollege', event.target.checked)}
            className="size-4"
          />
          Intend to continue in college
        </label>
      </div>
    </div>
  )
}

function ActivityEntry({
  row, rank, handle, studentId, sources, isExpanded, onToggle, onChanged,
}: {
  row: CommonAppActivityRow
  rank: number
  handle: React.ReactNode
  studentId: string
  sources: SourceOption[]
  isExpanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [values, setValues] = useState(() => toActivityInput(row))
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await updateCommonAppActivity(row.id, studentId, values)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    onToggle()
    onChanged()
  }

  async function remove() {
    setError(null)
    setIsBusy(true)

    const result = await deleteCommonAppActivity(row.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onChanged()
  }

  // The organization is what makes a row recognisable at a glance — a list of
  // "Full Member", "Volunteer", "Member" tells you nothing. Position falls back
  // to being primary only when there is no organization to lead with.
  const primary =
    row.organizationName || row.positionTitle || 'Untitled entry'
  const secondary = row.organizationName ? row.positionTitle : ''

  // Both parts, for the icon buttons' aria-labels: two entries at the same
  // organization are otherwise indistinguishable to a screen reader.
  const label = [primary, secondary].filter(Boolean).join(' — ')

  const summary = [
    row.activityType,
    row.participationGrades.length > 0
      ? `Grades ${row.participationGrades.join(', ')}`
      : '',
    row.hoursPerWeek !== null || row.weeksPerYear !== null
      ? `${row.hoursPerWeek ?? '—'} hrs/wk · ${row.weeksPerYear ?? '—'} wks/yr`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-start gap-2">
        <span className="mt-1 flex items-center gap-1">
          {handle}
          <span className="w-5 text-xs tabular-nums opacity-50">{rank}</span>
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="flex flex-1 flex-col items-start gap-1 text-left"
        >
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{primary}</span>
            {secondary && (
              <span className="text-sm opacity-70">— {secondary}</span>
            )}
            <SourceLabel name={row.sourceName} />
          </span>
          {summary && <span className="text-xs opacity-70">{summary}</span>}
          {!isExpanded && row.description && (
            <span className="line-clamp-1 max-w-prose text-xs opacity-60">
              {row.description}
            </span>
          )}
        </button>

        <div className="flex shrink-0 gap-2">
          {isConfirmingDelete ? (
            <>
              <button
                type="button"
                onClick={remove}
                disabled={isBusy}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isBusy ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isBusy}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <EditIconButton label={`Edit ${label}`} onClick={onToggle} />
              <DeleteIconButton
                label={`Delete ${label}`}
                onClick={() => setIsConfirmingDelete(true)}
              />
            </>
          )}
        </div>
      </div>

      {error && !isExpanded && <ErrorBanner message={error} />}

      {isExpanded && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-4">
          <ActivityFields
            idPrefix={`ca-activity-${row.id}`}
            values={values}
            onChange={setValues}
            sources={sources}
            disabled={isBusy}
          />

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button type="submit" disabled={isBusy} className={PRIMARY_BUTTON_CLASS}>
              {isBusy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(toActivityInput(row))
                setError(null)
                onToggle()
              }}
              disabled={isBusy}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Honor entry
// ---------------------------------------------------------------------------

function toHonorInput(row: CommonAppHonorRow): CommonAppHonorInput {
  return {
    sourceHonorId: row.sourceHonorId,
    title: row.title,
    gradeLevel: row.gradeLevel,
    levelOfRecognition: row.levelOfRecognition,
    description: row.description,
  }
}

function HonorFields({
  idPrefix, values, onChange, sources, disabled,
}: {
  idPrefix: string
  values: CommonAppHonorInput
  onChange: (next: CommonAppHonorInput) => void
  sources: SourceOption[]
  disabled?: boolean
}) {
  function set<K extends keyof CommonAppHonorInput>(
    key: K,
    value: CommonAppHonorInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-title`} className="text-sm font-medium">
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          type="text"
          disabled={disabled}
          value={values.title ?? ''}
          onChange={(event) => set('title', event.target.value)}
          className={INPUT_CLASS}
        />
        <CharacterCount
          value={values.title ?? ''}
          limit={CHARACTER_LIMITS.honorTitle}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-level`} className="text-sm font-medium">
            Level of Recognition
          </label>
          <select
            id={`${idPrefix}-level`}
            disabled={disabled}
            value={values.levelOfRecognition ?? ''}
            onChange={(event) => set('levelOfRecognition', event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Not chosen</option>
            {RECOGNITION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <SourceSelect
          id={`${idPrefix}-source`}
          label="Based on"
          options={sources}
          value={values.sourceHonorId ?? ''}
          onChange={(value) => set('sourceHonorId', value)}
          disabled={disabled}
        />
      </div>

      <CheckboxGroup
        legend="Grade Level"
        options={PARTICIPATION_GRADES}
        selected={values.gradeLevel ?? []}
        onChange={(next) => set('gradeLevel', next)}
        disabled={disabled}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-notes`} className="text-sm font-medium">
          Notes
        </label>
        {/* No counter: the real form has no description field, so this is
            internal working notes with nothing to stay under. */}
        <textarea
          id={`${idPrefix}-notes`}
          rows={2}
          disabled={disabled}
          value={values.description ?? ''}
          onChange={(event) => set('description', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  )
}

function HonorEntry({
  row, rank, handle, studentId, sources, isExpanded, onToggle, onChanged,
}: {
  row: CommonAppHonorRow
  rank: number
  handle: React.ReactNode
  studentId: string
  sources: SourceOption[]
  isExpanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [values, setValues] = useState(() => toHonorInput(row))
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await updateCommonAppHonor(row.id, studentId, values)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    onToggle()
    onChanged()
  }

  async function remove() {
    setError(null)
    setIsBusy(true)

    const result = await deleteCommonAppHonor(row.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onChanged()
  }

  const label = row.title || 'Untitled honor'
  const summary = [
    row.levelOfRecognition,
    row.gradeLevel.length > 0 ? `Grades ${row.gradeLevel.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-start gap-2">
        <span className="mt-1 flex items-center gap-1">
          {handle}
          <span className="w-5 text-xs tabular-nums opacity-50">{rank}</span>
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="flex flex-1 flex-col items-start gap-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            <SourceLabel name={row.sourceName} />
          </span>
          {summary && <span className="text-xs opacity-70">{summary}</span>}
        </button>

        <div className="flex shrink-0 gap-2">
          {isConfirmingDelete ? (
            <>
              <button
                type="button"
                onClick={remove}
                disabled={isBusy}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isBusy ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isBusy}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <EditIconButton label={`Edit ${label}`} onClick={onToggle} />
              <DeleteIconButton
                label={`Delete ${label}`}
                onClick={() => setIsConfirmingDelete(true)}
              />
            </>
          )}
        </div>
      </div>

      {error && !isExpanded && <ErrorBanner message={error} />}

      {isExpanded && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-4">
          <HonorFields
            idPrefix={`ca-honor-${row.id}`}
            values={values}
            onChange={setValues}
            sources={sources}
            disabled={isBusy}
          />

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button type="submit" disabled={isBusy} className={PRIMARY_BUTTON_CLASS}>
              {isBusy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(toHonorInput(row))
                setError(null)
                onToggle()
              }}
              disabled={isBusy}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

/**
 * The Common App planner: the working lists reshaped into the form's own
 * fields.
 *
 * Linking an entry to a source activity or honor is reference only — nothing is
 * copied across. Drafting text is the work; auto-filling it from a loosely-kept
 * list would produce entries that read like notes rather than an application.
 */
export function CommonAppTab({
  activities,
  honors,
  activitySources,
  honorSources,
  studentId,
}: {
  activities: CommonAppActivityRow[]
  honors: CommonAppHonorRow[]
  activitySources: SourceOption[]
  honorSources: SourceOption[]
  studentId: string
}) {
  const router = useRouter()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingActivity, setAddingActivity] = useState(false)
  const [addingHonor, setAddingHonor] = useState(false)
  const [activityValues, setActivityValues] = useState(EMPTY_COMMON_APP_ACTIVITY)
  const [honorValues, setHonorValues] = useState(EMPTY_COMMON_APP_HONOR)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  async function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await createCommonAppActivity(studentId, activityValues)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setAddingActivity(false)
    setActivityValues(EMPTY_COMMON_APP_ACTIVITY)
    router.refresh()
  }

  async function addHonor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await createCommonAppHonor(studentId, honorValues)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setAddingHonor(false)
    setHonorValues(EMPTY_COMMON_APP_HONOR)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Activities"
          hint="Drag to rank."
          count={activities.length}
          limit={COMMON_APP_ACTIVITY_LIMIT}
          onAdd={() => setAddingActivity(true)}
          adding={addingActivity}
        />

        {addingActivity && (
          <form
            onSubmit={addActivity}
            className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <h4 className="text-sm font-medium">New Activity Entry</h4>

            <ActivityFields
              idPrefix="new-ca-activity"
              values={activityValues}
              onChange={setActivityValues}
              sources={activitySources}
              disabled={isBusy}
            />

            {error && <ErrorBanner message={error} />}

            <div className="flex gap-2">
              <button type="submit" disabled={isBusy} className={PRIMARY_BUTTON_CLASS}>
                {isBusy ? 'Saving…' : 'Save Entry'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingActivity(false)
                  setActivityValues(EMPTY_COMMON_APP_ACTIVITY)
                  setError(null)
                }}
                disabled={isBusy}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {activities.length === 0 ? (
          <p className="text-sm opacity-70">No activity entries drafted yet.</p>
        ) : (
          <SortableList
            items={activities}
            cutoffAfter={COMMON_APP_ACTIVITY_LIMIT}
            cutoffLabel={`Top ${COMMON_APP_ACTIVITY_LIMIT} — submitted`}
            onReorder={async (ids) => {
              const result = await reorderCommonAppActivities(studentId, ids)
              if (!result.ok) {
                setError(result.error)
                return false
              }
              router.refresh()
              return true
            }}
            renderItem={(row, index, handle) => (
              <ActivityEntry
                row={row}
                rank={index + 1}
                handle={handle}
                studentId={studentId}
                sources={activitySources}
                isExpanded={expandedId === row.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === row.id ? null : row.id
                  )
                }
                onChanged={() => {
                  setExpandedId(null)
                  router.refresh()
                }}
              />
            )}
          />
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-black/10 pt-8 dark:border-white/15">
        <SectionHeader
          title="Honors"
          hint="Drag to rank."
          count={honors.length}
          limit={COMMON_APP_HONOR_LIMIT}
          onAdd={() => setAddingHonor(true)}
          adding={addingHonor}
        />

        {addingHonor && (
          <form
            onSubmit={addHonor}
            className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <h4 className="text-sm font-medium">New Honor Entry</h4>

            <HonorFields
              idPrefix="new-ca-honor"
              values={honorValues}
              onChange={setHonorValues}
              sources={honorSources}
              disabled={isBusy}
            />

            {error && <ErrorBanner message={error} />}

            <div className="flex gap-2">
              <button type="submit" disabled={isBusy} className={PRIMARY_BUTTON_CLASS}>
                {isBusy ? 'Saving…' : 'Save Entry'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingHonor(false)
                  setHonorValues(EMPTY_COMMON_APP_HONOR)
                  setError(null)
                }}
                disabled={isBusy}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {honors.length === 0 ? (
          <p className="text-sm opacity-70">No honor entries drafted yet.</p>
        ) : (
          <SortableList
            items={honors}
            cutoffAfter={COMMON_APP_HONOR_LIMIT}
            cutoffLabel={`Top ${COMMON_APP_HONOR_LIMIT} — submitted`}
            onReorder={async (ids) => {
              const result = await reorderCommonAppHonors(studentId, ids)
              if (!result.ok) {
                setError(result.error)
                return false
              }
              router.refresh()
              return true
            }}
            renderItem={(row, index, handle) => (
              <HonorEntry
                row={row}
                rank={index + 1}
                handle={handle}
                studentId={studentId}
                sources={honorSources}
                isExpanded={expandedId === row.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === row.id ? null : row.id
                  )
                }
                onChanged={() => {
                  setExpandedId(null)
                  router.refresh()
                }}
              />
            )}
          />
        )}
      </section>
    </div>
  )
}
