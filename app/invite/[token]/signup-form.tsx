'use client'

import { useState } from 'react'
import {
  acceptParentInvite,
  acceptParentInviteExistingUser,
  checkInviteEmail,
} from '../actions'

const INPUT_CLASS =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50'

const BUTTON_CLASS =
  'mt-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50'

// 'email'    — asking who they are
// 'new'      — no account for that address: collect name + a new password
// 'existing' — account found: collect their current password only
type Step = 'email' | 'new' | 'existing'

export function SignupForm({
  token,
  studentFirstName,
}: {
  token: string
  studentFirstName: string
}) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleEmailStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await checkInviteEmail(token, email)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setStep(result.exists ? 'existing' : 'new')
  }

  async function handleFinalStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    // Both actions redirect on success, so control does not come back here.
    const result =
      step === 'existing'
        ? await acceptParentInviteExistingUser(token, email, password)
        : await acceptParentInvite(token, email, password, firstName, lastName)

    setIsSubmitting(false)
    if (result?.error) {
      setError(result.error)
    }
  }

  function editEmail() {
    setStep('email')
    setPassword('')
    setError(null)
  }

  const errorBanner = error && (
    <p
      role="alert"
      className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
    >
      {error}
    </p>
  )

  // --- Step 1: email ---------------------------------------------------------
  if (step === 'email') {
    return (
      <form onSubmit={handleEmailStep} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        {errorBanner}

        <button type="submit" disabled={isSubmitting} className={BUTTON_CLASS}>
          {isSubmitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    )
  }

  // --- Step 2: password, plus name fields for a brand new account ------------
  return (
    <form onSubmit={handleFinalStep} className="mt-8 flex flex-col gap-4">
      {step === 'existing' && (
        <p className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">
          Welcome back — log in to link {studentFirstName} to your account.
        </p>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm opacity-70">{email}</span>
        <button
          type="button"
          onClick={editEmail}
          className="shrink-0 text-xs underline opacity-70 hover:opacity-100"
        >
          Change
        </button>
      </div>

      {step === 'new' && (
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="first-name" className="text-sm font-medium">
              First Name
            </label>
            <input
              id="first-name"
              name="first-name"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="last-name" className="text-sm font-medium">
              Last Name
            </label>
            <input
              id="last-name"
              name="last-name"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={step === 'existing' ? 'current-password' : 'new-password'}
          required
          minLength={step === 'existing' ? undefined : 8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={INPUT_CLASS}
        />
        {step === 'new' && (
          <p className="text-xs opacity-60">At least 8 characters.</p>
        )}
      </div>

      {errorBanner}

      <button type="submit" disabled={isSubmitting} className={BUTTON_CLASS}>
        {isSubmitting
          ? step === 'existing'
            ? 'Logging in…'
            : 'Creating account…'
          : step === 'existing'
            ? 'Log in and link'
            : 'Create account'}
      </button>
    </form>
  )
}
