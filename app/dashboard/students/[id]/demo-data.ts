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

export type ScholarshipStatus = 'Researching' | 'Applied' | 'Awarded' | 'Denied'

export type DemoScholarship = {
  id: string
  name: string
  amount: string
  status: ScholarshipStatus
  deadline: string
}

export const DEMO_SCHOLARSHIPS: DemoScholarship[] = [
  {
    id: 'scholarship-1',
    name: 'Zell Miller Scholarship',
    amount: '$8,400',
    status: 'Applied',
    deadline: 'Sep 30, 2026',
  },
  {
    id: 'scholarship-2',
    name: 'Coca-Cola Scholars Program',
    amount: '$20,000',
    status: 'Researching',
    deadline: 'Oct 2, 2026',
  },
  {
    id: 'scholarship-3',
    name: 'Walnut Grove Alumni Award',
    amount: '$2,500',
    status: 'Awarded',
    deadline: 'Jun 15, 2026',
  },
  {
    id: 'scholarship-4',
    name: 'Regional Rotary Grant',
    amount: '$1,000',
    status: 'Denied',
    deadline: 'May 1, 2026',
  },
]

export type DemoEssay = {
  id: string
  title: string
  promptFor: string
  lastEdited: string
  wordCount: number
}

export const DEMO_ESSAYS: DemoEssay[] = [
  {
    id: 'essay-1',
    title: 'The Summer I Rebuilt the Concession Stand',
    promptFor: 'Common App — Prompt 3: Challenging a belief',
    lastEdited: 'Jul 30, 2026',
    wordCount: 612,
  },
  {
    id: 'essay-2',
    title: 'Why Belmont',
    promptFor: 'Belmont University — Supplemental',
    lastEdited: 'Jul 18, 2026',
    wordCount: 244,
  },
]

export type ActivityCategory =
  | 'Volunteer'
  | 'Leadership'
  | 'Athletics'
  | 'Arts'
  | 'Work'

export type DemoActivity = {
  id: string
  name: string
  hours: number
  category: ActivityCategory
  dateRange: string
}

export const DEMO_ACTIVITIES: DemoActivity[] = [
  {
    id: 'activity-1',
    name: 'Varsity Cross Country',
    hours: 220,
    category: 'Athletics',
    dateRange: 'Aug 2024 — Present',
  },
  {
    id: 'activity-2',
    name: 'Student Council — Class Treasurer',
    hours: 90,
    category: 'Leadership',
    dateRange: 'Sep 2025 — Present',
  },
  {
    id: 'activity-3',
    name: 'Food Bank Weekend Crew',
    hours: 145,
    category: 'Volunteer',
    dateRange: 'Jun 2024 — Aug 2026',
  },
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
