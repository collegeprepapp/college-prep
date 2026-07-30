/**
 * Month index (0-based) the school year rolls over on: August.
 * From August onward, the school year is the one ending the FOLLOWING spring.
 */
const ROLLOVER_MONTH = 7

/**
 * The calendar year the current school year ends in.
 *
 * August 2026 -> 2027 (the year that ends spring 2027)
 * March  2027 -> 2027 (same school year, second half)
 */
export function getSchoolYearEnd(now: Date = new Date()): number {
  return now.getMonth() >= ROLLOVER_MONTH ? now.getFullYear() + 1 : now.getFullYear()
}

/**
 * The student's current grade level, derived from their graduation year.
 *
 * A student is in grade 12 during the school year ending the spring they
 * graduate, and each earlier year steps back one grade.
 *
 *   graduating 2027, during the year ending 2027 -> 12
 *   graduating 2027, during the year ending 2026 -> 11
 *
 * The result is NOT clamped to 6-12: someone who has already graduated returns
 * 13 or higher, and a distant graduation year returns below 6. Callers get no
 * matching timeline_templates in those cases, which is the intended outcome.
 *
 * Uses the server's local clock and timezone. Only the month boundary matters,
 * so an off-by-hours timezone difference is only visible on 31 July / 1 August.
 */
export function getCurrentGradeLevel(
  graduationYear: number,
  now: Date = new Date()
): number {
  return 12 - graduationYear + getSchoolYearEnd(now)
}
