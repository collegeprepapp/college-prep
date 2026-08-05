/**
 * Form shape for activities. Outside the server-actions file: a 'use server'
 * module may only export async functions.
 */
export type ActivityFormInput = {
  name: string
  yearsParticipated: string
  /** Free text from the form; parsed to a numeric column server-side. */
  totalHours: string
  description: string
  leadershipActions: string
}

export const EMPTY_ACTIVITY_FORM: ActivityFormInput = {
  name: '',
  yearsParticipated: '',
  totalHours: '',
  description: '',
  leadershipActions: '',
}
