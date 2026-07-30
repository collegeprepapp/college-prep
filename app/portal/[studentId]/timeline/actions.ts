'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ToggleTaskResult = { ok: true } | { ok: false; error: string }

// Raised by the trigger from migration 008 when the caller's role does not match
// the task's audience.
const AUDIENCE_REJECTED = '23514'

/**
 * Checks a task off, or un-checks it.
 *
 * Session-bound client with no permission check of its own: the RLS policies
 * from 007/008 decide who may touch the row, and the BEFORE UPDATE trigger
 * enforces both the audience rule and the completed/completed_at column limit.
 * An unauthorized caller either matches zero rows or trips the trigger.
 */
export async function toggleTaskCompletion(
  taskId: string,
  completed: boolean,
  studentId: string
): Promise<ToggleTaskResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('assigned_tasks')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .select('id')

  if (error) {
    if (error.code === AUDIENCE_REJECTED) {
      return { ok: false, error: 'This task is not yours to complete.' }
    }

    console.error('toggleTaskCompletion: update failed', error)
    return { ok: false, error: 'Could not save that. Please try again.' }
  }

  // Zero rows means RLS filtered it out — no access, or no such task.
  if (!data || data.length === 0) {
    return { ok: false, error: 'This task is not yours to complete.' }
  }

  revalidatePath(`/portal/${studentId}/timeline`)

  return { ok: true }
}
