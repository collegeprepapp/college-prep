'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStudent } from '../actions'
import type { StudentFormInput } from '@/lib/students/form'
import {
  ErrorBanner,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  StudentFormFields,
} from '@/components/student-form-fields'
import { DEMO_TEST_SCORES } from './demo-data'
import {
  ActivitiesTab,
  DocsTab,
  EssaysTab,
  ScholarshipsTab,
  SchoolsTab,
} from './demo-tabs'
import { NotesTab, type NoteRow } from './notes-tab'
import { InviteParentForm } from './invite-parent-form'

const TABS = [
  'Overview',
  'Notes',
  'Test Scores',
  'Parents',
  'Schools',
  'Scholarships',
  'Essays',
  'Activities',
  'Docs',
] as const

type Tab = (typeof TABS)[number]

// Tabs backed by hardcoded demo data rather than the database — see
// demo-tabs.tsx. Nothing in them reads from or writes to Supabase yet.
const DEMO_TABS: Record<string, () => React.ReactElement> = {
  Schools: SchoolsTab,
  Scholarships: ScholarshipsTab,
  Essays: EssaysTab,
  Activities: ActivitiesTab,
  Docs: DocsTab,
}

export type StudentSummary = {
  id: string
  first_name: string
  last_name: string
  graduation_year: number
  gpa: number | null
  class_rank: string | null
  email: string | null
}

export type TestScoreRow = {
  id: string
  test_type: string
  score: number
  test_date: string | null
}

// id and status are nullable because they come from a view — Postgres does not
// carry NOT NULL through a view definition. parentName is resolved server-side.
export type ParentLinkRow = {
  id: string | null
  status: string | null
  parentName: string | null
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide opacity-60">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  )
}

function toFormInput(student: StudentSummary): StudentFormInput {
  return {
    firstName: student.first_name,
    lastName: student.last_name,
    graduationYear: String(student.graduation_year),
    email: student.email ?? '',
    gpa: student.gpa === null ? '' : String(student.gpa),
    classRank: student.class_rank ?? '',
  }
}

/**
 * Overview switches between a read-only field grid and an edit form.
 *
 * On save it calls router.refresh(), which re-runs the server component and
 * feeds fresh props down without a full page reload or losing the active tab.
 * That keeps one source of truth — the database — instead of mirroring saved
 * values in local state, which would drift from what Postgres actually stored
 * (numeric(3,2) rounds GPA, for one).
 */
function OverviewTab({
  student,
  canEdit,
}: {
  student: StudentSummary
  canEdit: boolean
}) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [values, setValues] = useState<StudentFormInput>(() =>
    toFormInput(student)
  )
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setValues(toFormInput(student))
    setError(null)
    setSavedAt(false)
    setIsEditing(true)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    const result = await updateStudent(student.id, values)
    setIsSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setIsEditing(false)
    setSavedAt(true)
    router.refresh()
  }

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <StudentFormFields
          idPrefix="edit-student"
          values={values}
          onChange={setValues}
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
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Graduation Year" value={student.graduation_year} />
        <Field label="GPA" value={student.gpa ?? '—'} />
        <Field label="Class Rank" value={student.class_rank ?? '—'} />
        <Field label="Email" value={student.email ?? '—'} />
      </dl>

      {savedAt && <p className="text-sm opacity-70">Changes saved.</p>}

      {canEdit && (
        <button
          type="button"
          onClick={startEditing}
          className={`self-start ${SECONDARY_BUTTON_CLASS}`}
        >
          Edit
        </button>
      )}
    </div>
  )
}

/**
 * The only tab that mixes real and demo data.
 *
 * test_scores is a real table, so genuine rows always render. The sample SAT/ACT
 * scores appear ONLY when a student has none recorded, so the tab is not blank
 * in a demo — and they are labelled, because unlabelled fake scores on a working
 * feature would be indistinguishable from real ones. Delete the fallback branch
 * (and DEMO_TEST_SCORES) once real scores are being entered.
 */
function TestScoresTab({ scores }: { scores: TestScoreRow[] }) {
  const isDemo = scores.length === 0
  const rows = isDemo ? DEMO_TEST_SCORES : scores

  return (
    <div className="flex flex-col gap-4">
      {/* Header markup mirrors the demo tabs but is inlined rather than shared,
          so this real tab does not break when demo-tabs.tsx is deleted. */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium">Test Scores</h3>
        <button type="button" className={PRIMARY_BUTTON_CLASS}>
          Add Test Score
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((score) => (
          <li
            key={score.id}
            className="flex items-center justify-between gap-4 text-sm"
          >
            <span>
              <span className="font-medium">{score.test_type}</span>{' '}
              {score.score}
              <span className="opacity-60">
                {score.test_date ? ` — ${score.test_date}` : ''}
              </span>
            </span>

            {/* Inert: editing a score is not built yet. */}
            <button
              type="button"
              aria-label={`Edit ${score.test_type} score`}
              className={`shrink-0 ${SECONDARY_BUTTON_CLASS}`}
            >
              Edit
            </button>
          </li>
        ))}
      </ul>

      {isDemo && (
        <p className="text-xs opacity-50">
          Sample scores — nothing recorded for this student yet.
        </p>
      )}
    </div>
  )
}

export function StudentDetailTabs({
  student,
  testScores,
  parentLinks,
  notes,
  studentId,
  viewerProfileId,
  canEdit,
}: {
  student: StudentSummary
  testScores: TestScoreRow[]
  parentLinks: ParentLinkRow[]
  notes: NoteRow[]
  studentId: string
  viewerProfileId: string
  // Admin, or the student viewing their own record — decided by the page's
  // access check. RLS (migration 006) is what actually enforces it on save.
  canEdit: boolean
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Student sections"
        className="flex flex-wrap gap-1 border-b border-black/10 dark:border-white/15"
      >
        {TABS.map((tab) => {
          const isActive = tab === activeTab
          return (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={
                isActive
                  ? 'border-b-2 border-foreground px-3 py-2 text-sm font-medium'
                  : 'border-b-2 border-transparent px-3 py-2 text-sm opacity-60 transition-opacity hover:opacity-100'
              }
            >
              {tab}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" aria-label={activeTab}>
        {activeTab === 'Overview' && (
          <OverviewTab student={student} canEdit={canEdit} />
        )}

        {activeTab === 'Notes' && (
          <NotesTab
            notes={notes}
            studentId={studentId}
            viewerProfileId={viewerProfileId}
          />
        )}

        {activeTab === 'Test Scores' && <TestScoresTab scores={testScores} />}

        {activeTab === 'Parents' && (
          <div className="flex flex-col gap-6">
            <section>
              <h3 className="text-base font-medium">Parent Links</h3>
              {parentLinks.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">No parent invites yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {parentLinks.map((link, index) => (
                    <li key={link.id ?? index} className="text-sm">
                      <span className="font-medium capitalize">
                        {link.status ?? 'unknown'}
                      </span>
                      {link.status === 'accepted' && (
                        <span className="opacity-70">
                          {' — '}
                          {link.parentName ?? 'Unknown parent'}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <InviteParentForm studentId={student.id} />
          </div>
        )}

        {(() => {
          const DemoTab = DEMO_TABS[activeTab]
          return DemoTab ? <DemoTab /> : null
        })()}
      </div>
    </div>
  )
}
