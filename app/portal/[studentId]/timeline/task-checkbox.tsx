'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleTaskCompletion } from './actions'

export function TaskCheckbox({
  taskId,
  studentId,
  completed,
  canToggle,
  label,
}: {
  taskId: string
  studentId: string
  completed: boolean
  canToggle: boolean
  label: string
}) {
  const router = useRouter()
  // Local state so the box responds immediately; reverted if the server says no.
  const [isChecked, setIsChecked] = useState(completed)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function handleChange(next: boolean) {
    setIsChecked(next)
    setError(null)
    setIsSaving(true)

    const result = await toggleTaskCompletion(taskId, next, studentId)
    setIsSaving(false)

    if (!result.ok) {
      setIsChecked(!next)
      setError(result.error)
      return
    }

    router.refresh()
  }

  return (
    <span className="flex flex-col gap-1">
      <input
        type="checkbox"
        checked={isChecked}
        disabled={!canToggle || isSaving}
        aria-label={
          canToggle ? label : `${label} (not assigned to you to complete)`
        }
        title={canToggle ? undefined : 'Not assigned to you to complete'}
        onChange={(event) => handleChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 disabled:opacity-40"
      />
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  )
}
