'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type AcceptInviteResult = { error: string }

// Deliberately generic: a caller holding a bad token learns nothing about
// whether it never existed, was already used, or belongs to someone else.
const INVALID_INVITE = 'This invite link is no longer valid.'

// Also deliberately generic — see the createUser failure branch below.
const ACCOUNT_CREATION_FAILED =
  'Unable to create account. Please contact the school for help.'

/**
 * Accepts a parent invite: creates the auth user, their profile, and marks the
 * link accepted — then signs them in and sends them to the dashboard.
 *
 * Everything runs through the service-role client because the caller is
 * anonymous at this point and parent_student_links has no RLS policies. The
 * token itself is the only credential, so each step re-checks rather than
 * trusting the previous one.
 *
 * Returns only on failure; success ends in a redirect.
 */
export async function acceptParentInvite(
  token: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<AcceptInviteResult> {
  if (!token) {
    return { error: INVALID_INVITE }
  }

  if (!firstName.trim() || !lastName.trim()) {
    return { error: 'First and last name are both required.' }
  }

  if (!email.trim() || !password) {
    return { error: 'Email and password are both required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const service = createServiceClient()

  const { data: link, error: linkError } = await service
    .from('parent_student_links')
    .select('id, student_id, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (linkError || !link || link.status !== 'pending') {
    return { error: INVALID_INVITE }
  }

  const { data: student, error: studentError } = await service
    .from('students')
    .select('id, school_id')
    .eq('id', link.student_id)
    .maybeSingle()

  if (studentError || !student) {
    return { error: INVALID_INVITE }
  }

  // --- Step 1: auth user -----------------------------------------------------
  const { data: created, error: createUserError } =
    await service.auth.admin.createUser({
      email: email.trim(),
      password,
      // The invite link itself is the proof of address ownership.
      email_confirm: true,
    })

  if (createUserError || !created?.user) {
    // Never surface the underlying reason: "email already registered" and
    // similar messages would let anyone holding a token probe which addresses
    // have accounts. Log it server-side instead so it stays diagnosable.
    console.error('acceptParentInvite: createUser failed', createUserError)
    return { error: ACCOUNT_CREATION_FAILED }
  }

  const userId = created.user.id

  // --- Step 2: profile -------------------------------------------------------
  const { error: profileError } = await service.from('profiles').insert({
    id: userId,
    school_id: student.school_id,
    role: 'parent',
    first_name: firstName.trim(),
    last_name: lastName.trim(),
  })

  if (profileError) {
    // Roll back the auth user so a retry with the same email is not blocked.
    await service.auth.admin.deleteUser(userId)
    return { error: 'Could not set up your account. Please try again.' }
  }

  // --- Step 3: claim the link ------------------------------------------------
  // The `status = 'pending'` filter is the race guard: if a second submission
  // already accepted this token, zero rows match and we unwind.
  const { data: claimed, error: updateError } = await service
    .from('parent_student_links')
    .update({
      status: 'accepted',
      parent_profile_id: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', link.id)
    .eq('status', 'pending')
    .select('id')

  if (updateError || !claimed || claimed.length === 0) {
    // Deleting the auth user cascades the profiles row (profiles.id references
    // auth.users on delete cascade), so both step 1 and step 2 unwind here.
    await service.auth.admin.deleteUser(userId)
    return { error: INVALID_INVITE }
  }

  // --- Step 4: sign them in --------------------------------------------------
  // Uses the cookie-bound server client so the session lands in the browser.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  // The account and link are valid at this point, so a sign-in hiccup is not
  // grounds for rolling back — send them to log in manually instead.
  if (signInError) {
    redirect('/login')
  }

  redirect('/dashboard')
}
