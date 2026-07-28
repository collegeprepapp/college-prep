'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type AcceptInviteResult = { error: string }

export type CheckInviteEmailResult =
  | { ok: true; exists: boolean }
  | { ok: false; error: string }

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

// ---------------------------------------------------------------------------
// Existing-account path
// ---------------------------------------------------------------------------

type PendingLink = { id: string; student_id: string; status: string }

/**
 * Returns the link row only if the token exists and is still pending.
 * Both actions below gate on this before doing anything else.
 */
async function loadPendingLink(
  service: ReturnType<typeof createServiceClient>,
  token: string
): Promise<PendingLink | null> {
  const { data, error } = await service
    .from('parent_student_links')
    .select('id, student_id, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !data || data.status !== 'pending') {
    return null
  }

  return data as PendingLink
}

// This SDK's admin.listUsers() has no email filter — only page/perPage — so
// finding a user by address means scanning. Fine at one school's scale;
// revisit if the user table grows past the cap below.
const USER_PAGE_SIZE = 1000
const USER_MAX_PAGES = 20

async function findAuthUserByEmail(
  service: ReturnType<typeof createServiceClient>,
  email: string
): Promise<{ ok: true; exists: boolean } | { ok: false }> {
  const normalized = email.trim().toLowerCase()

  for (let page = 1; page <= USER_MAX_PAGES; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: USER_PAGE_SIZE,
    })

    if (error) {
      console.error('findAuthUserByEmail: listUsers failed', error)
      return { ok: false }
    }

    if (data.users.some((u) => u.email?.toLowerCase() === normalized)) {
      return { ok: true, exists: true }
    }

    // A short page means we reached the end of the user table.
    if (data.users.length < USER_PAGE_SIZE) {
      return { ok: true, exists: false }
    }
  }

  // Ran out of pages before exhausting the table: we cannot say "no account"
  // truthfully, so report failure rather than guess.
  console.error('findAuthUserByEmail: hit page cap, scan was not exhaustive')
  return { ok: false }
}

/**
 * Reports whether an auth account already exists for this email, so the form
 * can branch between "create an account" and "log in to link".
 *
 * Creates nothing. Gated on a still-pending token so this cannot be used as a
 * general-purpose account-enumeration oracle by someone without an invite.
 */
export async function checkInviteEmail(
  token: string,
  email: string
): Promise<CheckInviteEmailResult> {
  if (!token) {
    return { ok: false, error: INVALID_INVITE }
  }

  if (!email.trim()) {
    return { ok: false, error: 'Enter your email address.' }
  }

  const service = createServiceClient()

  if (!(await loadPendingLink(service, token))) {
    return { ok: false, error: INVALID_INVITE }
  }

  const lookup = await findAuthUserByEmail(service, email)

  if (!lookup.ok) {
    return {
      ok: false,
      error: 'Could not check that email right now. Please try again.',
    }
  }

  return { ok: true, exists: lookup.exists }
}

/**
 * Accepts an invite for someone who already has an account: proves they own it
 * by signing in, then points the link at their existing profile.
 *
 * No account or profile is created here, so there is nothing to roll back.
 *
 * Only returns an error for failures BEFORE sign-in (dead token, wrong
 * password). Once the session exists, every path ends in a redirect to
 * /dashboard, with anything unexpected logged server-side.
 */
export async function acceptParentInviteExistingUser(
  token: string,
  email: string,
  password: string
): Promise<AcceptInviteResult> {
  if (!token) {
    return { error: INVALID_INVITE }
  }

  if (!email.trim() || !password) {
    return { error: 'Email and password are both required.' }
  }

  const service = createServiceClient()

  const link = await loadPendingLink(service, token)
  if (!link) {
    return { error: INVALID_INVITE }
  }

  // The regular cookie-bound client, not the service client: signing in is how
  // we verify the password, and it doubles as logging them in on success.
  const supabase = await createClient()
  const { data: signIn, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

  // Specific by design. The previous step already told this caller that an
  // account exists for this address, so "incorrect password" reveals nothing
  // further — and a vague message here would just be unhelpful.
  if (signInError || !signIn?.user) {
    return { error: 'Incorrect password.' }
  }

  // From here on the caller holds a valid session, so every exit is a redirect
  // to /dashboard rather than an error rendered on the invite page — stranding
  // a signed-in user on a dead invite screen is worse than a quiet no-op.
  // Anything unexpected is logged server-side on the way out.

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id')
    .eq('id', signIn.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    console.error(
      'acceptParentInviteExistingUser: no profile for signed-in user',
      { userId: signIn.user.id, profileError }
    )
    redirect('/dashboard')
  }

  const { data: claimed, error: updateError } = await service
    .from('parent_student_links')
    .update({
      status: 'accepted',
      parent_profile_id: profile.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', link.id)
    .eq('status', 'pending')
    .select('id')

  if (updateError) {
    // 23505 = the unique (student_id, parent_profile_id) constraint: this
    // parent is already linked to this student. Not a failure — they are signed
    // in and already have the access this invite was offering, so no log.
    if (updateError.code !== '23505') {
      console.error(
        'acceptParentInviteExistingUser: link update failed',
        updateError
      )
    }

    redirect('/dashboard')
  }

  // Zero rows means another submission claimed the token first. The invite is
  // spent and this user may not be the one it linked, so record it.
  if (!claimed || claimed.length === 0) {
    console.error(
      'acceptParentInviteExistingUser: token was already claimed, no rows updated',
      { linkId: link.id, userId: signIn.user.id }
    )
  }

  redirect('/dashboard')
}
