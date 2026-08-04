'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Filter } from 'lucide-react'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
} from '@/lib/college-applications/status'
import {
  createApplication,
  deleteApplication,
  updateApplication,
} from './applications-actions'
import {
  EMPTY_APPLICATION_FORM,
  type ApplicationFormInput,
} from '@/lib/college-applications/form'
import { ApplicationFormFields } from './application-form-fields'

/**
 * One row, with dates and currency preformatted on the server and the raw
 * values kept alongside for the edit form and for sorting.
 */
export type ApplicationRow = {
  id: string
  schoolName: string
  status: string
  deadline: string
  deadlineLabel: string
  dateToured: string
  dateTouredLabel: string
  goalCompletionDate: string
  goalCompletionDateLabel: string
  requiresCommonAppEssay: boolean
  requiresSupplementalEssay: boolean
  recommendationsNeeded: number | null
  recommendationNotes: string
  websiteLink: string
  scholarshipInfoLink: string
  resumeLink: string
  otherLinks: string
  admissionRepName: string
  admissionRepEmail: string
  scholarshipAmount: number | null
  scholarshipAmountLabel: string
  notes: string
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, string> = {
  researching: 'border-black/15 bg-black/5 dark:border-white/20 dark:bg-white/10',
  touring: 'border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400',
  applied:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  accepted:
    'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  committed:
    'border-purple-600/30 bg-purple-600/10 text-purple-700 dark:text-purple-400',
  waitlisted:
    'border-orange-600/30 bg-orange-600/10 text-orange-700 dark:text-orange-400',
  denied: 'border-red-600/25 bg-red-600/5 text-red-700/80 dark:text-red-400/80',
}

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.researching

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {applicationStatusLabel(status)}
    </span>
  )
}

/**
 * Links are user-entered, so they are rendered as href only when they are
 * plainly http(s). Anything else — most importantly a `javascript:` URL — is
 * shown as inert text instead, since an anchor would execute it on click.
 * A bare "www.example.com" is upgraded to https rather than dropped.
 */
function safeHref(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  // No scheme at all and no colon anywhere: safe to assume a bare domain.
  if (!trimmed.includes(':')) {
    return `https://${trimmed}`
  }

  return null
}

function LinkCell({ row }: { row: ApplicationRow }) {
  const links = [
    { label: 'Site', value: row.websiteLink },
    { label: 'Scholarship', value: row.scholarshipInfoLink },
    { label: 'Resume', value: row.resumeLink },
    { label: 'Other', value: row.otherLinks },
  ].filter((link) => link.value.trim())

  if (links.length === 0) {
    return <span className="opacity-40">—</span>
  }

  return (
    <span className="flex flex-wrap gap-2">
      {links.map((link) => {
        const href = safeHref(link.value)

        return href ? (
          <a
            key={link.label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.value}
            className="whitespace-nowrap text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            {link.label}
          </a>
        ) : (
          <span
            key={link.label}
            title={link.value}
            className="whitespace-nowrap text-xs opacity-50"
          >
            {link.label}
          </span>
        )
      })}
    </span>
  )
}

function Flag({ on }: { on: boolean }) {
  return on ? (
    <span aria-label="Yes" title="Yes">
      ✓
    </span>
  ) : (
    <span aria-label="No" className="opacity-40">
      —
    </span>
  )
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
  sortValue: (row: ApplicationRow) => SortValue
  render: (row: ApplicationRow) => React.ReactNode
  /** Numeric-ish columns right-align. */
  align?: 'right'
}

// Keyed as string, not the literal union: status comes back from the database
// as plain text, so a value outside the vocabulary must still be lookup-able
// (it falls to the end of the sort rather than failing to compile).
const STATUS_ORDER = new Map<string, number>(
  APPLICATION_STATUSES.map((status, index) => [status.value, index])
)

