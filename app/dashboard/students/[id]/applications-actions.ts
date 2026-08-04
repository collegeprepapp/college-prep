'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isApplicationStatus } from '@/lib/college-applications/status'
import { UUID_PATTERN } from '@/lib/students/form'

export type ApplicationResult = { ok: true } | { ok: false; error: string }

/** Raw form values; everything arrives as a string from inputs. */
export type ApplicationFormInput = {
  schoolName: string
  status: string
  /** 'YYYY-MM-DD' from a date input, or '' for none. */
  deadline: string
  notes: string
}

type ApplicationFields = {
  school_name: string
  status: string
  deadline: string | null
  notes: string | null
}

function parseApplication(
  input: ApplicationFormInput
): { ok: true; fields: ApplicationFields } | { ok: false; error: string } {
  const schoolName = input.schoolName.trim()

  if (!schoolName) {
    return { ok: false, error: 'A school name is required.' }
  }

  // Mirrors the check constraint from 011, so a bad value comes back as a
  // message rather than a Postgres error.
  if (!isApplicationStatus(input.status)) {
    return { ok: false, error: 'Pick a valid status.' }
  }

  return {
    ok: true,
    fields: {
      school_name: schoolName,
      status: input.status,
      deadline: input.deadline.trim() || null,
      notes: input.notes.trim() || null,
    },
  }
}

/**
 * All three actions use the session-bound client with no permission check of
 * their own. Migration 011 gates every operation on can_access_student() — an
 * admin at the student's school, the student themselves, or an accepted linked
 * parent — with no author restriction, so anyone who can see the list can
 * manage all of it.
 */
export async function createApplication(
  studentId: string,
  input: ApplicationFormInput
): Promise<ApplicationResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseApplication(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('college_applications')
    .insert({
      ...parsed.fields,
      student_id: studentId.trim(),
      // The insert policy permits only auth.uid() or null here, so this is a
      // record rather than a claim.
      added_by: user.id,
    })

  if (error) {
    console.error('createApplication: insert failed', error)
    return {
      ok: false,
      error: 'Could not add this school. Check your permissions and try again.',
    }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function updateApplication(
  applicationId: string,
  studentId: string,
  input: ApplicationFormInput
): Promise<ApplicationResult> {
  if (!UUID_PATTERN.test(applicationId.trim())) {
    return { ok: false, error: 'That does not look like a valid application.' }
  }

  const parsed = parseApplication(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  // added_by is deliberately absent from the payload: it records who first
  // added the school and should not move when someone else edits it.
  // updated_at is maintained by the trigger from 011.
  const { data, error } = await supabase
    .from('college_applications')
    .update(parsed.fields)
    .eq('id', applicationId.trim())
    .select('id')

  if (error) {
    console.error('updateApplication: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  // Zero rows means RLS filtered it out — no access to this student.
  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function deleteApplication(
  applicationId: string,
  studentId: string
): Promise<ApplicationResult> {
  if (!UUID_PATTERN.test(applicationId.trim())) {
    return { ok: false, error: 'That does not look like a valid application.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('college_applications')
    .delete()
    .eq('id', applicationId.trim())
    .select('id')

  if (error) {
    console.error('deleteApplication: delete failed', error)
    return { ok: false, error: 'Could not remove this school.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not remove this school.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}
