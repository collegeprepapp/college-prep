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
  EMPTY_ACTIVITY_FORM,
  type ActivityFormInput,
} from '@/lib/activities/form'
import {
  createActivity,
  deleteActivity,
  reorderActivities,
  updateActivity,
} from './activities-actions'
import { SortableList } from './sortable-list'

export type ActivityRow = {
  id: string
  name: string
  yearsParticipated: string
  totalHours: number | null
  description: string
  leadershipActions: string
}

/** The Common App accepts ten activities, ranked. */
const COMMON_APP_LIMIT = 10

function toFormInput(row: ActivityRow): ActivityFormInput {
  return {
    name: row.name,
    yearsParticipated: row.yearsParticipated,
    totalHours: row.totalHours === null ? '' : String(row.totalHours),
    description: row.description,
    leadershipActions: row.leadershipActions,
  }
}

function ActivityFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: ActivityFormInput
  onChange: (values: ActivityFormInput) => void
  disabled?: boolean
}) {
  function set<K extends keyof ActivityFormInput>(
    key: K,
    value: ActivityFormInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium">
            Activity
          </label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            required
            disabled={disabled}
            value={values.name ?? ''}
            onChange={(event) => set('name', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-years`} className="text-sm font-medium">
            Years
          </label>
          <input
            id={`${idPrefix}-years`}
            type="text"
            placeholder="9th–12th"
            disabled={disabled}
            value={values.yearsParticipated ?? ''}
            onChange={(event) => set('yearsParticipated', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-total-hours`} className="text-sm font-medium">
            Total Hours
          </label>
          <input
            id={`${idPrefix}-total-hours`}
            type="number"
            min={0}
            max={10000}
            // Halves allowed: the column is numeric, not an integer.
            step={0.5}
            disabled={disabled}
            value={values.totalHours ?? ''}
            onChange={(event) => set('totalHours', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-description`} className="text-sm font-medium">
          Description
        </label>
        <textarea
          id={`${idPrefix}-description`}
          rows={2}
          disabled={disabled}
          value={values.description ?? ''}
          onChange={(event) => set('description', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-leadership`} className="text-sm font-medium">
          Leadership / Actions
        </label>
        <textarea
          id={`${idPrefix}-leadership`}
          rows={2}
          disabled={disabled}
          value={values.leadershipActions ?? ''}
          onChange={(event) => set('leadershipActions', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  )
}

function ActivityItem({
  row,
  rank,
  handle,
  studentId,
  isExpanded,
  onToggle,
  onChanged,
}: {
  row: ActivityRow
  rank: number
  handle: React.ReactNode
  studentId: string
  isExpanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [values, setValues] = useState<ActivityFormInput>(() => toFormInput(row))
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // Re-seed from props whenever the editor OPENS, so reopening after a save
  // (or after someone else's change arrived) never shows a pre-refresh copy.
  function handleToggle() {
    if (!isExpanded) {
      setValues(toFormInput(row))
      setError(null)
    }
    onToggle()
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await updateActivity(row.id, studentId, values)
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

    const result = await deleteActivity(row.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onChanged()
  }

  const commitment =
    row.totalHours !== null
      ? `${row.totalHours} ${row.totalHours === 1 ? 'hour' : 'hours'}`
      : ''

  return (
    <li className="rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-start gap-2">
        <span className="mt-1 flex items-center gap-1">
          {handle}
          <span className="w-5 text-xs tabular-nums opacity-50">{rank}</span>
        </span>

        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          className="flex flex-1 flex-col items-start gap-0.5 text-left"
        >
          <span className="text-sm font-medium">{row.name}</span>
          <span className="text-xs opacity-70">
            {[row.yearsParticipated, commitment].filter(Boolean).join(' · ') ||
              'No details yet'}
          </span>
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
              <EditIconButton label={`Edit ${row.name}`} onClick={handleToggle} />
              <DeleteIconButton
                label={`Delete ${row.name}`}
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
            idPrefix={`activity-${row.id}`}
            values={values}
            onChange={setValues}
            disabled={isBusy}
          />

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isBusy}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isBusy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(toFormInput(row))
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

export function ActivitiesTab({
  activities,
  studentId,
}: {
  activities: ActivityRow[]
  studentId: string
}) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newValues, setNewValues] =
    useState<ActivityFormInput>(EMPTY_ACTIVITY_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddError(null)
    setIsSubmitting(true)

    const result = await createActivity(studentId, newValues)
    setIsSubmitting(false)

    if (!result.ok) {
      setAddError(result.error)
      return
    }

    setIsAdding(false)
    setNewValues(EMPTY_ACTIVITY_FORM)
    router.refresh()
  }

  async function handleReorder(orderedIds: string[]) {
    setReorderError(null)

    const result = await reorderActivities(studentId, orderedIds)

    if (!result.ok) {
      setReorderError(result.error)
      return false
    }

    router.refresh()
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">Activities</h3>
          <p className="mt-0.5 text-xs opacity-60">
            Drag to rank. The top {COMMON_APP_LIMIT} are what go on the Common
            App.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add Activity
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">Add Activity</h4>

          <ActivityFields
            idPrefix="new-activity"
            values={newValues}
            onChange={setNewValues}
            disabled={isSubmitting}
          />

          {addError && <ErrorBanner message={addError} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? 'Saving…' : 'Save Activity'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                setNewValues(EMPTY_ACTIVITY_FORM)
                setAddError(null)
              }}
              disabled={isSubmitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {reorderError && <ErrorBanner message={reorderError} />}

      {activities.length === 0 ? (
        <p className="text-sm opacity-70">No activities yet.</p>
      ) : (
        <SortableList
          items={activities}
          onReorder={handleReorder}
          cutoffAfter={COMMON_APP_LIMIT}
          cutoffLabel={`Top ${COMMON_APP_LIMIT} for Common App`}
          renderItem={(row, index, handle) => (
            <ActivityItem
              row={row}
              rank={index + 1}
              handle={handle}
              studentId={studentId}
              isExpanded={expandedId === row.id}
              onToggle={() =>
                setExpandedId((current) => (current === row.id ? null : row.id))
              }
              onChanged={() => {
                setExpandedId(null)
                router.refresh()
              }}
            />
          )}
        />
      )}
    </div>
  )
}
