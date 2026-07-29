'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Raw form values. Everything arrives as a string because it comes from text
 * inputs; parseStudentFields below turns it into column-shaped values.
 */
export type StudentFormInput = {
  firstName: string
  lastName: string
  graduationYear: string
  email: string
  gpa: string
  classRank: string
}

export type SaveStudentResult = { ok: true } | { ok: false; error: string }

type StudentFields = {
  first_name: string
  last_name: string
  graduation_year: number
  email: string | null
  gpa: number | null
  class_rank: string | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// gpa is numeric(3,2): three total digits, two after the decimal point, so
// anything at or above 10 overflows the column and Postgres raises 22003.
const MAX_GPA = 9.99

function parseStudentFields(
  input: StudentFormInput
): { ok: true; fields: StudentFields } | { ok: false; error: string } {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()

  if (!firstName || !lastName) {
    return { ok: false, error: 'First and last name are both required.' }
  }

  const graduationYear = Number(input.graduationYear.trim())

  if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100) {
    return { ok: false, error: 'Enter a graduation year between 1900 and 2100.' }
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

/**
 * Creates a student and sends the caller to the new record.
 *
 * Uses the session-bound client on purpose: the insert policy from 006 is what
 * restricts this to admins, and scopes school_admin to their own school. There
 * is no separate permission check here because RLS is the check.
 *
 * Returns only on failure; success ends in a redirect.
 */
export async function createStudent(
  schoolId: string,
  input: StudentFormInput
): Promise<SaveStudentResult> {
  if (!UUID_PATTERN.test(schoolId.trim())) {
    return { ok: false, error: 'A valid school is required.' }
  }

  const parsed = parseStudentFields(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('students')
    .insert({ ...parsed.fields, school_id: schoolId.trim() })
    .select('id')
    .single()

  if (error || !data) {
    // An RLS refusal surfaces here as an ordinary insert error.
    console.error('createStudent: insert failed', error)
    return {
      ok: false,
      error: 'Could not create this student. Check your permissions and try again.',
    }
  }

  revalidatePath('/dashboard/students')
  redirect(`/dashboard/students/${data.id}`)
}

/**
 * Updates a student in place and reports back, so the calling form can confirm
 * without a navigation.
 *
 * Session-bound client again: the update policies from 006 allow admins within
 * their school and a student editing their own row, so an unauthorized caller
 * simply matches zero rows.
 */
export async function updateStudent(
  studentId: string,
  input: StudentFormInput
): Promise<SaveStudentResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student ID.' }
  }

  const parsed = parseStudentFields(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('students')
    .update(parsed.fields)
    .eq('id', studentId.trim())
    .select('id')

  if (error) {
    console.error('updateStudent: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  // Zero rows means RLS filtered the row out — no permission, or it does not
  // exist. Indistinguishable by design.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Could not save changes. You may not have permission to edit this student.',
    }
  }

  // Marks the server-rendered pages stale for the next visit; the form shows the
  // saved values immediately from its own state.
  revalidatePath('/dashboard/students')
  revalidatePath(`/dashboard/students/${studentId.trim()}`)

  return { ok: true }
}
