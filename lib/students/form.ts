/**
 * Shared shape and validation for the student record fields.
 *
 * Two places write these columns — the admin forms under /dashboard/students
 * and a student editing their own record in the portal — and both must agree on
 * the rules (notably the GPA ceiling, which is a column limit rather than a
 * preference). Keeping the parser here means neither can drift.
 *
 * Plain module, not 'use server': a 'use server' file may only export async
 * functions, and this exports types and constants too.
 */

/** Raw form values — everything is a string because it comes from inputs. */
export type StudentFormInput = {
  firstName: string
  lastName: string
  graduationYear: string
  email: string
  gpa: string
  classRank: string
}

export const EMPTY_STUDENT_FORM: StudentFormInput = {
  firstName: '',
  lastName: '',
  graduationYear: '',
  email: '',
  gpa: '',
  classRank: '',
}

/** Column-shaped values, ready to hand to Supabase. */
export type StudentFields = {
  first_name: string
  last_name: string
  graduation_year: number
  email: string | null
  gpa: number | null
  class_rank: string | null
}

// gpa is numeric(3,2): three total digits, two after the decimal point, so
// anything at or above 10 overflows the column and Postgres raises 22003.
export const MAX_GPA = 9.99

export const MIN_GRADUATION_YEAR = 1900
export const MAX_GRADUATION_YEAR = 2100

export function parseStudentFields(
  input: StudentFormInput
): { ok: true; fields: StudentFields } | { ok: false; error: string } {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  if (!firstName || !lastName) {
    return { ok: false, error: 'First and last name are both required.' }
  }

  const graduationYear = Number(input.graduationYear.trim())

  if (
    !Number.isInteger(graduationYear) ||
    graduationYear < MIN_GRADUATION_YEAR ||
    graduationYear > MAX_GRADUATION_YEAR
  ) {
    return {
      ok: false,
      error: `Enter a graduation year between ${MIN_GRADUATION_YEAR} and ${MAX_GRADUATION_YEAR}.`,
    }
  }

  const rawGpa = input.gpa.trim()
  let gpa: number | null = null

  if (rawGpa) {
    const parsed = Number(rawGpa)

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_GPA) {
      return { ok: false, error: `Enter a GPA between 0 and ${MAX_GPA}.` }
    }

    gpa = parsed
  }

  return {
    ok: true,
    fields: {
      first_name: firstName,
      last_name: lastName,
      graduation_year: graduationYear,
      email: input.email.trim() || null,
      gpa,
      class_rank: input.classRank.trim() || null,
    },
  }
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
