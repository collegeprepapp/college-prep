'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  parseStudentFields,
  UUID_PATTERN,
  type StudentFormInput,
} from '@/lib/students/form'

export type SaveOwnRecordResult = { ok: true } | { ok: false; error: string }

/**
 * Lets a student update their own record from the portal.
 *
 * Session-bound client with no role check of its own. Migration 006 has exactly
 * one policy that permits this — "Students can update their own record", scoped
 * to profile_id = auth.uid() — and there is no parent update policy at all, so a
 * linked parent calling this matches zero rows rather than writing anything.
 * The read-only view for parents is therefore a UI convenience over a rule the
 * database already enforces.
 */
export async function updateOwnStudentRecord(
  studentId: string,
  input: StudentFormInput
): Promise<SaveOwnRecordResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid record.' }
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
    console.error('updateOwnStudentRecord: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  // Zero rows means RLS filtered the row out — not this student's record.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Could not save changes. You may not have permission to edit this.',
    }
  }

  revalidatePath(`/portal/${studentId.trim()}/overview`)

  return { ok: true }
}
