'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isScholarshipStatus } from '@/lib/scholarships/status'
import type { ScholarshipFormInput } from '@/lib/scholarships/form'
import { UUID_PATTERN } from '@/lib/students/form'

export type ScholarshipResult = { ok: true } | { ok: false; error: string }

type ScholarshipFields = {
  name: string
  amount: number | null
  status: string
  deadline: string | null
  link: string | null
  notes: string | null
}

function optional(value: string): string | null {
  return value.trim() || null
}

function parseScholarship(
  input: ScholarshipFormInput
): { ok: true; fields: ScholarshipFields } | { ok: false; error: string } {
  const name = input.name.trim()

  if (!name) {
    return { ok: false, error: 'A scholarship name is required.' }
  }

  // Mirrors the check constraint from 013, so a bad value comes back as a
  // message rather than a Postgres error.
  if (!isScholarshipStatus(input.status)) {
    return { ok: false, error: 'Pick a valid status.' }
  }

  const rawAmount = input.amount.trim()
  let amount: number | null = null

  if (rawAmount) {
    // Tolerate a pasted "$12,500" rather than rejecting it.
    const parsed = Number(rawAmount.replace(/[$,\s]/g, ''))

    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: 'Amount must be a positive number.' }
    }

    amount = parsed
  }

  return {
    ok: true,
    fields: {
      name,
      amount,
      status: input.status,
      deadline: optional(input.deadline),
      link: optional(input.link),
      notes: optional(input.notes),
    },
  }
}

/**
 * All three actions use the session-bound client with no permission check of
 * their own. Migration 013 gates every operation on can_access_student() — an
 * admin at the student's school, the student themselves, or an accepted linked
 * parent — with no author restriction, so anyone who can see the list can
 * manage all of it.
 */
export async function createScholarship(
  studentId: string,
  input: ScholarshipFormInput
): Promise<ScholarshipResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseScholarship(input)
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

  const { error } = await supabase.from('scholarships').insert({
    ...parsed.fields,
    student_id: studentId.trim(),
    // The insert policy permits only auth.uid() or null here, so this is a
    // record rather than a claim.
    added_by: user.id,
  })

  if (error) {
    console.error('createScholarship: insert failed', error)
    return {
      ok: false,
      error:
        'Could not add this scholarship. Check your permissions and try again.',
    }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function updateScholarship(
  scholarshipId: string,
  studentId: string,
  input: ScholarshipFormInput
): Promise<ScholarshipResult> {
  if (!UUID_PATTERN.test(scholarshipId.trim())) {
    return { ok: false, error: 'That does not look like a valid scholarship.' }
  }

  const parsed = parseScholarship(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  // added_by is deliberately absent: it records who first added the row and
  // should not move when someone else edits it. updated_at is maintained by
  // the trigger from 013.
  const { data, error } = await supabase
    .from('scholarships')
    .update(parsed.fields)
    .eq('id', scholarshipId.trim())
    .select('id')

  if (error) {
    console.error('updateScholarship: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  // Zero rows means RLS filtered it out — no access to this student.
  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function deleteScholarship(
  scholarshipId: string,
  studentId: string
): Promise<ScholarshipResult> {
  if (!UUID_PATTERN.test(scholarshipId.trim())) {
    return { ok: false, error: 'That does not look like a valid scholarship.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('scholarships')
    .delete()
    .eq('id', scholarshipId.trim())
    .select('id')

  if (error) {
    console.error('deleteScholarship: delete failed', error)
    return { ok: false, error: 'Could not remove this scholarship.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not remove this scholarship.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}
