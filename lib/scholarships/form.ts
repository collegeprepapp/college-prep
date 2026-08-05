/**
 * Form shape for scholarships.
 *
 * Lives OUTSIDE the server-actions file: a 'use server' module may only export
 * async functions, and exporting a plain object from one leaves the client
 * import unresolved — which shows up as inputs flipping from uncontrolled to
 * controlled. Types are erased and safe to export from an actions file; values
 * are not.
 */

export type ScholarshipFormInput = {
  name: string
  amount: string
  status: string
  deadline: string
  link: string
  notes: string
}

/** Every key present and non-undefined, so the inputs are controlled from first render. */
export const EMPTY_SCHOLARSHIP_FORM: ScholarshipFormInput = {
  name: '',
  amount: '',
  status: 'researching',
  deadline: '',
  link: '',
  notes: '',
}
