'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isApplicationStatus } from '@/lib/college-applications/status'
import { UUID_PATTERN } from '@/lib/students/form'
import type { ApplicationFormInput } from '@/lib/college-applications/form'

export type ApplicationResult = { ok: true } | { ok: false; error: string }

type ApplicationFields = {
  school_name: string
  status: string
  deadline: string | null
  date_toured: string | null
  goal_completion_date: string | null
  requires_common_app_essay: boolean
  requires_supplemental_essay: boolean
  recommendations_needed: number | null
  recommendation_notes: string | null
  website_link: string | null
  scholarship_info_link: string | null
  resume_link: string | null
  other_links: string | null
  admission_rep_name: string | null
  admission_rep_email: string | null
  scholarship_amount: number | null
  notes: string | null
}

function optional(value: string): string | null {
  return value.trim() || null
}

function parseApplication(
  input: ApplicationFormInput
): { ok: true; fields: ApplicationFields } | { ok: false; error: string } {
  const schoolName = input.schoolName.trim()

  if (!schoolName) {
    return { ok: false, error: 'A school name is required.' }
  }

  // Mirrors the check constraint from 011/012, so a bad value comes back as a
  // message rather than a Postgres error.
  if (!isApplicationStatus(input.status)) {
    return { ok: false, error: 'Pick a valid status.' }
  }

  const rawRecommendations = input.recommendationsNeeded.trim()
  let recommendationsNeeded: number | null = null

  if (rawRecommendations) {
    const parsed = Number(rawRecommendations)

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
      return {
        ok: false,
        error: 'Recommendations needed must be a whole number between 0 and 99.',
      }
    }

    recommendationsNeeded = parsed
  }

  const rawAmount = input.scholarshipAmount.trim()
  let scholarshipAmount: number | null = null

  if (rawAmount) {
    // Tolerate a pasted "$12,500" rather than rejecting it.
    const cleaned = rawAmount.replace(/[$,\s]/g, '')
    const parsed = Number(cleaned)

    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: 'Scholarship amount must be a positive number.' }
    }

    scholarshipAmount = parsed
  }

  return {
    ok: true,
    fields: {
      school_name: schoolName,
      status: input.status,
      deadline: optional(input.deadline),
      date_toured: optional(input.dateToured),
      goal_completion_date: optional(input.goalCompletionDate),
      requires_common_app_essay: input.requiresCommonAppEssay,
      requires_supplemental_essay: input.requiresSupplementalEssay,
      recommendations_needed: recommendationsNeeded,
      recommendation_notes: optional(input.recommendationNotes),
      website_link: optional(input.websiteLink),
      scholarship_info_link: optional(input.scholarshipInfoLink),
      resume_link: optional(input.resumeLink),
      other_links: optional(input.otherLinks),
      admission_rep_name: optional(input.admissionRepName),
      admission_rep_email: optional(input.admissionRepEmail),
      scholarship_amount: scholarshipAmount,
      notes: optional(input.notes),
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

  const { error } = await supabase.from('college_applications').insert({
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
