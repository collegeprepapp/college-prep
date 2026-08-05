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
  EMPTY_TEST_SCORE,
  SCORE_RANGES,
  TEST_TYPES,
  isTestType,
  type TestScoreInput,
} from '@/lib/test-scores/form'
import {
  createTestScore,
  deleteTestScore,
  updateTestScore,
} from './test-scores-actions'

export type TestScoreRow = {
  id: string
  testType: string
  score: number
  /** Raw 'YYYY-MM-DD' for the date input, or '' when unset. */
  testDate: string
  /** Formatted server-side so the browser never re-derives a different date. */
  testDateLabel: string
}

function toInput(row: TestScoreRow): TestScoreInput {
  return {
    testType: row.testType,
    score: String(row.score),
    testDate: row.testDate,
  }
}

function ScoreFields({
  idPrefix,
  values,
  onChange,
  disabled,
}: {
  idPrefix: string
  values: TestScoreInput
  onChange: (next: TestScoreInput) => void
  disabled?: boolean
}) {
  function set<K extends keyof TestScoreInput>(key: K, value: TestScoreInput[K]) {
    onChange({ ...values, [key]: value })
  }

  // Bounds follow the selected test, so the browser's own validation agrees
  // with the server's — an ACT field will not accept 1450.
  const range = isTestType(values.testType)
    ? SCORE_RANGES[values.testType]
    : { min: 0, max: 1600 }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-type`} className="text-sm font-medium">
          Test
        </label>
        <select
          id={`${idPrefix}-type`}
          disabled={disabled}
          value={values.testType ?? 'SAT'}
          onChange={(event) => set('testType', event.target.value)}
          className={INPUT_CLASS}
        >
          {TEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-score`} className="text-sm font-medium">
          Score
        </label>
        <input
          id={`${idPrefix}-score`}
          type="number"
          required
          min={range.min}
          max={range.max}
          step={1}
          disabled={disabled}
          value={values.score ?? ''}
          onChange={(event) => set('score', event.target.value)}
          className={INPUT_CLASS}
        />
        <p className="text-xs opacity-60">
          {range.min}–{range.max}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-date`} className="text-sm font-medium">
          Test Date
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          disabled={disabled}
          value={values.testDate ?? ''}
          onChange={(event) => set('testDate', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  )
}

function ScoreItem({
  row,
  studentId,
  onChanged,
}: {
  row: TestScoreRow
  studentId: string
  onChanged: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<TestScoreInput>(() => toInput(row))
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const label = `${row.testType} ${row.score}`

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await updateTestScore(row.id, studentId, values)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setIsEditing(false)
    onChanged()
  }

  async function remove() {
    setError(null)
    setIsBusy(true)

    const result = await deleteTestScore(row.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onChanged()
  }

  if (isEditing) {
    return (
      <li className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <form onSubmit={save} className="flex flex-col gap-4">
          <ScoreFields
            idPrefix={`edit-score-${row.id}`}
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
                setValues(toInput(row))
                setError(null)
                setIsEditing(false)
              }}
              disabled={isBusy}
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
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm">
          <span className="font-medium">{row.testType}</span> {row.score}
          {row.testDateLabel && (
            <span className="opacity-60"> — {row.testDateLabel}</span>
          )}
        </span>

        <div className="flex shrink-0 gap-2">
          {isConfirmingDelete ? (
            <>
              <span className="self-center text-xs opacity-70">Delete?</span>
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
              <EditIconButton
                label={`Edit ${label}`}
                onClick={() => {
                  setValues(toInput(row))
                  setError(null)
                  setIsConfirmingDelete(false)
                  setIsEditing(true)
                }}
              />
              <DeleteIconButton
                label={`Delete ${label}`}
                onClick={() => setIsConfirmingDelete(true)}
              />
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
    </li>
  )
}

/**
 * SAT and ACT results on record.
 *
 * No sample data: the tab showed placeholder scores while it was read-only, so
 * a demo would not be blank. Now that scores can actually be entered, fake ones
 * would sit next to real ones with nothing to tell them apart — an empty list
 * says it is empty.
 */
export function TestScoresTab({
  scores,
  studentId,
}: {
  scores: TestScoreRow[]
  studentId: string
}) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [values, setValues] = useState<TestScoreInput>(EMPTY_TEST_SCORE)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  function closeForm() {
    setIsAdding(false)
    setValues(EMPTY_TEST_SCORE)
    setError(null)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(true)

    const result = await createTestScore(studentId, values)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    closeForm()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Test Scores</h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add Test Score
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">Add Test Score</h4>

          <ScoreFields
            idPrefix="new-score"
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
              {isBusy ? 'Saving…' : 'Save Score'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isBusy}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {scores.length === 0 ? (
        <p className="text-sm opacity-70">No test scores recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {scores.map((row) => (
            <ScoreItem
              key={row.id}
              row={row}
              studentId={studentId}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
