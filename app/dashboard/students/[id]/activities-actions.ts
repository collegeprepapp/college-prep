'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActivityFormInput } from '@/lib/activities/form'
import { UUID_PATTERN } from '@/lib/students/form'

export type ActivityResult = { ok: true } | { ok: false; error: string }

type ActivityFields = {
  name: string
  years_participated: string | null
  hours_per_week: number | null
  weeks_per_year: number | null
  description: string | null
  leadership_actions: string | null
}

function optional(value: string): string | null {
  return value.trim() || null
}

/** Blank means "not recorded"; anything else must be a sane whole number. */
function optionalCount(
  value: string,
  label: string,
  max: number
): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = value.trim()

  if (!raw) {
    return { ok: true, value: null }
  }

  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    return {
      ok: false,
      error: `${label} must be a whole number between 0 and ${max}.`,
    }
  }

  return { ok: true, value: parsed }
}

function parseActivity(
  input: ActivityFormInput
): { ok: true; fields: ActivityFields } | { ok: false; error: string } {
  const name = input.name.trim()

  if (!name) {
    return { ok: false, error: 'An activity name is required.' }
  }

  // The column itself is unconstrained (migration 015 leaves the judgement to a
  // counselor), but a typo like 200 hours a week is worth catching at the form.
  const hours = optionalCount(input.hoursPerWeek, 'Hours per week', 168)
  if (!hours.ok) return hours

  const weeks = optionalCount(input.weeksPerYear, 'Weeks per year', 52)
  if (!weeks.ok) return weeks

  return {
    ok: true,
    fields: {
      name,
      years_participated: optional(input.yearsParticipated),
      hours_per_week: hours.value,
      weeks_per_year: weeks.value,
      description: optional(input.description),
      leadership_actions: optional(input.leadershipActions),
    },
  }
}

/**
 * Every action uses the session-bound client with no permission check of its
 * own. Migration 015 gates all four operations on can_access_student(), with no
 * author restriction.
 */
export async function createActivity(
  studentId: string,
  input: ActivityFormInput
): Promise<ActivityResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseActivity(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  // New items go to the bottom: one past the current highest rank.
  const { data: last } = await supabase
    .from('activities')
    .select('sort_order')
    .eq('student_id', studentId.trim())
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('activities').insert({
    ...parsed.fields,
    student_id: studentId.trim(),
    sort_order: (last?.sort_order ?? -1) + 1,
    added_by: user.id,
  })

  if (error) {
    console.error('createActivity: insert failed', error)
    return {
      ok: false,
      error: 'Could not add this activity. Check your permissions.',
    }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function updateActivity(
  activityId: string,
  studentId: string,
  input: ActivityFormInput
): Promise<ActivityResult> {
  if (!UUID_PATTERN.test(activityId.trim())) {
    return { ok: false, error: 'That does not look like a valid activity.' }
  }

  const parsed = parseActivity(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  // sort_order and added_by are deliberately absent: ranking is changed by
  // dragging, and authorship should not move when someone else edits.
  const { data, error } = await supabase
    .from('activities')
    .update(parsed.fields)
    .eq('id', activityId.trim())
    .select('id')

  if (error) {
    console.error('updateActivity: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function deleteActivity(
  activityId: string,
  studentId: string
): Promise<ActivityResult> {
  if (!UUID_PATTERN.test(activityId.trim())) {
    return { ok: false, error: 'That does not look like a valid activity.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId.trim())
    .select('id')

  if (error) {
    console.error('deleteActivity: delete failed', error)
    return { ok: false, error: 'Could not remove this activity.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not remove this activity.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

/**
 * Persists a new ranking.
 *
 * PostgREST has no multi-row update in one statement (a partial upsert would
 * need every NOT NULL column, so it is not usable here), so this reads the
 * current values, writes only the rows whose position actually moved, and runs
 * those in parallel. A drag usually shifts one contiguous run, so this is a
 * handful of writes rather than one per item.
 *
 * Not atomic: a partial failure leaves a partly-applied order. That is
 * recoverable by dragging again, and the caller rolls its optimistic order back
 * on failure so the screen never claims more than the database did.
 */
export async function reorderActivities(
  studentId: string,
  orderedIds: string[]
): Promise<ActivityResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  if (orderedIds.some((id) => !UUID_PATTERN.test(id))) {
    return { ok: false, error: 'That reorder request was not valid.' }
  }

  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('activities')
    .select('id, sort_order')
    .eq('student_id', studentId.trim())

  if (readError) {
    console.error('reorderActivities: read failed', readError)
    return { ok: false, error: 'Could not save the new order.' }
  }

  const currentById = new Map(
    (current ?? []).map((row) => [row.id, row.sort_order])
  )

  const changed = orderedIds
    .map((id, index) => ({ id, index }))
    .filter(({ id, index }) => currentById.has(id) && currentById.get(id) !== index)

  const results = await Promise.all(
    changed.map(({ id, index }) =>
      supabase
        .from('activities')
        .update({ sort_order: index })
        .eq('id', id)
        .select('id')
    )
  )

  const failed = results.find((result) => result.error || !result.data?.length)

  if (failed) {
    console.error('reorderActivities: write failed', failed.error)
    return { ok: false, error: 'Could not save the new order.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}
