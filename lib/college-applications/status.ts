/**
 * The status vocabulary for college_applications.
 *
 * Stored lowercase (the check constraint in migration 011 allows only these
 * five), displayed capitalized. Keeping both halves in one table means the
 * display label and the stored value cannot drift apart, and a <select> using
 * value/label handles the round trip in both directions without a second map.
 *
 * PERMANENT — unlike ./types.ts in this directory, this is app logic rather
 * than a stand-in for generated types.
 */

/**
 * Ordered roughly as an application progresses, since this array drives the
 * dropdown. The two outcomes added in migration 012 sit at the end rather than
 * next to 'accepted', so the common path reads top to bottom.
 */
export const APPLICATION_STATUSES = [
  { value: 'researching', label: 'Researching' },
  { value: 'touring', label: 'Touring' },
  { value: 'applied', label: 'Applied' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'committed', label: 'Committed' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'denied', label: 'Denied' },
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]['value']

export const DEFAULT_APPLICATION_STATUS: ApplicationStatus = 'researching'

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUSES.some((status) => status.value === value)
}

/**
 * Display label for a stored value. Falls back to the raw value rather than
 * throwing, so a status added to the database but not here still renders.
 */
export function applicationStatusLabel(value: string): string {
  return (
    APPLICATION_STATUSES.find((status) => status.value === value)?.label ?? value
  )
}
