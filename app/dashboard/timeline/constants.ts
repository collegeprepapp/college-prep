// Plain module, not 'use server' or 'use client': both the server actions and
// the form components need these, and a 'use server' file may only export async
// functions.

export const SEASONS = ['Fall', 'Winter', 'Spring', 'Summer'] as const

export type Season = (typeof SEASONS)[number]

export const AUDIENCES = ['student', 'parent', 'both'] as const

export type Audience = (typeof AUDIENCES)[number]

export const GRADE_LEVELS = [6, 7, 8, 9, 10, 11, 12] as const

export const AUDIENCE_LABELS: Record<Audience, string> = {
  student: 'Student',
  parent: 'Parent',
  both: 'Student & Parent',
}

/** Raw form values — everything is a string because it comes from inputs. */
export type TemplateFormInput = {
  icon: string
  title: string
  description: string
  gradeLevel: string
  season: string
  audience: string
}

export const EMPTY_TEMPLATE_FORM: TemplateFormInput = {
  icon: '',
  title: '',
  description: '',
  gradeLevel: '9',
  season: 'Fall',
  audience: 'student',
}
