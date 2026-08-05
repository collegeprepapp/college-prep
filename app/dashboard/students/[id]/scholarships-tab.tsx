'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { DeleteIconButton, EditIconButton } from '@/components/icon-button'
import {
  SCHOLARSHIP_STATUSES,
  scholarshipStatusLabel,
} from '@/lib/scholarships/status'
import {
  EMPTY_SCHOLARSHIP_FORM,
  type ScholarshipFormInput,
} from '@/lib/scholarships/form'
import {
  createScholarship,
  deleteScholarship,
  updateScholarship,
} from './scholarships-actions'

/**
 * One row, with the deadline and amount preformatted on the server and the raw
 * values kept alongside for the edit form and for sorting.
 */
export type ScholarshipRow = {
  id: string
  name: string
  amount: number | null
  amountLabel: string
  status: string
  deadline: string
  deadlineLabel: string
  link: string
  notes: string
}

const STATUS_TONE: Record<string, string> = {
  researching: 'border-black/15 bg-black/5 dark:border-white/20 dark:bg-white/10',
  applied:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  awarded:
    'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  denied: 'border-red-600/25 bg-red-600/5 text-red-700/80 dark:text-red-400/80',
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.researching

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {scholarshipStatusLabel(status)}
    </span>
  )
}

/**
 * Links are user-entered, so an anchor is produced only for plainly http(s)
 * values — a `javascript:` URL would otherwise execute on click. Matches the
 * Schools tab.
 */
function safeHref(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (!trimmed.includes(':')) return `https://${trimmed}`

  return null
}

function dash(value: string) {
  return value.trim() ? value : <span className="opacity-40">—</span>
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

type SortValue = string | number | null

type Column = {
  key: string
  label: string
  /** Null sorts last in both directions. */
  sortValue: (row: ScholarshipRow) => SortValue
  render: (row: ScholarshipRow) => React.ReactNode
  align?: 'right'
}

// Keyed as string, not the literal union: status is plain text in the database,
// so a value outside the vocabulary must still be lookup-able.
const STATUS_ORDER = new Map<string, number>(
  SCHOLARSHIP_STATUSES.map((status, index) => [status.value, index])
)

const COLUMNS: Column[] = [
  {
    key: 'name',
    label: 'Scholarship',
    sortValue: (row) => row.name.toLowerCase(),
    render: (row) => <span className="font-medium">{row.name}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    sortValue: (row) => row.amount,
    render: (row) => dash(row.amountLabel),
  },
  {
    key: 'status',
    label: 'Status',
    // Pipeline order rather than alphabetical, so the column reads as progress.
    sortValue: (row) => STATUS_ORDER.get(row.status) ?? 99,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'deadline',
    label: 'Deadline',
    sortValue: (row) => row.deadline || null,
    render: (row) => dash(row.deadlineLabel),
  },
  {
    key: 'link',
    label: 'Link',
    sortValue: (row) => (row.link.trim() ? 1 : 0),
    render: (row) => {
      const href = safeHref(row.link)

      if (!row.link.trim()) {
        return <span className="opacity-40">—</span>
      }

      return href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={row.link}
          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
        >
          Open
        </a>
      ) : (
        <span title={row.link} className="text-xs opacity-50">
          Link
        </span>
      )
    },
  },
  {
    key: 'notes',
    label: 'Notes',
    sortValue: (row) => row.notes.toLowerCase() || null,
    render: (row) => (
      <span className="block max-w-64 truncate" title={row.notes}>
        {dash(row.notes)}
      </span>
    ),
  },
]

