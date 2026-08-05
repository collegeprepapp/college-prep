'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ErrorBanner,
  INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import { DeleteIconButton, EditIconButton } from '@/components/icon-button'
import { ESSAY_TYPES, essayTypeLabel } from '@/lib/essays/types'
import { EMPTY_ESSAY_META, type EssayMetaInput } from '@/lib/essays/form'
import {
  createEssay,
  deleteEssay,
  getEssayVersionContent,
  listEssayVersions,
  restoreEssayVersion,
  saveEssay,
  type EssayVersionSummary,
} from './essays-actions'
import { RichTextEditor } from './rich-text-editor'

export type EssayRow = {
  id: string
  title: string
  prompt: string
  essayType: string
  collegeApplicationId: string
  /** Name of the linked school, resolved server-side. '' when unlinked. */
  schoolName: string
  content: string
  wordCount: number
  updatedAtLabel: string
}

/** The student's college list, for the optional school link. */
export type EssaySchoolOption = {
  id: string
  name: string
}

function toMetaInput(essay: EssayRow): EssayMetaInput {
  return {
    title: essay.title,
    prompt: essay.prompt,
    essayType: essay.essayType,
    collegeApplicationId: essay.collegeApplicationId,
  }
}

function MetaFields({
  idPrefix,
  values,
  onChange,
  schools,
  disabled,
}: {
  idPrefix: string
  values: EssayMetaInput
  onChange: (values: EssayMetaInput) => void
  schools: EssaySchoolOption[]
  disabled?: boolean
}) {
  function set<K extends keyof EssayMetaInput>(
    key: K,
    value: EssayMetaInput[K]
  ) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-title`} className="text-sm font-medium">
            Title
          </label>
          <input
            id={`${idPrefix}-title`}
            type="text"
            required
            disabled={disabled}
            value={values.title ?? ''}
            onChange={(event) => set('title', event.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-type`} className="text-sm font-medium">
            Type
          </label>
          <select
            id={`${idPrefix}-type`}
            disabled={disabled}
            value={values.essayType ?? 'common_app'}
            onChange={(event) => set('essayType', event.target.value)}
            className={INPUT_CLASS}
          >
            {ESSAY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-school`} className="text-sm font-medium">
            For School
          </label>
          <select
            id={`${idPrefix}-school`}
            disabled={disabled || schools.length === 0}
            value={values.collegeApplicationId ?? ''}
            onChange={(event) => set('collegeApplicationId', event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">
              {schools.length === 0 ? 'No schools on the list yet' : 'Not linked'}
            </option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-prompt`} className="text-sm font-medium">
          Prompt
        </label>
        <textarea
          id={`${idPrefix}-prompt`}
          rows={2}
          disabled={disabled}
          value={values.prompt ?? ''}
          onChange={(event) => set('prompt', event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Version history
// ---------------------------------------------------------------------------

function VersionHistory({
  essay,
  studentId,
  onClose,
  onRestored,
}: {
  essay: EssayRow
  studentId: string
  onClose: () => void
  onRestored: () => void
}) {
  const router = useRouter()
  const [versions, setVersions] = useState<EssayVersionSummary[] | null>(null)
  const [preview, setPreview] = useState<{ id: string; content: string } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Loaded on open rather than with the page: revision bodies are full essays.
  // In an effect, not during render — a render-time call fires again on every
  // re-render before the state settles, duplicating the request.
  useEffect(() => {
    let cancelled = false

    listEssayVersions(essay.id).then((result) => {
      if (cancelled) return
      if (result.ok) setVersions(result.versions)
      else setError(result.error)
    })

    return () => {
      cancelled = true
    }
  }, [essay.id])

  async function showPreview(versionId: string) {
    setError(null)
    setBusyId(versionId)

    const result = await getEssayVersionContent(versionId)
    setBusyId(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setPreview({ id: versionId, content: result.content })
  }

  async function restore(versionId: string) {
    setError(null)
    setBusyId(versionId)

    const result = await restoreEssayVersion(essay.id, versionId, studentId)
    setBusyId(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    // Remounts the editor so it picks up the restored content. Without this the
    // editor keeps the copy it loaded when it opened, and the restore looks
    // like it silently did nothing.
    onRestored()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-sm font-medium">Version history — {essay.title}</h4>
        <button
          type="button"
          onClick={onClose}
          className={SECONDARY_BUTTON_CLASS}
        >
          Back to essay
        </button>
      </div>

      <p className="text-xs opacity-60">
        Restoring writes the old text forward as a new save. Nothing is deleted,
        so you can always come back to where you are now.
      </p>

      {error && <ErrorBanner message={error} />}

      {versions === null && !error && (
        <p className="text-sm opacity-70">Loading history…</p>
      )}

      {versions?.length === 0 && (
        <p className="text-sm opacity-70">
          No saved versions yet — the first save creates one.
        </p>
      )}

      {versions && versions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {versions.map((version, index) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-2 text-sm dark:border-white/10"
            >
              <span className="flex flex-col">
                <span>
                  {version.createdAtLabel}
                  {index === 0 && (
                    <span className="ml-2 rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-70 dark:border-white/20">
                      Current
                    </span>
                  )}
                </span>
                <span className="text-xs opacity-60">
                  {version.savedByName} · {version.wordCount} words
                </span>
              </span>

              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => showPreview(version.id)}
                  disabled={busyId === version.id}
                  className={SECONDARY_BUTTON_CLASS}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => restore(version.id)}
                  disabled={busyId === version.id}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  {busyId === version.id ? 'Restoring…' : 'Restore this version'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide opacity-60">
            Preview
          </span>
          <RichTextEditor content={preview.content} editable={false} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor view
// ---------------------------------------------------------------------------

function EssayEditor({
  essay,
  schools,
  studentId,
  onClose,
  onRestored,
}: {
  essay: EssayRow
  schools: EssaySchoolOption[]
  studentId: string
  onClose: () => void
  onRestored: () => void
}) {
  const router = useRouter()
  const [meta, setMeta] = useState<EssayMetaInput>(() => toMetaInput(essay))
  const [content, setContent] = useState(essay.content)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  async function handleSave() {
    setError(null)
    setIsSaving(true)

    const result = await saveEssay(essay.id, studentId, meta, content)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setJustSaved(true)
    router.refresh()
  }

  if (showHistory) {
    return (
      <VersionHistory
        essay={essay}
        studentId={studentId}
        onClose={() => setShowHistory(false)}
        onRestored={onRestored}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{essay.title}</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className={SECONDARY_BUTTON_CLASS}
          >
            Version History
          </button>
          <button
            type="button"
            onClick={onClose}
            className={SECONDARY_BUTTON_CLASS}
          >
            Close
          </button>
        </div>
      </div>

      <MetaFields
        idPrefix={`essay-${essay.id}`}
        values={meta}
        onChange={(next) => {
          setMeta(next)
          setJustSaved(false)
        }}
        schools={schools}
        disabled={isSaving}
      />

      <RichTextEditor
        content={content}
        onChange={(html) => {
          setContent(html)
          setJustSaved(false)
        }}
      />

      {error && <ErrorBanner message={error} />}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {justSaved && (
          <span className="text-sm opacity-70">
            Saved — a restore point was created.
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

export function EssaysTab({
  essays,
  schools,
  studentId,
}: {
  essays: EssayRow[]
  schools: EssaySchoolOption[]
  studentId: string
}) {
  const router = useRouter()
  const [openEssayId, setOpenEssayId] = useState<string | null>(null)
  // Bumped after a restore to force the editor to remount with fresh props.
  const [editorGeneration, setEditorGeneration] = useState(0)
  const [isAdding, setIsAdding] = useState(false)
  const [newMeta, setNewMeta] = useState<EssayMetaInput>(EMPTY_ESSAY_META)
  const [addError, setAddError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openEssay = essays.find((essay) => essay.id === openEssayId) ?? null

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddError(null)
    setIsSubmitting(true)

    const result = await createEssay(studentId, newMeta)
    setIsSubmitting(false)

    if (!result.ok) {
      setAddError(result.error)
      return
    }

    setIsAdding(false)
    setNewMeta(EMPTY_ESSAY_META)
    // Opens straight into the editor once the refreshed list arrives.
    setOpenEssayId(result.essayId)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Essays</h3>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className={PRIMARY_BUTTON_CLASS}
          >
            New Essay
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
        >
          <h4 className="text-sm font-medium">New Essay</h4>

          <MetaFields
            idPrefix="new-essay"
            values={newMeta}
            onChange={setNewMeta}
            schools={schools}
            disabled={isSubmitting}
          />

          {addError && <ErrorBanner message={addError} />}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? 'Creating…' : 'Create & Open'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                setNewMeta(EMPTY_ESSAY_META)
                setAddError(null)
              }}
              disabled={isSubmitting}
              className={SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {openEssay && (
        <EssayEditor
          // Remounts on essay change, and after a restore, so the editor
          // re-initialises from the current content.
          key={`${openEssay.id}-${editorGeneration}`}
          essay={openEssay}
          schools={schools}
          studentId={studentId}
          onClose={() => setOpenEssayId(null)}
          onRestored={() => setEditorGeneration((n) => n + 1)}
        />
      )}

      {essays.length === 0 ? (
        <p className="text-sm opacity-70">No essays yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {essays.map((essay) => (
            <EssayListItem
              key={essay.id}
              essay={essay}
              studentId={studentId}
              isOpen={essay.id === openEssayId}
              onOpen={() =>
                setOpenEssayId((current) =>
                  current === essay.id ? null : essay.id
                )
              }
              onDeleted={() => {
                setOpenEssayId((current) =>
                  current === essay.id ? null : current
                )
                router.refresh()
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function EssayListItem({
  essay,
  studentId,
  isOpen,
  onOpen,
  onDeleted,
}: {
  essay: EssayRow
  studentId: string
  isOpen: boolean
  onOpen: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  async function remove() {
    setError(null)
    setIsBusy(true)

    const result = await deleteEssay(essay.id, studentId)
    setIsBusy(false)

    if (!result.ok) {
      setIsConfirmingDelete(false)
      setError(result.error)
      return
    }

    onDeleted()
  }

  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        isOpen
          ? 'border-black/30 dark:border-white/40'
          : 'border-black/10 dark:border-white/15'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-col items-start gap-0.5 text-left"
        >
          <span className="text-sm font-medium">{essay.title}</span>
          <span className="text-xs opacity-70">
            {essayTypeLabel(essay.essayType)}
            {essay.schoolName ? ` · ${essay.schoolName}` : ''}
          </span>
          <span className="text-xs opacity-60">
            {essay.wordCount} words · updated {essay.updatedAtLabel}
          </span>
        </button>

        <div className="flex shrink-0 gap-2">
          {isConfirmingDelete ? (
            <>
              <span className="self-center text-xs opacity-70">
                Delete this essay and its history?
              </span>
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
              <EditIconButton
                label={`Open ${essay.title} in the editor`}
                onClick={onOpen}
              />
              <DeleteIconButton
                label={`Delete ${essay.title}`}
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
