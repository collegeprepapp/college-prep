/**
 * Test score vocabulary, plausible ranges, and the form shape.
 *
 * Plain module, not 'use server' — it exports values.
 */

/** The two the check constraint in migration 003 allows. */
export const TEST_TYPES = ['SAT', 'ACT'] as const

export type TestType = (typeof TEST_TYPES)[number]

export function isTestType(value: string): value is TestType {
  return TEST_TYPES.includes(value as TestType)
}

/**
 * Plausible totals per test, used to catch an obvious slip — a 1450 entered
 * against ACT is a mistake, not a record-breaking score. The column itself is
 * an unconstrained integer (migration 003), so this lives in code where it can
 * change if a test is rescaled.
 */
export const SCORE_RANGES: Record<TestType, { min: number; max: number }> = {
  SAT: { min: 400, max: 1600 },
  ACT: { min: 1, max: 36 },
}

export type TestScoreInput = {
  testType: string
  score: string
  /** 'YYYY-MM-DD' from a date input, or '' for none. */
  testDate: string
}

export const EMPTY_TEST_SCORE: TestScoreInput = {
  testType: 'SAT',
  score: '',
  testDate: '',
}
