'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { UUID_PATTERN } from '@/lib/students/form'

export type DocumentResult = { ok: true } | { ok: false; error: string }

export type DownloadUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

const BUCKET = 'documents'

/** Signed links are short-lived on purpose; long enough to start a download. */
const SIGNED_URL_SECONDS = 60

/**
 * Records the metadata row for a file the browser has already uploaded.
 *
 * The upload itself happens client-side straight to Storage — the policies from
 * migration 016 authorize it — so this only writes the row that makes the
 * object discoverable. If it fails, the caller deletes the orphaned object.
 *
 * storage_path is validated against the <student_id>/<file> convention those
 * same policies depend on, so a row can never point outside its own student's
 * folder even though this insert is what makes the object visible.
 */
export async function recordDocument(
  studentId: string,
  input: {
    fileName: string
    storagePath: string
    mimeType: string
    fileSizeBytes: number
  }
): Promise<DocumentResult> {
  const student = studentId.trim()

  if (!UUID_PATTERN.test(student)) {
    return { ok: false, error: 'That does not look like a valid student.' }
  }

  const fileName = input.fileName.trim()

  if (!fileName) {
    return { ok: false, error: 'The file needs a name.' }
  }

  if (!input.storagePath.startsWith(`${student}/`)) {
    return { ok: false, error: 'That upload path is not valid.' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in.' }
  }

  const { error } = await supabase.from('documents').insert({
    student_id: student,
    file_name: fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType || null,
    file_size_bytes: Number.isFinite(input.fileSizeBytes)
      ? input.fileSizeBytes
      : null,
    // The insert policy permits only auth.uid() or null here.
    uploaded_by: user.id,
  })

  if (error) {
    console.error('recordDocument: insert failed', error)
    return { ok: false, error: 'The file uploaded but could not be saved.' }
  }

  revalidatePath(`/dashboard/students/${student}`)
  return { ok: true }
}

/**
 * A short-lived signed URL for one document.
 *
 * The bucket is private, so this is the only way to read a file — no permanent
 * public link exists to leak. `download` sets the filename the browser saves
 * as, which restores the original name over the uuid-prefixed storage key.
 */
export async function createDocumentDownloadUrl(
  documentId: string
): Promise<DownloadUrlResult> {
  if (!UUID_PATTERN.test(documentId.trim())) {
    return { ok: false, error: 'That does not look like a valid document.' }
  }

  const supabase = await createClient()

  // RLS scopes this: a document for a student the caller cannot see returns no
  // row, so there is nothing to sign.
  const { data: document, error } = await supabase
    .from('documents')
    .select('storage_path, file_name')
    .eq('id', documentId.trim())
    .maybeSingle()

  if (error || !document) {
    return { ok: false, error: 'Could not find that document.' }
  }

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS, {
      download: document.file_name,
    })

  if (signError || !data) {
    console.error('createDocumentDownloadUrl: sign failed', signError)
    return { ok: false, error: 'Could not prepare that download.' }
  }

  return { ok: true, url: data.signedUrl }
}

/**
 * Deletes both halves of a document.
 *
 * Order matters and is not arbitrary: the metadata row goes first, then the
 * stored object. The two are not transactional, so one of them can fail —
 * and a leftover object nobody can see is a better outcome than a visible row
 * whose file is already gone and whose download button would always fail.
 */
export async function deleteDocument(
  documentId: string,
  studentId: string
): Promise<DocumentResult> {
  if (!UUID_PATTERN.test(documentId.trim())) {
    return { ok: false, error: 'That does not look like a valid document.' }
  }

  const supabase = await createClient()

  const { data: document } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId.trim())
    .maybeSingle()

  if (!document) {
    return { ok: false, error: 'Could not find that document.' }
  }

  const { data, error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId.trim())
    .select('id')

  if (error || !data || data.length === 0) {
    console.error('deleteDocument: row delete failed', error)
    return { ok: false, error: 'Could not delete this document.' }
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([document.storage_path])

  if (storageError) {
    // The row is already gone, so the user's view is correct. The object is now
    // unreferenced — logged so it can be swept up later.
    console.error(
      'deleteDocument: orphaned storage object',
      document.storage_path,
      storageError
    )
  }

  revalidatePath(`/dashboard/students/${studentId.trim()}`)
  return { ok: true }
}
