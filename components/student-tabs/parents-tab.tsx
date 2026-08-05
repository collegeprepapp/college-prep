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
import { InviteParentForm } from './invite-parent-form'

export type ParentLinkListRow = {
  id: string
  status: string
  parentName: string | null
  createdAtLabel: string
}

const STATUS_TONE: Record<string, string> = {
  accepted:
    'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  pending:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  revoked: 'border-red-600/25 bg-red-600/5 text-red-700/80 dark:text-red-400/80',
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  pending: 'Pending',
  revoked: 'Revoked',
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    STATUS_TONE[status] ??
    'border-black/15 bg-black/5 dark:border-white/20 dark:bg-white/10'

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function LinkRow({ link }: { link: ParentLinkListRow }) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAccepted = link.status === 'accepted'
  const isPending = link.status === 'pending'

  async function run() {
    setError(null)
    setIsBusy(true)

    const result = isAccepted
      ? await revokeParentAccess(link.id)
      : await cancelPendingInvite(link.id)

    setIsBusy(false)
    setIsConfirming(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    router.refresh()
  }

  // Naming the parent (or the invite's date) keeps every row's button distinct
  // to a screen reader.
  const who = link.parentName ?? `the invite from ${link.createdAtLabel}`
  const label = isAccepted ? `Revoke ${who}’s access` : `Cancel ${who}`

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium">
            {link.parentName ?? 'Invite not yet accepted'}
          </span>
          <span className="text-xs opacity-60">
            Invited {link.createdAtLabel}
          </span>
        </span>

        <div className="flex items-center gap-2">
          <StatusBadge status={link.status} />

          {(isAccepted || isPending) &&
            (isConfirming ? (
              <>
                <span className="text-xs opacity-70">
                  {isAccepted ? 'Revoke access?' : 'Cancel invite?'}
                </span>
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
            ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
    </li>
  )
}

/**
 * Parent access for one student: who is linked, what is still pending, and the
 * controls to end or withdraw either.
 *
 * canInvite reflects who createParentInvite actually authorizes — admins and
 * the student themselves, never a parent. It only decides whether the form is
 * offered; the action re-checks the caller regardless, so a parent who called
 * it directly would still be refused.
 */
export function ParentsTab({
  links,
  studentId,
  canInvite,
}: {
  links: ParentLinkListRow[]
  studentId: string
  canInvite: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium">Parent Access</h3>
        <p className="mt-0.5 text-xs opacity-60">
          Revoking keeps the record that access was granted. Cancelling removes
          an invite that was never accepted.
        </p>
      </div>

      {links.length === 0 ? (
        <p className="text-sm opacity-70">No parents linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <LinkRow key={link.id} link={link} />
          ))}
        </ul>
      )}

      {canInvite && <InviteParentForm studentId={studentId} />}
    </div>
  )
}
