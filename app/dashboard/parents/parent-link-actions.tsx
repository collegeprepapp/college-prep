'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserX } from 'lucide-react'
import {
  ErrorBanner,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { ICON_BUTTON_CLASS } from '@/components/icon-button'
import {
  cancelPendingInvite,
  revokeParentAccess,
} from '@/lib/parent-links/actions'

/**
 * Row actions for one parent link.
 *
 * Two different operations, distinguished by icon because they are not the same
 * thing: an accepted link is REVOKED (UserX — the row survives as a record that
 * access existed and ended), while a pending invite is DELETED (Trash2 — the
 * app's usual destructive icon, and nothing is preserved because nothing
 * happened). A revoked link offers nothing further.
 *
 * Both use the same two-step confirmation as the rest of the app: an icon
 * trigger, then text buttons, since a confirmation step should not be compact.
 */
export function ParentLinkActions({
  linkId,
  status,
  parentName,
  studentName,
}: {
  linkId: string
  status: string
  /** Null for a pending invite, which has no parent yet. */
  parentName: string | null
  studentName: string
}) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAccepted = status === 'accepted'
  const isPending = status === 'pending'

  async function run() {
    setError(null)
    setIsBusy(true)

    const result = isAccepted
      ? await revokeParentAccess(linkId)
      : await cancelPendingInvite(linkId)

    setIsBusy(false)

    if (!result.ok) {
      setIsConfirming(false)
      setError(result.error)
      return
    }

    setIsConfirming(false)
    router.refresh()
  }

  if (!isAccepted && !isPending) {
    // Already revoked: the record stays visible, but there is nothing to do.
    return <span className="text-xs opacity-40">—</span>
  }

  // Names the specific pair, since every row's button is otherwise identical to
  // a screen reader.
  const label = isAccepted
    ? `Revoke ${parentName ?? 'this parent'}’s access to ${studentName}`
    : `Cancel the pending invite for ${studentName}`

  const confirmPrompt = isAccepted ? 'Revoke access?' : 'Cancel invite?'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {isConfirming ? (
          <>
            <span className="text-xs opacity-70">{confirmPrompt}</span>
            <button
              type="button"
              onClick={run}
              disabled={isBusy}
              className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
            >
              {isBusy ? 'Working…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isBusy}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            aria-label={label}
            title={label}
            className={ICON_BUTTON_CLASS}
          >
            {isAccepted ? (
              <UserX aria-hidden="true" className="size-4" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
    </div>
  )
}
