'use client'

import { useState } from 'react'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { changePassword } from './actions'

const EMPTY = { current: '', next: '', confirm: '' }

export function ChangePasswordForm() {
  const [values, setValues] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function set(key: keyof typeof EMPTY, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
    setSaved(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await changePassword(
      values.current,
      values.next,
      values.confirm
    )

    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    // Cleared on success so the new password is not left sitting in the DOM.
    setValues(EMPTY)
    setSaved(true)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-sm flex-col gap-4 rounded-lg border border-black/10 p-5 dark:border-white/15"
    >
      <h2 className="text-base font-medium">Change Password</h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="current-password" className="text-sm font-medium">
          Current Password
        </label>
        <input
          id="current-password"
          type="password"
          required
          autoComplete="current-password"
          disabled={isSaving}
          value={values.current}
          onChange={(event) => set('current', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-password" className="text-sm font-medium">
          New Password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={isSaving}
          value={values.next}
          onChange={(event) => set('next', event.target.value)}
          className={INPUT_CLASS}
        />
        <p className="text-xs opacity-60">At least 8 characters.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          Confirm New Password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={isSaving}
          value={values.confirm}
          onChange={(event) => set('confirm', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      {saved && (
        <p
          role="status"
          className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400"
        >
          Password changed. Use it the next time you sign in.
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className={`self-start ${PRIMARY_BUTTON_CLASS}`}
      >
        {isSaving ? 'Changing…' : 'Change Password'}
      </button>
    </form>
  )
}
