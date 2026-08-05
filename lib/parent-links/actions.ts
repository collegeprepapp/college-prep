'use server'

import { revalidatePath } from 'next/cache'
import { revalidateStudentRecord } from '@/lib/student-record/revalidate'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { UUID_PATTERN } from '@/lib/students/form'

export type ParentLinkResult = { ok: true } | { ok: false; error: string }

export type CreateInviteResult =
  | { ok: true; token: string }
  | { ok: false; error: string }

/**
 * Parent-link administration, shared by the admin dashboard and the student
 * portal.
 *
 * public.parent_student_links has had ZERO policies for regular users since
 * migration 005 — the raw table carries invite tokens, so only service-role
 * code touches it. That means RLS enforces nothing here and the authorization
 * below is the entire boundary. Read authorizeLinkAction() before changing
 * either action.
 */

type Authorized = {
  ok: true
  service: ReturnType<typeof createServiceClient>
  link: { id: string; student_id: string; status: string }
}

/**
 * Confirms the caller may administer this link.
 *
 * Permitted: an admin at the linked student's school (school_admin scoped to
 * that school, system_admin anywhere), or the student the link is about. NOT
 * the parent — a parent cannot revoke or cancel their own access, since that
 * would let them erase a record the school is keeping deliberately.
 *
 * The link and student rows are read with the service client because the table
 * is unreadable otherwise; the caller's identity comes from the session client,
 * so it is the signed-in user being checked and not the service role.
 */
async function authorizeLinkAction(
  linkId: string
): Promise<Authorized | { ok: false; error: string }> {
  if (!UUID_PATTERN.test(linkId.trim())) {
    return { ok: false, error: 'That does not look like a valid invite.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const service = createServiceClient()

  const { data: link, error: linkError } = await service
    .from('parent_student_links')
    .select('id, student_id, status')
    .eq('id', linkId.trim())
    .maybeSingle()

  if (linkError || !link) {
    return { ok: false, error: 'Could not find that invite.' }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  const { data: student } = await service
    .from('students')
    .select('school_id, profile_id')
    .eq('id', link.student_id)
    .maybeSingle()

  if (!student) {
    return { ok: false, error: 'Could not find that student.' }
  }

  const isSystemAdmin = profile?.role === 'system_admin'
  const isSchoolAdminHere =
    profile?.role === 'school_admin' && profile.school_id === student.school_id
  const isThisStudent = student.profile_id === user.id

  if (!isSystemAdmin && !isSchoolAdminHere && !isThisStudent) {
    return {
      ok: false,
      error: 'You do not have permission to manage this parent link.',
    }
  }

  return { ok: true, service, link }
}

function revalidateFor(studentId: string) {
  // Parent links render on the admin detail page, the admin parents list, and
  // the portal's own parents page — all three go stale on a revoke or cancel.
  revalidateStudentRecord(studentId)
  revalidatePath('/dashboard/parents')
}

/**
 * Ends an accepted parent's access, keeping the row as a record.
 *
 * One update is enough: every parent-facing rule in the schema runs through
 * is_linked_parent_of(), which tests for status = 'accepted', so this removes
 * the parent from students, test_scores, assigned_tasks, and — via
 * can_access_student() — notes, applications, scholarships, essays, activities,
 * honors, and documents, all at once.
 */
export async function revokeParentAccess(
  linkId: string
): Promise<ParentLinkResult> {
  const authorized = await authorizeLinkAction(linkId)

  if (!authorized.ok) {
    return authorized
  }

  const { service, link } = authorized

  if (link.status !== 'accepted') {
    return {
      ok: false,
      error:
        link.status === 'revoked'
          ? 'This parent’s access has already been revoked.'
          : 'That invite has not been accepted yet — cancel it instead.',
    }
  }

  // The status filter is the race guard: if the link changed between the check
  // above and this write, zero rows match rather than overwriting a newer state.
  const { data, error } = await service
    .from('parent_student_links')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', link.id)
    .eq('status', 'accepted')
    .select('id')

  if (error) {
    console.error('revokeParentAccess: update failed', error)
    return { ok: false, error: 'Could not revoke access. Please try again.' }
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'This link changed while you were working. Refresh and try again.',
    }
  }

  revalidateFor(link.student_id)
  return { ok: true }
}

/**
 * Deletes an invite that was never accepted.
 *
 * Deleting rather than revoking is deliberate: a pending invite records nothing
 * that happened, so there is no history to preserve, and removing the row frees
 * the invite token with it. Accepted links are revoked instead, never deleted.
 */
export async function cancelPendingInvite(
  linkId: string
): Promise<ParentLinkResult> {
  const authorized = await authorizeLinkAction(linkId)

  if (!authorized.ok) {
    return authorized
  }

  const { service, link } = authorized

  if (link.status !== 'pending') {
    return {
      ok: false,
      error:
        link.status === 'accepted'
          ? 'This invite has already been accepted — revoke access instead.'
          : 'This invite is no longer pending.',
    }
  }

  // Same race guard: a link accepted a moment ago must not be deleted here,
  // which would destroy an accepted link's history.
  const { data, error } = await service
    .from('parent_student_links')
    .delete()
    .eq('id', link.id)
    .eq('status', 'pending')
    .select('id')

  if (error) {
    console.error('cancelPendingInvite: delete failed', error)
    return { ok: false, error: 'Could not cancel this invite. Please try again.' }
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'This invite changed while you were working. Refresh and try again.',
    }
  }

  revalidateFor(link.student_id)
  return { ok: true }
}

/**
 * Creates a pending parent invite and returns the raw token.
 *
 * Service-role again, and again the check inside is the only boundary. Note it
 * authorizes a STUDENT for their own record as well as admins — which is what
 * lets the portal offer this. A parent cannot invite another parent.
 */
export async function createParentInvite(
  studentId: string
): Promise<CreateInviteResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student ID.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in to create an invite.' }
  }

  const service = createServiceClient()

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { ok: false, error: 'Could not load your profile.' }
  }

  const { data: student, error: studentError } = await service
    .from('students')
    .select('id, school_id, profile_id')
    .eq('id', studentId.trim())
    .maybeSingle()

  if (studentError || !student) {
    return { ok: false, error: 'No student found with that ID.' }
  }

  // Mirrors the RLS rules in migrations 002/003, enforced in code because the
  // service-role client bypasses them.
  const isSystemAdmin = profile.role === 'system_admin'
  const isSchoolAdminHere =
    profile.role === 'school_admin' && profile.school_id === student.school_id
  const isThisStudent =
    profile.role === 'student' && student.profile_id === user.id

  if (!isSystemAdmin && !isSchoolAdminHere && !isThisStudent) {
    return {
      ok: false,
      error: 'You do not have permission to invite a parent for this student.',
    }
  }

  const { data: link, error: insertError } = await service
    .from('parent_student_links')
    .insert({
      student_id: student.id,
      invited_by: profile.id,
      status: 'pending',
      // invite_token is generated by the column default.
    })
    .select('invite_token')
    .single()

  if (insertError || !link) {
    return { ok: false, error: 'Could not create the invite. Please try again.' }
  }

  revalidateFor(student.id)

  return { ok: true, token: link.invite_token }
}