const COLUMNS: Column[] = [
  {
    key: 'school',
    label: 'School',
    sortValue: (row) => row.schoolName.toLowerCase(),
    render: (row) => <span className="font-medium">{row.schoolName}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    // Sorted by pipeline order rather than alphabetically, so the column reads
    // as progress instead of putting Accepted next to Applied by accident.
    sortValue: (row) => STATUS_ORDER.get(row.status) ?? 99,
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'dateToured',
    label: 'Toured',
    sortValue: (row) => row.dateToured || null,
    render: (row) => dash(row.dateTouredLabel),
  },
  {
    key: 'deadline',
    label: 'Deadline',
    sortValue: (row) => row.deadline || null,
    render: (row) => dash(row.deadlineLabel),
  },
  {
    key: 'goal',
    label: 'Goal Date',
    sortValue: (row) => row.goalCompletionDate || null,
    render: (row) => dash(row.goalCompletionDateLabel),
  },
  {
    key: 'commonApp',
    label: 'Common App',
    sortValue: (row) => (row.requiresCommonAppEssay ? 1 : 0),
    render: (row) => <Flag on={row.requiresCommonAppEssay} />,
  },
  {
    key: 'supplemental',
    label: 'Supplemental',
    sortValue: (row) => (row.requiresSupplementalEssay ? 1 : 0),
    render: (row) => <Flag on={row.requiresSupplementalEssay} />,
  },
  {
    key: 'recommendations',
    label: 'Recs',
    sortValue: (row) => row.recommendationsNeeded,
    render: (row) => (
      <span className="flex flex-col">
        <span>{row.recommendationsNeeded ?? <span className="opacity-40">—</span>}</span>
        {row.recommendationNotes && (
          <span className="text-xs opacity-70">{row.recommendationNotes}</span>
        )}
      </span>
    ),
  },
  {
    key: 'links',
    label: 'Links',
    sortValue: (row) =>
      [row.websiteLink, row.scholarshipInfoLink, row.resumeLink, row.otherLinks]
        .filter((value) => value.trim()).length,
    render: (row) => <LinkCell row={row} />,
  },
  {
    key: 'rep',
    label: 'Admissions Rep',
    sortValue: (row) => row.admissionRepName.toLowerCase() || null,
    render: (row) =>
      row.admissionRepName || row.admissionRepEmail ? (
        <span className="flex flex-col">
          <span>{row.admissionRepName}</span>
          {row.admissionRepEmail && (
            <a
              href={`mailto:${row.admissionRepEmail}`}
              className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              {row.admissionRepEmail}
            </a>
          )}
        </span>
      ) : (
        <span className="opacity-40">—</span>
      ),
  },
  {
    key: 'scholarship',
    label: 'Scholarship',
    sortValue: (row) => row.scholarshipAmount,
    align: 'right',
    render: (row) => dash(row.scholarshipAmountLabel),
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

function toFormInput(row: ApplicationRow): ApplicationFormInput {
  return {
    schoolName: row.schoolName,
    status: row.status,
    deadline: row.deadline,
    dateToured: row.dateToured,
    goalCompletionDate: row.goalCompletionDate,
    requiresCommonAppEssay: row.requiresCommonAppEssay,
    requiresSupplementalEssay: row.requiresSupplementalEssay,
    recommendationsNeeded:
      row.recommendationsNeeded === null ? '' : String(row.recommendationsNeeded),
    recommendationNotes: row.recommendationNotes,
    websiteLink: row.websiteLink,
    scholarshipInfoLink: row.scholarshipInfoLink,
    resumeLink: row.resumeLink,
    otherLinks: row.otherLinks,
    admissionRepName: row.admissionRepName,
    admissionRepEmail: row.admissionRepEmail,
    scholarshipAmount:
      row.scholarshipAmount === null ? '' : String(row.scholarshipAmount),
    notes: row.notes,
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const TD_CLASS = 'py-2 pr-4 align-top'

function DisplayRow({
  row,
  columns,
  onEdit,
  onDeleted,
  studentId,
}: {
  row: ApplicationRow
  columns: Column[]
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

    const result = await deleteApplication(row.id, studentId)
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
      {columns.map((column) => (
        <td
          key={column.key}
          className={`${TD_CLASS} ${column.align === 'right' ? 'text-right' : ''}`}
        >
          {column.render(row)}
          {column.key === 'school' && error && <ErrorBanner message={error} />}
        </td>
      ))}

      <td className={`${TD_CLASS} whitespace-nowrap`}>
        <div className="flex gap-2">
          {isConfirmingDelete ? (
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
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${row.schoolName}`}
                className={SECONDARY_BUTTON_CLASS}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                aria-label={`Delete ${row.schoolName}`}
                className={SECONDARY_BUTTON_CLASS}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * Editing replaces the row with a single full-width cell holding the whole
 * form. With seventeen editable fields, per-cell inputs would be unreadable and
 * would break as soon as a column is hidden.
 */
function EditRow({
  row,
  columnCount,
  studentId,
  onDone,
  onCancel,
}: {
  row: ApplicationRow
  columnCount: number
  studentId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<ApplicationFormInput>(() =>
    toFormInput(row)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateApplication(row.id, studentId, values)
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
          <h4 className="text-sm font-medium">Editing {row.schoolName}</h4>

          <ApplicationFormFields
            idPrefix={`edit-application-${row.id}`}
            values={values}
            onChange={setValues}
            disabled={isSaving}
            detailsOpenByDefault
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

export function SchoolsTab({
  applications,
  studentId,
}: {
  applications: ApplicationRow[]
  studentId: string
}) {
  const router = useRouter()

  const [isAdding, setIsAdding] = useState(false)
  const [addValues, setAddValues] = useState<ApplicationFormInput>(
    EMPTY_APPLICATION_FORM
  )
  const [addError, setAddError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortState>({
    key: 'school',
    direction: 'asc',
  })

  // Session-only, as specified: nothing is persisted, so a reload restores all
  // columns.
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  // Only one popover is open at a time, so the two cannot overlap.
  const [openMenu, setOpenMenu] = useState<'columns' | 'filters' | null>(null)

  const visibleColumns = COLUMNS.filter(
    (column) => !hiddenColumns.has(column.key)
  )

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const filtered = applications.filter((row) => {
      const matchesQuery =
        !needle || row.schoolName.toLowerCase().includes(needle)
      const matchesStatus =
        statusFilter.size === 0 || statusFilter.has(row.status)

      return matchesQuery && matchesStatus
    })

    const column = COLUMNS.find((candidate) => candidate.key === sort.key)

    if (!column) {
      return filtered
    }

    const factor = sort.direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      const left = column.sortValue(a)
      const right = column.sortValue(b)

      // Nulls sort last whichever way the column is pointing, so flipping the
      // direction never buries the populated rows.
      if (left === null && right === null) return 0
      if (left === null) return 1
      if (right === null) return -1

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * factor
      }

      return String(left).localeCompare(String(right)) * factor
    })
  }, [applications, query, statusFilter, sort])

  function toggleSort(key: string) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    )
  }

  function toggleStatus(value: string) {
    setStatusFilter((current) => {
      const next = new Set(current)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }

  function toggleColumn(key: string) {
    setHiddenColumns((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function closeAddForm() {
    setIsAdding(false)
    setAddValues(EMPTY_APPLICATION_FORM)
    setAddError(null)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddError(null)
    setIsSubmitting(true)

    const result = await createApplication(studentId, addValues)
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
        <h3 className="text-base font-medium">Schools</h3>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setOpenMenu((current) => (current === 'columns' ? null : 'columns'))
              }
              aria-expanded={openMenu === 'columns'}
              className={SECONDARY_BUTTON_CLASS}
            >
              Columns
              {hiddenColumns.size > 0 && ` (${visibleColumns.length})`}
            </button>

            {openMenu === 'columns' && (
              <div className="absolute right-0 z-10 mt-1 flex w-56 flex-col gap-1 rounded-md border border-black/15 bg-background p-3 shadow-lg dark:border-white/20">
                {COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenColumns.has(column.key)}
                      onChange={() => toggleColumn(column.key)}
                      className="size-4"
                    />
                    {column.label}
                  </label>
                ))}

                <button
                  type="button"
                  onClick={() => setHiddenColumns(new Set())}
                  className="mt-2 self-start text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                >
                  Show all
                </button>
              </div>
            )}
          </div>

          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className={PRIMARY_BUTTON_CLASS}
            >
              Add School
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">Add School</h4>

          <ApplicationFormFields
            idPrefix="new-application"
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
              {isSubmitting ? 'Saving…' : 'Save School'}
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
          placeholder="Search schools…"
          aria-label="Search schools by name"
          className={`${INPUT_CLASS} max-w-xs`}
        />

        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((current) => (current === 'filters' ? null : 'filters'))
            }
            aria-expanded={openMenu === 'filters'}
            aria-label={
              statusFilter.size > 0
                ? `Filters, ${statusFilter.size} active`
                : 'Filters'
            }
            className={`relative flex items-center gap-2 ${SECONDARY_BUTTON_CLASS}`}
          >
            <Filter aria-hidden="true" className="size-4" />
            Filters
            {/* Count badge, so an active filter is visible while the popover
                is closed — otherwise a filtered table looks like an empty one. */}
            {statusFilter.size > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                {statusFilter.size}
              </span>
            )}
          </button>

          {openMenu === 'filters' && (
            <div className="absolute left-0 z-10 mt-1 flex w-56 flex-col gap-2 rounded-md border border-black/15 bg-background p-3 shadow-lg dark:border-white/20">
              <span className="text-xs font-medium uppercase tracking-wide opacity-60">
                Status
              </span>

              <div className="flex flex-col gap-1">
                {APPLICATION_STATUSES.map((status) => (
                  <label
                    key={status.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={statusFilter.has(status.value)}
                      onChange={() => toggleStatus(status.value)}
                      className="size-4"
                    />
                    {status.label}
                  </label>
                ))}
              </div>

              {statusFilter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter(new Set())}
                  className="self-start text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {(query.trim() || statusFilter.size > 0) && (
          <span className="text-xs opacity-60">
            {rows.length} of {applications.length}
          </span>
        )}
      </div>

      {applications.length === 0 ? (
        <p className="text-sm opacity-70">No schools on this list yet.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm opacity-70">No schools match these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                {visibleColumns.map((column) => {
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
                    columnCount={visibleColumns.length + 1}
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
                    columns={visibleColumns}
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
