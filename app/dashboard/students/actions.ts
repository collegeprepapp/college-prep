'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  parseStudentFields,
  UUID_PATTERN,
  type StudentFormInput,
} from '@/lib/students/form'

export type SaveStudentResult = { ok: true } | { ok: false; error: string }

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
