'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidateStudentRecord } from '@/lib/student-record/revalidate'
import { UUID_PATTERN } from '@/lib/students/form'
import {
  isTestType,
  SCORE_RANGES,
  type TestScoreInput,
} from '@/lib/test-scores/form'

export type TestScoreResult = { ok: true } | { ok: false; error: string }

type TestScoreFields = {
  test_type: string
  score: number
  test_date: string | null
}

function parseTestScore(
  input: TestScoreInput
): { ok: true; fields: TestScoreFields } | { ok: false; error: string } {
  // Mirrors the check constraint from migration 003, so a bad value comes back
  // as a message rather than a Postgres error.
  if (!isTestType(input.testType)) {
    return { ok: false, error: 'Pick either SAT or ACT.' }
  }

  const raw = input.score.trim()

  if (!raw) {
    return { ok: false, error: 'A score is required.' }
  }

  const score = Number(raw)
  const range = SCORE_RANGES[input.testType]

  if (!Number.isInteger(score) || score < range.min || score > range.max) {
    return {
      ok: false,
      error: `A ${input.testType} score must be a whole number between ${range.min} and ${range.max}.`,
    }
  }

  return {
    ok: true,
    fields: {
      test_type: input.testType,
      score,
      test_date: input.testDate.trim() || null,
    },
  }
}

/**
 * All three use the session-bound client with no permission check of their own.
 * Migration 017 gates insert, update, and delete on can_access_student() — an
 * admin at the student's school, the student themselves, or a linked parent —
 * with no author restriction.
 */
export async function createTestScore(
  studentId: string,
  input: TestScoreInput
): Promise<TestScoreResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseTestScore(input)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase.from('test_scores').insert({
    ...parsed.fields,
    student_id: studentId.trim(),
    // The insert policy permits only auth.uid() or null here, so this records
    // whether a score was entered by the office or self-reported.
    added_by: user.id,
  })

  if (error) {
    console.error('createTestScore: insert failed', error)
    return {
      ok: false,
      error: 'Could not add this score. Check your permissions and try again.',
    }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function updateTestScore(
  scoreId: string,
  studentId: string,
  input: TestScoreInput
): Promise<TestScoreResult> {
  if (!UUID_PATTERN.test(scoreId.trim())) {
    return { ok: false, error: 'That does not look like a valid score.' }
  }

  const parsed = parseTestScore(input)
  if (!parsed.ok) return parsed

  const supabase = await createClient()

  // added_by stays put: it records who first entered the score, not who last
  // corrected it. updated_at is maintained by the trigger from 017.
  const { data, error } = await supabase
    .from('test_scores')
    .update(parsed.fields)
    .eq('id', scoreId.trim())
    .select('id')

  if (error) {
    console.error('updateTestScore: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  // Zero rows means RLS filtered it out — no access to this student.
  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save changes.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}

export async function deleteTestScore(
  scoreId: string,
  studentId: string
): Promise<TestScoreResult> {
  if (!UUID_PATTERN.test(scoreId.trim())) {
    return { ok: false, error: 'That does not look like a valid score.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('test_scores')
    .delete()
    .eq('id', scoreId.trim())
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('deleteTestScore: delete failed', error)
    return { ok: false, error: 'Could not remove this score.' }
  }

  revalidateStudentRecord(studentId)
  return { ok: true }
}
