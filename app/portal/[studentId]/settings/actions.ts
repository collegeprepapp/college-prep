'use server'

import { createClient } from '@/lib/supabase/server'

export type ChangePasswordResult = { ok: true } | { ok: false; error: string }

/** Matches the minimum enforced when a parent account is first created. */
const MIN_PASSWORD_LENGTH = 8

/**
 * Changes the signed-in user's own password.
 *
 * A server action rather than a browser call, for consistency with the rest of
 * the app — and because both steps here rotate the session cookies, which the
 * cookie-bound server client already knows how to write.
 *
 * Two steps, in this order:
 *
 *   1. Re-authenticate with the CURRENT password. updateUser() will happily
 *      change a password using nothing but an existing session, so without this
 *      anyone who walked up to an unlocked laptop could lock the owner out of
 *      their own account. Supabase only writes cookies on a successful sign-in,
 *      so a wrong password leaves the existing session untouched.
 *   2. Set the new password.
 *
 * The caller's identity comes from the session, never from an argument — there
 * is no way to aim this at another account.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<ChangePasswordResult> {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, error: 'Fill in all three fields.' }
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'The new passwords do not match.' }
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    }
  }

  if (newPassword === currentPassword) {
    return {
      ok: false,
      error: 'Your new password must be different from your current one.',
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  if (!user.email) {
    // Nothing to re-authenticate against, so the check above cannot be made.
    // Better to refuse than to change a password without verifying anything.
    return {
      ok: false,
      error:
        'This account has no email address on file. Contact your school for help.',
    }
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })

  if (reauthError) {
    // Specific on purpose: the caller is already signed in as themselves, so
    // this reveals nothing they do not already know, and "something went wrong"
    // would leave them guessing which field was wrong.
    return { ok: false, error: 'Your current password is incorrect.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (updateError) {
    console.error('changePassword: updateUser failed', updateError)

    // Supabase enforces its own project-level rules (length, strength, reuse)
    // on top of the checks above, and its message is the only thing that knows
    // which one failed — so it is passed through rather than flattened.
    return {
      ok: false,
      error: updateError.message || 'Could not change your password.',
    }
  }

  return { ok: true }
}
