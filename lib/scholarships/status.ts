/**
 * The status vocabulary for scholarships.
 *
 * Stored lowercase (the check constraint in migration 013 allows only these
 * four), displayed capitalized. A <select> using value/label handles the round
 * trip in both directions without a second map.
 */

export const SCHOLARSHIP_STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'applied', label: 'Applied' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'denied', label: 'Denied' },
] as const

export type ScholarshipStatus = (typeof SCHOLARSHIP_STATUSES)[number]['value']

export const DEFAULT_SCHOLARSHIP_STATUS: ScholarshipStatus = 'researching'

export function isScholarshipStatus(value: string): value is ScholarshipStatus {
  return SCHOLARSHIP_STATUSES.some((status) => status.value === value)
}

/** Falls back to the raw value rather than throwing, so an unknown status still renders. */
export function scholarshipStatusLabel(value: string): string {
  return (
    SCHOLARSHIP_STATUSES.find((status) => status.value === value)?.label ?? value
  )
}
