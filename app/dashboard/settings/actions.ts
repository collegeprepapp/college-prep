'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { UUID_PATTERN } from '@/lib/students/form'

export type SettingsResult = { ok: true } | { ok: false; error: string }

export type CreateAdminResult =
  | { ok: true; temporaryPassword: string }
  | { ok: false; error: string }

/**
 * 18 random bytes, base64url-encoded: 24 characters, no ambiguous padding.
 * Generated server-side and returned exactly once — nothing stores it, so it
 * cannot be looked up again after the response.
 */
function generateTemporaryPassword(): string {
  return randomBytes(18).toString('base64url')
}

/**
 * Updates the signed-in user's own name.
 *
 * Session-bound client, no permission check of its own: migration 009's
 * "Users can update their own profile" policy scopes this to id = auth.uid(),
 * and its BEFORE UPDATE trigger reverts any attempt to move role or school_id —
 * for admins too. So this cannot be used to self-promote.
 */
export async function updateOwnProfile(
  firstName: string,
  lastName: string
): Promise<SettingsResult> {
  const first = firstName.trim()
  const last = lastName.trim()

  if (!first || !last) {
    return { ok: false, error: 'First and last name are both required.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ first_name: first, last_name: last })
    .eq('id', user.id)
    .select('id')

  if (error) {
    console.error('updateOwnProfile: update failed', error)
    return { ok: false, error: 'Could not save your profile. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save your profile.' }
  }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

/**
 * Renames a school.
 *
 * Session-bound client again: 009's update policy allows school_admin on their
 * own school and system_admin anywhere, and the trigger pins slug, so a rename
 * cannot change the identifier other things key off.
 */
export async function updateSchoolName(
  schoolId: string,
  name: string
): Promise<SettingsResult> {
  if (!UUID_PATTERN.test(schoolId.trim())) {
    return { ok: false, error: 'That does not look like a valid school.' }
  }

  const trimmed = name.trim()

  if (!trimmed) {
    return { ok: false, error: 'School name is required.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schools')
    .update({ name: trimmed })
    .eq('id', schoolId.trim())
    .select('id')

  if (error) {
    console.error('updateSchoolName: update failed', error)
    return { ok: false, error: 'Could not save the school name.' }
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Could not save. You may not have permission to edit this school.',
    }
  }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

/**
 * Creates a school_admin account and returns its one-time password.
 *
 * This is the only action here that uses the service role, because creating an
 * auth user and inserting someone else's profiles row both sit outside what any
 * RLS policy permits. That means RLS enforces nothing here and the checks below
 * are the entire authorization boundary — in particular the school scoping,
 * without which a school_admin could mint admins for another school.
 */
export async function createSchoolAdmin(
  firstName: string,
  lastName: string,
  email: string,
  schoolId: string
): Promise<CreateAdminResult> {
  const first = firstName.trim()
  const last = lastName.trim()
  const address = email.trim()

  if (!first || !last) {
    return { ok: false, error: 'First and last name are both required.' }
  }

  if (!address) {
    return { ok: false, error: 'An email address is required.' }
  }

  if (!UUID_PATTERN.test(schoolId.trim())) {
    return { ok: false, error: 'A valid school is required.' }
  }

  const targetSchoolId = schoolId.trim()

  // --- Authorization -------------------------------------------------------
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  const isSystemAdmin = profile?.role === 'system_admin'
  const isSchoolAdminHere =
    profile?.role === 'school_admin' && profile.school_id === targetSchoolId

  if (!isSystemAdmin && !isSchoolAdminHere) {
    return {
      ok: false,
      error: 'You do not have permission to add an admin for this school.',
    }
  }

  // --- Create the auth user ------------------------------------------------
  const service = createServiceClient()
  const temporaryPassword = generateTemporaryPassword()

  const { data: created, error: createUserError } =
    await service.auth.admin.createUser({
      email: address,
      password: temporaryPassword,
      // An admin vouched for this address by typing it, and they hand over the
      // password directly, so there is no confirmation round trip.
      email_confirm: true,
    })

  if (createUserError || !created?.user) {
    console.error('createSchoolAdmin: createUser failed', createUserError)

    // Admin-facing, so being specific is useful rather than a disclosure risk —
    // the caller can already see every admin at this school.
    return {
      ok: false,
      error:
        createUserError?.message ??
        'Could not create the account. Please try again.',
    }
  }

  const userId = created.user.id

  // --- Create the profile --------------------------------------------------
  const { error: profileError } = await service.from('profiles').insert({
    id: userId,
    role: 'school_admin',
    school_id: targetSchoolId,
    first_name: first,
    last_name: last,
  })

  if (profileError) {
    console.error('createSchoolAdmin: profile insert failed', profileError)

    // Roll back so the address is not left claimed by a half-made account.
    // Deleting the auth user cascades the profiles row if one landed.
    await service.auth.admin.deleteUser(userId)

    return { ok: false, error: 'Could not finish setting up the account.' }
  }

  revalidatePath('/dashboard/settings')

  return { ok: true, temporaryPassword }
}
