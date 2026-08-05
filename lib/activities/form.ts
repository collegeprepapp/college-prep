/**
 * Form shape for activities. Outside the server-actions file: a 'use server'
 * module may only export async functions.
 */
export type ActivityFormInput = {
  name: string
  yearsParticipated: string
  hoursPerWeek: string
  weeksPerYear: string
  description: string
  leadershipActions: string
}

export const EMPTY_ACTIVITY_FORM: ActivityFormInput = {
  name: '',
  yearsParticipated: '',
  hoursPerWeek: '',
  weeksPerYear: '',
  description: '',
  leadershipActions: '',
}
