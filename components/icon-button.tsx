'use client'

import { Pencil, Trash2 } from 'lucide-react'

export const ICON_BUTTON_CLASS =
  'rounded-md border border-black/15 p-2 transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20'

/**
 * Row-level Edit / Delete actions, icon-only.
 *
 * `label` must name the specific target ("Edit North Greenville University"),
 * not just the verb. In a table every row's button is otherwise identical to a
 * screen reader, which loses the context a sighted user gets from row position.
 *
 * The same string is also the `title`, so hovering restores the affordance the
 * dropped text label used to provide.
 *
 * These are for per-row actions only. Section-level buttons ("Edit my profile",
 * "Add School") stay labelled — they are not repeated per row, so there is no
 * space to reclaim and no ambiguity to resolve.
 */
export function EditIconButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  /** Optional: the demo tabs render inert placeholders with no handler yet. */
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={ICON_BUTTON_CLASS}
    >
      <Pencil aria-hidden="true" className="size-4" />
    </button>
  )
}

export function DeleteIconButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  /** Optional: the demo tabs render inert placeholders with no handler yet. */
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={ICON_BUTTON_CLASS}
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </button>
  )
}
