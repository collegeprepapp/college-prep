'use server'

import { revalidateStudentRecord } from '@/lib/student-record/revalidate'
import { createClient } from '@/lib/supabase/server'
import { countWords, isEssayType } from '@/lib/essays/types'
import type { EssayMetaInput } from '@/lib/essays/form'
import { UUID_PATTERN } from '@/lib/students/form'

export type EssayResult = { ok: true } | { ok: false; error: string }
export type CreateEssayResult =
  | { ok: true; essayId: string }
  | { ok: false; error: string }

export type EssayVersionSummary = {
  id: string
  savedByName: string
  createdAtLabel: string
  wordCount: number
}

export type VersionsResult =
  | { ok: true; versions: EssayVersionSummary[] }
  | { ok: false; error: string }

export type VersionContentResult =
  | { ok: true; content: string }
  | { ok: false; error: string }

function parseMeta(
  input: EssayMetaInput
):
  | {
      ok: true
      fields: {
        title: string
        prompt: string | null
        essay_type: string
        college_application_id: string | null
      }
    }
  | { ok: false; error: string } {
  const title = input.title.trim()

  if (!title) {
    return { ok: false, error: 'A title is required.' }
  }

  if (!isEssayType(input.essayType)) {
    return { ok: false, error: 'Pick a valid essay type.' }
  }

  const linked = input.collegeApplicationId.trim()

  if (linked && !UUID_PATTERN.test(linked)) {
    return { ok: false, error: 'That does not look like a valid school.' }
  }

  return {
    ok: true,
    fields: {
      title,
      prompt: input.prompt.trim() || null,
      essay_type: input.essayType,
      college_application_id: linked || null,
    },
  }
}

/**
 * Every action here uses the session-bound client with no permission check of
 * its own. Migration 014 gates essays on can_access_student() with no author
 * restriction, and essay_versions through a join back to its parent essay.
 */
export async function createEssay(
  studentId: string,
  input: EssayMetaInput
): Promise<CreateEssayResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const parsed = parseMeta(input)
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

  // Starts empty; content arrives on the first save. No version row yet —
  // there is nothing to restore to.
  const { data, error } = await supabase
    .from('essays')
    .insert({
      ...parsed.fields,
      student_id: studentId.trim(),
      content: '',
      word_count: 0,
      added_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('createEssay: insert failed', error)
    return {
      ok: false,
      error: 'Could not create this essay. Check your permissions.',
    }
  }

  revalidateStudentRecord(studentId.trim())
  return { ok: true, essayId: data.id }
}

/**
 * Saves an essay and snapshots it.
 *
 * The update and the version insert are two statements, not a transaction —
 * PostgREST gives no way to wrap them. The order is deliberate: the essay is
 * written first, so a failure of the snapshot leaves the user's work saved and
 * only loses a restore point. The reverse would risk a version row describing
 * content that never landed.
 *
 * word_count is recomputed here from the submitted HTML rather than taken from
 * the client.
 */
export async function saveEssay(
  essayId: string,
  studentId: string,
  input: EssayMetaInput,
  content: string
): Promise<EssayResult> {
  if (!UUID_PATTERN.test(essayId.trim())) {
    return { ok: false, error: 'That does not look like a valid essay.' }
  }

  const parsed = parseMeta(input)
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

  const wordCount = countWords(content)

  const { data, error } = await supabase
    .from('essays')
    .update({ ...parsed.fields, content, word_count: wordCount })
    .eq('id', essayId.trim())
    .select('id')

  if (error) {
    console.error('saveEssay: update failed', error)
    return { ok: false, error: 'Could not save. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not save this essay.' }
  }

  const { error: versionError } = await supabase.from('essay_versions').insert({
    essay_id: essayId.trim(),
    content,
    word_count: wordCount,
    // The insert policy permits only auth.uid() or null here.
    saved_by: user.id,
  })

  if (versionError) {
    // The essay itself saved, so this is not reported as a failure — saying
    // "could not save" would be false and might prompt a destructive retry.
    console.error('saveEssay: version snapshot failed', versionError)
  }

  revalidateStudentRecord(studentId.trim())
  return { ok: true }
}

