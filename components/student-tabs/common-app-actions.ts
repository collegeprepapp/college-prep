'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidateStudentRecord } from '@/lib/student-record/revalidate'
import { UUID_PATTERN } from '@/lib/students/form'
import type {
  CommonAppActivityInput,
  CommonAppHonorInput,
  CommonAppTestingInput,
} from '@/lib/common-app/constants'

export type CommonAppResult = { ok: true } | { ok: false; error: string }

/**
 * Common App planner writes.
 *
 * Session-bound client throughout, with no permission checks here: migration
 * 020 gates all four operations on can_access_student() with no author
 * restriction, so an unauthorized caller gets an insert error or zero rows.
 *
 * Nothing validates against the option lists in lib/common-app/constants.ts.
 * The database does not constrain them either (020), on purpose — the lists
 * change between cycles, and this is a draft where a half-filled entry has to
 * be saveable. The form is what steers people to valid values.
 */

function optional(value: string): string | null {
  return value.trim() || null
}

/** Empty array is stored as null, so "never answered" and "cleared" agree. */
function optionalArray(values: string[]): string[] | null {
  const cleaned = values.filter((value) => value.trim())
  return cleaned.length > 0 ? cleaned : null
}

function optionalNumber(
  value: string,
  label: string,
  max: number
): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = value.trim()

  if (!raw) {
    return { ok: true, value: null }
  }

  const parsed = Number(raw)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    return { ok: false, error: `${label} must be between 0 and ${max}.` }
  }

  return { ok: true, value: parsed }
}

