/**
 * Form shape for college_applications, mirroring lib/students/form.ts.
 *
 * This lives OUTSIDE the server-actions file on purpose. A 'use server' module
 * may only export async functions — exporting a plain object from one throws
 * "A \"use server\" file can only export async functions, found object" at
 * runtime, and on the client the import does not resolve to the object, so
 * every field reads undefined and React reports inputs flipping from
 * uncontrolled to controlled. Types are erased at compile time and are safe to
 * export from an actions file; values are not.
 */

/** Raw form values: text inputs give strings, checkboxes give booleans. */
export type ApplicationFormInput = {
  schoolName: string
  status: string
  deadline: string
  dateToured: string
  goalCompletionDate: string
  requiresCommonAppEssay: boolean
  requiresSupplementalEssay: boolean
  recommendationsNeeded: string
  recommendationNotes: string
  websiteLink: string
  scholarshipInfoLink: string
  resumeLink: string
  otherLinks: string
  admissionRepName: string
  admissionRepEmail: string
  scholarshipAmount: string
  notes: string
}

/**
 * Every key is present and non-undefined, which is what keeps the form's inputs
 * controlled from their first render.
 */
export const EMPTY_APPLICATION_FORM: ApplicationFormInput = {
  schoolName: '',
  status: 'researching',
  deadline: '',
  dateToured: '',
  goalCompletionDate: '',
  requiresCommonAppEssay: false,
  requiresSupplementalEssay: false,
  recommendationsNeeded: '',
  recommendationNotes: '',
  websiteLink: '',
  scholarshipInfoLink: '',
  resumeLink: '',
  otherLinks: '',
  admissionRepName: '',
  admissionRepEmail: '',
  scholarshipAmount: '',
  notes: '',
}
