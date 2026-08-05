'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import {
  ErrorBanner,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { DeleteIconButton } from '@/components/icon-button'
import { createClient } from '@/lib/supabase/client'
import {
  documentKind,
  toStorageSafeName,
  type DocumentKind,
} from '@/lib/documents/format'
import {
  createDocumentDownloadUrl,
  deleteDocument,
  recordDocument,
} from './documents-actions'

export type DocumentRow = {
  id: string
  fileName: string
  mimeType: string
  sizeLabel: string
  uploadedAtLabel: string
}

const BUCKET = 'documents'

const KIND_ICON: Record<DocumentKind, typeof FileIcon> = {
  pdf: FileText,
  word: FileText,
  text: FileText,
  sheet: FileSpreadsheet,
  image: FileImage,
  other: FileIcon,
}

/**
 * Storage rejects a file before it reaches our code, with a message written for
 * developers. These map the two the user can actually cause to something they
 * can act on.
 */
function uploadErrorMessage(message: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('exceeded') || lower.includes('too large')) {
    return 'That file is larger than the 25 MB limit.'
  }

  if (lower.includes('mime') || lower.includes('content type')) {
    return 'That file type is not allowed. Try a PDF, Word document, spreadsheet, text file, or image.'
  }

  return 'Could not upload that file. Please try again.'
}

function DocumentItem({
  document,
  studentId,
  onDeleted,
}: {
  document: DocumentRow
  studentId: string
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const Icon = KIND_ICON[documentKind(document.mimeType, document.fileName)]

  async function download() {
    setError(null)
    setIsBusy(true)

    const result = await createDocumentDownloadUrl(document.id)
    setIsBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    // The signed URL already carries a download disposition and expires in a
    // minute, so opening it is enough — nothing durable is exposed.
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }

  async function remove() {
    setError(null)
    setIsBusy(true)

    const result = await deleteDocument(document.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onDeleted()
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15">
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-5 shrink-0 opacity-70" />

        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium">{document.fileName}</span>
          <span className="text-xs opacity-60">
            {[document.uploadedAtLabel, document.sizeLabel]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>

        <div className="flex shrink-0 gap-2">
          {isConfirmingDelete ? (
            <>
              <button
                type="button"
                onClick={remove}
                disabled={isBusy}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isBusy ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isBusy}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={download}
                disabled={isBusy}
                className={SECONDARY_BUTTON_CLASS}
              >
                {isBusy ? 'Preparing…' : 'Download'}
              </button>
              <DeleteIconButton
                label={`Delete ${document.fileName}`}
                onClick={() => setIsConfirmingDelete(true)}
              />
            </>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
    </li>
  )
}

export function DocsTab({
  documents,
  studentId,
}: {
  documents: DocumentRow[]
  studentId: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  /**
   * Uploads straight to Storage from the browser, then records the row.
   *
   * supabase-js exposes no progress events for storage uploads, so this shows a
   * busy state naming the file rather than a percentage.
   */
  async function upload(file: File) {
    setError(null)
    setUploadingName(file.name)

    const supabase = createClient()

    // The <student_id>/ prefix is what the storage policies in migration 016
    // check; the uuid keeps two uploads of "transcript.pdf" from colliding,
    // since storage_path is unique.
    const path = `${studentId}/${crypto.randomUUID()}-${toStorageSafeName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false })

    if (uploadError) {
      setUploadingName(null)
      setError(uploadErrorMessage(uploadError.message))
      return
    }

    const result = await recordDocument(studentId, {
      fileName: file.name,
      storagePath: path,
      mimeType: file.type,
      fileSizeBytes: file.size,
    })

    if (!result.ok) {
      // The bytes are up but nothing references them. Remove the object so the
      // bucket does not accumulate files the app cannot see.
      await supabase.storage.from(BUCKET).remove([path])
      setUploadingName(null)
      setError(result.error)
      return
    }

    setUploadingName(null)
    router.refresh()
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    // Sequential rather than parallel: each failure is reported against a named
    // file, and one bad file should not cancel the rest.
    for (const file of Array.from(files)) {
      await upload(file)
    }

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Documents</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadingName !== null}
          className={PRIMARY_BUTTON_CLASS}
        >
          {uploadingName ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void handleFiles(event.dataTransfer.files)
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center transition-colors ${
          isDragging
            ? 'border-black/40 bg-black/[0.03] dark:border-white/50 dark:bg-white/[0.05]'
            : 'border-black/20 dark:border-white/25'
        }`}
      >
        <span className="text-sm opacity-70">
          {uploadingName
            ? `Uploading ${uploadingName}…`
            : 'Drop files here, or use Upload'}
        </span>
        <span className="text-xs opacity-50">
          PDF, Word, spreadsheets, text, or images · up to 25 MB each
        </span>
      </div>

      {error && <ErrorBanner message={error} />}

      {documents.length === 0 ? (
        <p className="text-sm opacity-70">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <DocumentItem
              key={document.id}
              document={document}
              studentId={studentId}
              onDeleted={() => router.refresh()}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
