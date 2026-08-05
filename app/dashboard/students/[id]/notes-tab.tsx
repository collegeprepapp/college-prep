'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import {
  DeleteIconButton,
  EditIconButton,
} from '@/components/icon-button'
import { createNote, deleteNote, updateNote } from './notes-actions'

export type NoteRow = {
  id: string
  authorId: string
  authorName: string
  /** Formatted on the server, so the client never re-renders a different date. */
  createdAtLabel: string
  content: string
  visibility: string
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const isShared = visibility === 'shared'

  return (
    <span
      className={
        isShared
          ? 'rounded-full border border-green-600/30 bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400'
          : 'rounded-full border border-black/15 bg-black/5 px-2 py-0.5 text-xs font-medium dark:border-white/20 dark:bg-white/10'
      }
    >
      {isShared ? 'Shared' : 'Private'}
    </span>
  )
}

function VisibilitySelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Visibility
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="private">Private — only me</option>
        <option value="shared">Shared — anyone with access to this student</option>
      </select>
    </div>
  )
}

function NoteCard({
  note,
  studentId,
  canManage,
}: {
  note: NoteRow
  studentId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(note.content)
  const [visibility, setVisibility] = useState(note.visibility)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  function startEditing() {
    setContent(note.content)
    setVisibility(note.visibility)
    setError(null)
    setIsConfirmingDelete(false)
    setIsEditing(true)
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateNote(note.id, studentId, content, visibility)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setIsEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    setError(null)
    setIsSaving(true)

    const result = await deleteNote(note.id, studentId)
    setIsSaving(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    router.refresh()
  }

  if (isEditing) {
    return (
      <li className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`note-content-${note.id}`}
              className="text-sm font-medium"
            >
              Note
            </label>
            <textarea
              id={`note-content-${note.id}`}
              rows={4}
              required
              disabled={isSaving}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <VisibilitySelect
            id={`note-visibility-${note.id}`}
            value={visibility}
            onChange={setVisibility}
            disabled={isSaving}
          />

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{note.authorName}</span>
        <div className="flex items-center gap-2">
          <VisibilityBadge visibility={note.visibility} />
          <span className="text-xs opacity-60">{note.createdAtLabel}</span>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-sm opacity-80">{note.content}</p>

      {error && <ErrorBanner message={error} />}

      {canManage && (
        <div className="flex gap-2">
          {isConfirmingDelete ? (
            <>
              <span className="self-center text-xs opacity-70">
                Delete this note?
              </span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:text-red-400"
              >
                {isSaving ? 'Deleting…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isSaving}
                className={SECONDARY_BUTTON_CLASS}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <EditIconButton
                label={`Edit note by ${note.authorName} from ${note.createdAtLabel}`}
                onClick={startEditing}
              />
              <DeleteIconButton
                label={`Delete note by ${note.authorName} from ${note.createdAtLabel}`}
                onClick={() => setIsConfirmingDelete(true)}
              />
            </>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Notes for one student.
 *
 * Edit and Delete render only for the note's own author. That is presentation:
 * migration 010's update and delete policies are author-only, so the database
 * refuses either way.
 */
export function NotesTab({
  notes,
  studentId,
  viewerProfileId,
}: {
  notes: NoteRow[]
  studentId: string
  viewerProfileId: string
}) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function closeForm() {
    setIsAdding(false)
    setContent('')
    setVisibility('private')
    setError(null)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await createNote(studentId, content, visibility)
    setIsSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    closeForm()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Notes</h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            Add Note
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-note-content" className="text-sm font-medium">
              Note
            </label>
            <textarea
              id="new-note-content"
              rows={4}
              required
              disabled={isSubmitting}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <VisibilitySelect
            id="new-note-visibility"
            value={visibility}
            onChange={setVisibility}
            disabled={isSubmitting}
          />

          {error && <ErrorBanner message={error} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? 'Saving…' : 'Save Note'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-sm opacity-70">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              studentId={studentId}
              canManage={note.authorId === viewerProfileId}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
