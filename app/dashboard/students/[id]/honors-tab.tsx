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
import { EMPTY_HONOR_FORM, type HonorFormInput } from '@/lib/honors/form'
import {
  createHonor,
  deleteHonor,
  reorderHonors,
  updateHonor,
} from './honors-actions'
import { SortableList } from './sortable-list'

export type HonorRow = {
  id: string
  name: string
  yearEarned: string
  organizationName: string
  description: string
}

/** The Common App accepts five honors, ranked. */
const COMMON_APP_LIMIT = 5

function toFormInput(row: HonorRow): HonorFormInput {
  return {
    name: row.name,
    yearEarned: row.yearEarned,
    organizationName: row.organizationName,
    description: row.description,
  }
}

function HonorFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: HonorFormInput
  onChange: (values: HonorFormInput) => void
  disabled?: boolean
}) {
  function set<K extends keyof HonorFormInput>(
    key: K,
    value: HonorFormInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium">
            Honor / Award
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
          <label htmlFor={`${idPrefix}-year`} className="text-sm font-medium">
            Year Earned
          </label>
          <input
            id={`${idPrefix}-year`}
            type="text"
            placeholder="11th grade"
            disabled={disabled}
            value={values.yearEarned ?? ''}
            onChange={(event) => set('yearEarned', event.target.value)}
            className={INPUT_CLASS}
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
    </div>
  )
}

function HonorItem({
  row,
  rank,
  handle,
  studentId,
  isExpanded,
  onToggle,
  onChanged,
}: {
  row: HonorRow
  rank: number
  handle: React.ReactNode
  studentId: string
  isExpanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [values, setValues] = useState<HonorFormInput>(() => toFormInput(row))
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await updateHonor(row.id, studentId, values)
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

    const result = await deleteHonor(row.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onChanged()
  }

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
          className="flex flex-1 flex-col items-start gap-0.5 text-left"
        >
          <span className="text-sm font-medium">{row.name}</span>
          <span className="text-xs opacity-70">
            {[row.yearEarned, row.organizationName].filter(Boolean).join(' · ') ||
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
              <EditIconButton label={`Edit ${row.name}`} onClick={onToggle} />
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
          <HonorFields
            idPrefix={`honor-${row.id}`}
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

export function HonorsTab({
  honors,
  studentId,
}: {
  honors: HonorRow[]
  studentId: string
}) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newValues, setNewValues] = useState<HonorFormInput>(EMPTY_HONOR_FORM)
  const [addError, setAddError] = useState<string | null>(null)
  const [reorderError, setReorderError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddError(null)
    setIsSubmitting(true)

    const result = await createHonor(studentId, newValues)
    setIsSubmitting(false)

    if (!result.ok) {
      setAddError(result.error)
      return
    }

    setIsAdding(false)
    setNewValues(EMPTY_HONOR_FORM)
    router.refresh()
  }

  async function handleReorder(orderedIds: string[]) {
    setReorderError(null)

    const result = await reorderHonors(studentId, orderedIds)

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
          <h3 className="text-base font-medium">Honors</h3>
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
            Add Honor
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">Add Honor</h4>

          <HonorFields
            idPrefix="new-honor"
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
              {isSubmitting ? 'Saving…' : 'Save Honor'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                setNewValues(EMPTY_HONOR_FORM)
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

      {honors.length === 0 ? (
        <p className="text-sm opacity-70">No honors yet.</p>
      ) : (
        <SortableList
          items={honors}
          onReorder={handleReorder}
          cutoffAfter={COMMON_APP_LIMIT}
          cutoffLabel={`Top ${COMMON_APP_LIMIT} for Common App`}
          renderItem={(row, index, handle) => (
            <HonorItem
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