function toFormInput(row: ScholarshipRow): ScholarshipFormInput {
  return {
    name: row.name,
    amount: row.amount === null ? '' : String(row.amount),
    status: row.status,
    deadline: row.deadline,
    link: row.link,
    notes: row.notes,
  }
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function ScholarshipFormFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: ScholarshipFormInput
  onChange: (values: ScholarshipFormInput) => void
  disabled?: boolean
}) {
  function set<K extends keyof ScholarshipFormInput>(
    key: K,
    value: ScholarshipFormInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${idPrefix}-name`} className="text-sm font-medium">
            Scholarship Name
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
          <label htmlFor={`${idPrefix}-amount`} className="text-sm font-medium">
            Amount
          </label>
          <input
            id={`${idPrefix}-amount`}
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={disabled}
            value={values.amount ?? ''}
            onChange={(event) => set('amount', event.target.value)}
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
            {SCHOLARSHIP_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${idPrefix}-deadline`}
            className="text-sm font-medium"
          >
            Deadline
          </label>
          <input
            id={`${idPrefix}-deadline`}
            type="date"
            disabled={disabled}
            value={values.deadline ?? ''}
            onChange={(event) => set('deadline', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-link`} className="text-sm font-medium">
            Link
          </label>
          <input
            id={`${idPrefix}-link`}
            type="url"
            placeholder="https://"
            disabled={disabled}
            value={values.link ?? ''}
            onChange={(event) => set('link', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>
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
  )
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const TD_CLASS = 'py-2 pr-4 align-top'

function DisplayRow({
  row,
  onEdit,
  onDeleted,
  studentId,
}: {
  row: ScholarshipRow
  onEdit: () => void
  onDeleted: () => void
  studentId: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  async function remove() {
    setError(null)
    setIsBusy(true)

    const result = await deleteScholarship(row.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onDeleted()
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/10">
      {COLUMNS.map((column) => (
        <td
          key={column.key}
          className={`${TD_CLASS} ${column.align === 'right' ? 'text-right' : ''}`}
        >
          {column.render(row)}
          {column.key === 'name' && error && <ErrorBanner message={error} />}
        </td>
      ))}

      <td className={`${TD_CLASS} whitespace-nowrap`}>
        <div className="flex gap-2">
          {isConfirmingDelete ? (
            // Text, not icons: a confirmation step should be unambiguous.
            <>
              <button
                type="button"
                onClick={remove}
                disabled={isBusy}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isBusy ? 'Removing…' : 'Confirm'}
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
              <EditIconButton label={`Edit ${row.name}`} onClick={onEdit} />
              <DeleteIconButton
                label={`Delete ${row.name}`}
                onClick={() => setIsConfirmingDelete(true)}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function EditRow({
  row,
  columnCount,
  studentId,
  onDone,
  onCancel,
}: {
  row: ScholarshipRow
  columnCount: number
  studentId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<ScholarshipFormInput>(() =>
    toFormInput(row)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateScholarship(row.id, studentId, values)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    onDone()
  }

  return (
    <tr className="border-b border-black/5 dark:border-white/10">
      <td colSpan={columnCount} className="py-3 pr-4">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">Editing {row.name}</h4>

          <ScholarshipFormFields
            idPrefix={`edit-scholarship-${row.id}`}
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
              onClick={onCancel}
              disabled={isSaving}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

type SortState = { key: string; direction: 'asc' | 'desc' }

/**
 * Outside scholarships, not tied to any one school. Merit aid offered BY a
 * school lives on that school's row in the Schools tab instead.
 */
export function ScholarshipsTab({
  scholarships,
  studentId,
}: {
  scholarships: ScholarshipRow[]
  studentId: string
}) {
  const router = useRouter()

  const [isAdding, setIsAdding] = useState(false)
  const [addValues, setAddValues] = useState<ScholarshipFormInput>(
    EMPTY_SCHOLARSHIP_FORM
  )
  const [addError, setAddError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' })

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const filtered = needle
      ? scholarships.filter((row) => row.name.toLowerCase().includes(needle))
      : scholarships

    const column = COLUMNS.find((candidate) => candidate.key === sort.key)

    if (!column) {
      return filtered
    }

    const factor = sort.direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const left = column.sortValue(a)
      const right = column.sortValue(b)

      // Nulls last whichever way the column points, so flipping direction never
      // buries the populated rows.
      if (left === null && right === null) return 0
      if (left === null) return 1
      if (right === null) return -1

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * factor
      }

      return String(left).localeCompare(String(right)) * factor
    })
  }, [scholarships, query, sort])

  function toggleSort(key: string) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  function closeAddForm() {
    setIsAdding(false)
    setAddValues(EMPTY_SCHOLARSHIP_FORM)
    setAddError(null)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddError(null)
    setIsSubmitting(true)

    const result = await createScholarship(studentId, addValues)
    setIsSubmitting(false)

    if (!result.ok) {
      setAddError(result.error)
      return
    }

    closeAddForm()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">Scholarships</h3>
          <p className="mt-0.5 text-xs opacity-60">
            Outside scholarships. Merit aid offered by a school is tracked on
            that school in the Schools tab.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add Scholarship
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">Add Scholarship</h4>

          <ScholarshipFormFields
            idPrefix="new-scholarship"
            values={addValues}
            onChange={setAddValues}
            disabled={isSubmitting}
          />

          {addError && <ErrorBanner message={addError} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? 'Saving…' : 'Save Scholarship'}
            </button>
            <button
              type="button"
              onClick={closeAddForm}
              disabled={isSubmitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search scholarships…"
          aria-label="Search scholarships by name"
          className={`${INPUT_CLASS} max-w-xs`}
        />

        {query.trim() && (
          <span className="text-xs opacity-60">
            {rows.length} of {scholarships.length}
          </span>
        )}
      </div>

      {scholarships.length === 0 ? (
        <p className="text-sm opacity-70">No scholarships tracked yet.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm opacity-70">No scholarships match that search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                {COLUMNS.map((column) => {
                  const isSorted = sort.key === column.key

                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        isSorted
                          ? sort.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      className={`py-2 pr-4 font-medium ${
                        column.align === 'right' ? 'text-right' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="whitespace-nowrap hover:underline"
                      >
                        {column.label}
                        <span aria-hidden="true" className="ml-1 opacity-60">
                          {isSorted ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                    </th>
                  )
                })}
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                editingId === row.id ? (
                  <EditRow
                    key={row.id}
                    row={row}
                    columnCount={COLUMNS.length + 1}
                    studentId={studentId}
                    onDone={() => {
                      setEditingId(null)
                      router.refresh()
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <DisplayRow
                    key={row.id}
                    row={row}
                    studentId={studentId}
                    onEdit={() => setEditingId(row.id)}
                    onDeleted={() => router.refresh()}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