function optionalSourceId(
  value: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = value.trim()

  if (!raw) {
    return { ok: true, value: null }
  }

  if (!UUID_PATTERN.test(raw)) {
    return { ok: false, error: 'That source selection is not valid.' }
  }

  return { ok: true, value: raw }
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

function parseActivity(input: CommonAppActivityInput) {
  const source = optionalSourceId(input.sourceActivityId)
  if (!source.ok) return source

  const hours = optionalNumber(input.hoursPerWeek, 'Hours per week', 168)
  if (!hours.ok) return hours

  const weeks = optionalNumber(input.weeksPerYear, 'Weeks per year', 52)
  if (!weeks.ok) return weeks

  return {
    ok: true as const,
    fields: {
      source_activity_id: source.value,
      activity_type: optional(input.activityType),
      position_title: optional(input.positionTitle),
      organization_name: optional(input.organizationName),
      description: optional(input.description),
      participation_grades: optionalArray(input.participationGrades),
      participation_timing: optionalArray(input.participationTiming),
      hours_per_week: hours.value,
      weeks_per_year: weeks.value,
      continue_in_college: input.continueInCollege,
    },
  }
}

export async function createCommonAppActivity(
  studentId: string,
  input: CommonAppActivityInput
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseActivity(input)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  // New entries land at the bottom of the ranking.
  const { data: last } = await supabase
    .from('common_app_activities')
    .select('sort_order')
    .eq('student_id', studentId.trim())
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('common_app_activities').insert({
    ...parsed.fields,
    student_id: studentId.trim(),
    sort_order: (last?.sort_order ?? -1) + 1,
    added_by: user.id,
  })

  if (error) {
    console.error('createCommonAppActivity: insert failed', error)
    return { ok: false, error: 'Could not add this entry.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function updateCommonAppActivity(
  entryId: string,
  studentId: string,
  input: CommonAppActivityInput
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(entryId.trim())) {
    return { ok: false, error: 'That does not look like a valid entry.' }
  }

  const parsed = parseActivity(input)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  // sort_order and added_by stay put: ranking changes by dragging, and
  // authorship should not move when someone else edits.
  const { data, error } = await supabase
    .from('common_app_activities')
    .update(parsed.fields)
    .eq('id', entryId.trim())
    .select('id')

  if (error) {
    console.error('updateCommonAppActivity: update failed', error)
    return { ok: false, error: 'Could not save changes.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function deleteCommonAppActivity(
  entryId: string,
  studentId: string
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(entryId.trim())) {
    return { ok: false, error: 'That does not look like a valid entry.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('common_app_activities')
    .delete()
    .eq('id', entryId.trim())
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('deleteCommonAppActivity: delete failed', error)
    return { ok: false, error: 'Could not remove this entry.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

/** See reorderActivities in activities-actions.ts for why this diffs first. */
export async function reorderCommonAppActivities(
  studentId: string,
  orderedIds: string[]
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  if (orderedIds.some((id) => !UUID_PATTERN.test(id))) {
    return { ok: false, error: 'That reorder request was not valid.' }
  }

  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('common_app_activities')
    .select('id, sort_order')
    .eq('student_id', studentId.trim())

  if (readError) {
    console.error('reorderCommonAppActivities: read failed', readError)
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
        .from('common_app_activities')
        .update({ sort_order: index })
        .eq('id', id)
        .select('id')
    )
  )

  if (results.find((result) => result.error || !result.data?.length)) {
    return { ok: false, error: 'Could not save the new order.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Honors
// ---------------------------------------------------------------------------

function parseHonor(input: CommonAppHonorInput) {
  const source = optionalSourceId(input.sourceHonorId)
  if (!source.ok) return source

  return {
    ok: true as const,
    fields: {
      source_honor_id: source.value,
      title: optional(input.title),
      grade_level: optionalArray(input.gradeLevel),
      level_of_recognition: optional(input.levelOfRecognition),
      description: optional(input.description),
    },
  }
}

export async function createCommonAppHonor(
  studentId: string,
  input: CommonAppHonorInput
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseHonor(input)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: last } = await supabase
    .from('common_app_honors')
    .select('sort_order')
    .eq('student_id', studentId.trim())
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await supabase.from('common_app_honors').insert({
    ...parsed.fields,
    student_id: studentId.trim(),
    sort_order: (last?.sort_order ?? -1) + 1,
    added_by: user.id,
  })

  if (error) {
    console.error('createCommonAppHonor: insert failed', error)
    return { ok: false, error: 'Could not add this entry.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function updateCommonAppHonor(
  entryId: string,
  studentId: string,
  input: CommonAppHonorInput
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(entryId.trim())) {
    return { ok: false, error: 'That does not look like a valid entry.' }
  }

  const parsed = parseHonor(input)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('common_app_honors')
    .update(parsed.fields)
    .eq('id', entryId.trim())
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('updateCommonAppHonor: update failed', error)
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function deleteCommonAppHonor(
  entryId: string,
  studentId: string
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(entryId.trim())) {
    return { ok: false, error: 'That does not look like a valid entry.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('common_app_honors')
    .delete()
    .eq('id', entryId.trim())
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('deleteCommonAppHonor: delete failed', error)
    return { ok: false, error: 'Could not remove this entry.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function reorderCommonAppHonors(
  studentId: string,
  orderedIds: string[]
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  if (orderedIds.some((id) => !UUID_PATTERN.test(id))) {
    return { ok: false, error: 'That reorder request was not valid.' }
  }

  const supabase = await createClient()

  const { data: current, error: readError } = await supabase
    .from('common_app_honors')
    .select('id, sort_order')
    .eq('student_id', studentId.trim())

  if (readError) {
    console.error('reorderCommonAppHonors: read failed', readError)
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
        .from('common_app_honors')
        .update({ sort_order: index })
        .eq('id', id)
        .select('id')
    )
  )

  if (results.find((result) => result.error || !result.data?.length)) {
    return { ok: false, error: 'Could not save the new order.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Testing (singleton)
// ---------------------------------------------------------------------------

/**
 * Saves the testing section.
 *
 * An UPSERT, not an insert: common_app_testing holds at most one row per
 * student (migration 021), so a plain insert would succeed once and then fail
 * with 23505 on every later save. student_id has a plain unique constraint —
 * not a partial index — so Postgres can infer the conflict target and
 * onConflict works here, unlike the assigned_tasks case in 007.
 *
 * Both the insert and update policies from 021 apply, since the statement may
 * take either path; RLS covers both.
 */
export async function saveCommonAppTesting(
  studentId: string,
  input: CommonAppTestingInput
): Promise<CommonAppResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('common_app_testing').upsert(
    {
      student_id: studentId.trim(),
      test_optional: input.testOptional,
      reported_scores: optional(input.reportedScores),
      notes: optional(input.notes),
    },
    { onConflict: 'student_id' }
  )

  if (error) {
    console.error('saveCommonAppTesting: upsert failed', error)
    return { ok: false, error: 'Could not save the testing section.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}
