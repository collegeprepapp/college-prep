'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { HonorFormInput } from '@/lib/honors/form'
import { UUID_PATTERN } from '@/lib/students/form'

export type HonorResult = { ok: true } | { ok: false; error: string }

type HonorFields = {
  name: string
  year_earned: string | null
  organization_name: string | null
  description: string | null
}

function optional(value: string): string | null {
  return value.trim() || null
}

function parseHonor(
  input: HonorFormInput
): { ok: true; fields: HonorFields } | { ok: false; error: string } {
  const name = input.name.trim()

  if (!name) {
    return { ok: false, error: 'An honor name is required.' }
  }

  return {
    ok: true,
    fields: {
      name,
      year_earned: optional(input.yearEarned),
      organization_name: optional(input.organizationName),
      description: optional(input.description),
    },
  }
}

/**
 * Mirrors activities-actions.ts. Migration 015 gates all four operations on
 * can_access_student(), with no author restriction.
 */
export async function createHonor(
  studentId: string,
  input: HonorFormInput
): Promise<HonorResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseHonor(input)
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

  // New items go to the bottom.
  const { data: last } = await supabase
    .from('honors')
    .select('sort_order')
    .eq('student_id', studentId.trim())
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('honors').insert({
    ...parsed.fields,
    student_id: studentId.trim(),
    sort_order: (last?.sort_order ?? -1) + 1,
    added_by: user.id,
  })

  if (error) {
    console.error('createHonor: insert failed', error)
    return {
      ok: false,
      error: 'Could not add this honor. Check your permissions.',
    }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function updateHonor(
  honorId: string,
  studentId: string,
  input: HonorFormInput
): Promise<HonorResult> {
  if (!UUID_PATTERN.test(honorId.trim())) {
    return { ok: false, error: 'That does not look like a valid honor.' }
  }

  const parsed = parseHonor(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  // sort_order and added_by deliberately absent, as in activities.
  const { data, error } = await supabase
    .from('honors')
    .update(parsed.fields)
    .eq('id', honorId.trim())
    .select('id')

  if (error) {
    console.error('updateHonor: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function deleteHonor(
  honorId: string,
  studentId: string
): Promise<HonorResult> {
  if (!UUID_PATTERN.test(honorId.trim())) {
    return { ok: false, error: 'That does not look like a valid honor.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('honors')
    .delete()
    .eq('id', honorId.trim())
    .select('id')

  if (error) {
    console.error('deleteHonor: delete failed', error)
    return { ok: false, error: 'Could not remove this honor.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not remove this honor.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

/** See reorderActivities for why this reads first and writes only what moved. */
export async function reorderHonors(
  studentId: string,
  orderedIds: string[]
): Promise<HonorResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  if (orderedIds.some((id) => !UUID_PATTERN.test(id))) {
    return { ok: false, error: 'That reorder request was not valid.' }
  }

  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('honors')
    .select('id, sort_order')
    .eq('student_id', studentId.trim())

  if (readError) {
    console.error('reorderHonors: read failed', readError)
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
      supabase.from('honors').update({ sort_order: index }).eq('id', id).select('id')
    )
  )

  const failed = results.find((result) => result.error || !result.data?.length)

  if (failed) {
    console.error('reorderHonors: write failed', failed.error)
    return { ok: false, error: 'Could not save the new order.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}