export async function deleteEssay(
  essayId: string,
  studentId: string
): Promise<EssayResult> {
  if (!UUID_PATTERN.test(essayId.trim())) {
    return { ok: false, error: 'That does not look like a valid essay.' }
  }

  const supabase = await createClient()

  // essay_versions cascades from this delete (migration 014).
  const { data, error } = await supabase
    .from('essays')
    .delete()
    .eq('id', essayId.trim())
    .select('id')

  if (error) {
    console.error('deleteEssay: delete failed', error)
    return { ok: false, error: 'Could not delete this essay.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Could not delete this essay.' }
  }

  revalidateStudentRecord(studentId.trim())
  return { ok: true }
}

/**
 * Version list for one essay, without the content.
 *
 * Fetched on demand rather than with the page: revision bodies are full essays,
 * and loading every one of them for every essay on every visit would be wasteful.
 */
export async function listEssayVersions(
  essayId: string
): Promise<VersionsResult> {
  if (!UUID_PATTERN.test(essayId.trim())) {
    return { ok: false, error: 'That does not look like a valid essay.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('essay_versions')
    .select('id, word_count, saved_by, created_at')
    .eq('essay_id', essayId.trim())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listEssayVersions: select failed', error)
    return { ok: false, error: 'Could not load version history.' }
  }

  const rows = data ?? []
  const savedByIds = [
    ...new Set(
      rows.map((row) => row.saved_by).filter((v): v is string => Boolean(v))
    ),
  ]

  const names = new Map<string, string>()

  if (savedByIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', savedByIds)

    for (const profile of profiles ?? []) {
      names.set(
        profile.id,
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
          'Unnamed'
      )
    }
  }

  return {
    ok: true,
    versions: rows.map((row) => ({
      id: row.id,
      wordCount: row.word_count,
      savedByName: row.saved_by
        ? (names.get(row.saved_by) ?? 'Unknown')
        : 'System',
      // Formatted here so the browser never re-derives a different timezone.
      createdAtLabel: new Date(row.created_at).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    })),
  }
}

/** Content of one revision, for previewing before restoring. */
export async function getEssayVersionContent(
  versionId: string
): Promise<VersionContentResult> {
  if (!UUID_PATTERN.test(versionId.trim())) {
    return { ok: false, error: 'That does not look like a valid version.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('essay_versions')
    .select('content')
    .eq('id', versionId.trim())
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: 'Could not load that version.' }
  }

  return { ok: true, content: data.content }
}

/**
 * Restores a past revision by writing it forward as a NEW save.
 *
 * Nothing is deleted and no version is rewritten — the restore itself becomes
 * the latest entry in the history, so the state you restored away from is still
 * there to go back to. essay_versions has no update or delete policy at all
 * (migration 014), so this is the only shape a restore could take.
 */
export async function restoreEssayVersion(
  essayId: string,
  versionId: string,
  studentId: string
): Promise<EssayResult> {
  if (
    !UUID_PATTERN.test(essayId.trim()) ||
    !UUID_PATTERN.test(versionId.trim())
  ) {
    return { ok: false, error: 'That does not look like a valid version.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { data: version, error: versionError } = await supabase
    .from('essay_versions')
    .select('content, word_count, essay_id')
    .eq('id', versionId.trim())
    .maybeSingle()

  if (versionError || !version) {
    return { ok: false, error: 'Could not load that version.' }
  }

  // Guards against a version id from a different essay being passed in.
  if (version.essay_id !== essayId.trim()) {
    return { ok: false, error: 'That version belongs to another essay.' }
  }

  const { data, error } = await supabase
    .from('essays')
    .update({ content: version.content, word_count: version.word_count })
    .eq('id', essayId.trim())
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('restoreEssayVersion: update failed', error)
    return { ok: false, error: 'Could not restore that version.' }
  }

  const { error: snapshotError } = await supabase
    .from('essay_versions')
    .insert({
      essay_id: essayId.trim(),
      content: version.content,
      word_count: version.word_count,
      saved_by: user.id,
    })

  if (snapshotError) {
    console.error('restoreEssayVersion: snapshot failed', snapshotError)
  }

  revalidateStudentRecord(studentId.trim())
  return { ok: true }
}
