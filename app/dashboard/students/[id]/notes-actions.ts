'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { UUID_PATTERN } from '@/lib/students/form'

export type NoteResult = { ok: true } | { ok: false; error: string }

// notes.visibility is plain text in the schema (a check constraint keeps it
// honest), so the generated types give us `string`. Narrow it here.
type NoteVisibility = 'private' | 'shared'

/**
 * All three actions use the session-bound client with no permission check of
 * their own. Migration 010's policies are the enforcement:
 *
 *   insert -> author_id must equal auth.uid(), and can_access_student() must
 *             pass for the target student
 *   update -> author only
 *   delete -> author only
 *
 * An unauthorized caller therefore gets an insert error or a zero-row result
 * rather than being stopped here.
 */

function validateVisibility(value: string): value is NoteVisibility {
  return value === 'private' || value === 'shared'
}

export async function createNote(
  studentId: string,
  content: string,
  visibility: string
): Promise<NoteResult> {
  if (!UUID_PATTERN.test(studentId.trim())) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const body = content.trim()

  if (!body) {
    return { ok: false, error: 'A note cannot be empty.' }
  }

  if (!validateVisibility(visibility)) {
    return { ok: false, error: 'Pick a valid visibility.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase
    .from('notes')
    .insert({
      student_id: studentId.trim(),
      // profiles.id is the auth user id (migration 002), which is what the
      // insert policy compares against.
      author_id: user.id,
      content: body,
      visibility,
    })

  if (error) {
    console.error('createNote: insert failed', error)
    return {
      ok: false,
      error: 'Could not save this note. Check your permissions and try again.',
    }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function updateNote(
  noteId: string,
  studentId: string,
  content: string,
  visibility: string
): Promise<NoteResult> {
  if (!UUID_PATTERN.test(noteId.trim())) {
    return { ok: false, error: 'That does not look like a valid note.' }
  }

  const body = content.trim()

  if (!body) {
    return { ok: false, error: 'A note cannot be empty.' }
  }

  if (!validateVisibility(visibility)) {
    return { ok: false, error: 'Pick a valid visibility.' }
  }

  const supabase = await createClient()

  // updated_at is maintained by the notes_set_updated_at trigger, not here.
  const { data, error } = await supabase
    .from('notes')
    .update({ content: body, visibility })
    .eq('id', noteId.trim())
    .select('id')

  if (error) {
    console.error('updateNote: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  // Zero rows means RLS filtered it out — not this caller's note.
  if (!data || data.length === 0) {
    return { ok: false, error: 'Only the author can edit this note.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}

export async function deleteNote(
  noteId: string,
  studentId: string
): Promise<NoteResult> {
  if (!UUID_PATTERN.test(noteId.trim())) {
    return { ok: false, error: 'That does not look like a valid note.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId.trim())
    .select('id')

  if (error) {
    console.error('deleteNote: delete failed', error)
    return { ok: false, error: 'Could not delete this note.' }
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'Only the author can delete this note.' }
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}
