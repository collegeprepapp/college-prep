/**
 * The last of the demo data. Every other tab is now backed by a real table;
 * only the Test Scores fallback below remains, and it disappears as soon as
 * real scores are being entered (see TestScoresTab in student-detail-tabs.tsx).
 */

/**
 * Unlike everything else here, the Test Scores tab is a REAL feature backed by
 * public.test_scores. These rows are only a stand-in for a student who has none
 * recorded yet, so a demo has something to show. Real scores always win.
 *
 * Dates are plain ISO strings because that is what the date column returns and
 * how the tab renders them.
 */
export type DemoTestScore = {
  id: string
  test_type: string
  score: number
  test_date: string | null
}

export const DEMO_TEST_SCORES: DemoTestScore[] = [
  { id: 'score-1', test_type: 'SAT', score: 1340, test_date: '2026-06-06' },
  { id: 'score-2', test_type: 'ACT', score: 29, test_date: '2026-04-11' },
  { id: 'score-3', test_type: 'SAT', score: 1280, test_date: '2026-03-14' },
]
