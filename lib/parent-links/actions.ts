'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { UUID_PATTERN } from '@/lib/students/form'

export type ParentLinkResult = { ok: true } | { ok: false; error: string }

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
  revalidatePath(`/dashboard/students/${studentId}`)
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
