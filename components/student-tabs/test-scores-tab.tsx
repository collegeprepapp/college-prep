'use client'

import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '@/components/student-form-fields'
import { EditIconButton } from '@/components/icon-button'

export type TestScoreRow = {
  id: string
  test_type: string
  score: number
  test_date: string | null
}

/**
 * Sample scores shown ONLY when a student has none recorded, so a demo is not
 * blank. Delete this and the fallback branch below once real scores are being
 * entered. Previously lived in the admin folder's demo-data.ts; it moved here
 * with the component so the shared module has no dependency on an app route.
 */
const DEMO_TEST_SCORES: TestScoreRow[] = [
  { id: 'score-1', test_type: 'SAT', score: 1340, test_date: '2026-06-06' },
  { id: 'score-2', test_type: 'ACT', score: 29, test_date: '2026-04-11' },
  { id: 'score-3', test_type: 'SAT', score: 1280, test_date: '2026-03-14' },
]

/**
 * The only tab that mixes real and demo data.
 *
 * test_scores is a real table, so genuine rows always render. The sample SAT/ACT
 * scores appear ONLY when a student has none recorded, so the tab is not blank
 * in a demo — and they are labelled, because unlabelled fake scores on a working
 * feature would be indistinguishable from real ones. Delete the fallback branch
 * (and DEMO_TEST_SCORES) once real scores are being entered.
 */
export function TestScoresTab({ scores }: { scores: TestScoreRow[] }) {
  const isDemo = scores.length === 0
  const rows = isDemo ? DEMO_TEST_SCORES : scores

  return (
    <div className="flex flex-col gap-4">
      {/* Header markup mirrors the demo tabs but is inlined rather than shared,
          so this real tab does not break when demo-tabs.tsx is deleted. */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Test Scores</h3>
        <button type="button" className={PRIMARY_BUTTON_CLASS}>
          Add Test Score
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((score) => (
          <li
            key={score.id}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span>
              <span className="font-medium">{score.test_type}</span>{' '}
              {score.score}
              <span className="opacity-60">
                {score.test_date ? ` — ${score.test_date}` : ''}
              </span>
            </span>

            {/* Inert: editing a score is not built yet. */}
            <span className="shrink-0">
              <EditIconButton
                label={`Edit ${score.test_type} score of ${score.score}`}
              />
            </span>
          </li>
        ))}
      </ul>

      {isDemo && (
        <p className="text-xs opacity-50">
          Sample scores — nothing recorded for this student yet.
        </p>
      )}
    </div>
  )
}
