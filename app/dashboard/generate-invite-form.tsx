'use client'

import { useState } from 'react'
import { createParentInvite } from './actions'

export function GenerateInviteForm() {
  const [studentId, setStudentId] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInviteUrl(null)
    setIsSubmitting(true)

    const result = await createParentInvite(studentId)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setInviteUrl(`${window.location.origin}/invite/${result.token}`)
  }

  return (
    <section className="rounded-lg border border-black/10 p-5 dark:border-white/15">
      <h2 className="text-lg font-medium">Invite a parent</h2>
      <p className="mt-1 text-xs opacity-60">
        Temporary: student picker UI coming later. For now, paste a student
        UUID from the Supabase table editor.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          placeholder="Student UUID"
          required
          className="min-w-72 flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Generating…' : 'Generate Invite'}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {inviteUrl && (
        <div className="mt-4">
          <label
            htmlFor="invite-url"
            className="text-sm font-medium"
          >
            Invite link — send this to the parent
          </label>
          <input
            id="invite-url"
            type="text"
            readOnly
            value={inviteUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1.5 w-full rounded-md border border-black/15 bg-black/5 px-3 py-2 font-mono text-xs outline-none dark:border-white/20 dark:bg-white/10"
          />
        </div>
      )}
    </section>
  )
}
