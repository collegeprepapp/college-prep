/**
 * Form shape for honors. Outside the server-actions file: a 'use server'
 * module may only export async functions.
 */
export type HonorFormInput = {
  name: string
  yearEarned: string
  organizationName: string
  description: string
}

export const EMPTY_HONOR_FORM: HonorFormInput = {
  name: '',
  yearEarned: '',
  organizationName: '',
  description: '',
}
