/**
 * DEMO DATA — hardcoded, fictional, and not connected to Supabase.
 *
 * This exists to give the Notes / Schools / Scholarships / Essays / Activities
 * / Docs tabs something realistic to show before those features are built. It
 * is identical for every student, because nothing here is fetched.
 *
 * Delete this file when the real tables land; anything importing it is a
 * mockup, so the imports are the checklist of what still needs building.
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

export type DemoDoc = {
  id: string
  filename: string
  uploadedAt: string
  size: string
  /** Drives the placeholder icon only. */
  kind: 'pdf' | 'image' | 'doc' | 'sheet'
}

export const DEMO_DOCS: DemoDoc[] = [
  {
    id: 'doc-1',
    filename: 'transcript-junior-year.pdf',
    uploadedAt: 'Jul 28, 2026',
    size: '184 KB',
    kind: 'pdf',
  },
  {
    id: 'doc-2',
    filename: 'recommendation-rivera.docx',
    uploadedAt: 'Jul 22, 2026',
    size: '46 KB',
    kind: 'doc',
  },
  {
    id: 'doc-3',
    filename: 'fafsa-summary-2026.pdf',
    uploadedAt: 'Jul 5, 2026',
    size: '312 KB',
    kind: 'pdf',
  },
]
