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
import { EditIconButton } from '@/components/icon-button'
import { DocsTab, type DocumentRow } from '@/components/student-tabs/docs-tab'
import {
  TestScoresTab,
  type TestScoreRow,
} from '@/components/student-tabs/test-scores-tab'
import { ActivitiesTab, type ActivityRow } from '@/components/student-tabs/activities-tab'
import { HonorsTab, type HonorRow } from '@/components/student-tabs/honors-tab'
import {
  CommonAppTab,
  type CommonAppActivityRow,
  type CommonAppHonorRow,
  type CommonAppFamilyRow,
  type CommonAppProfileData,
  type CommonAppTestingData,
  type SourceOption,
  type TestScoreOption,
} from '@/components/student-tabs/common-app-tab'
import {
  EssaysTab,
  type EssayRow,
  type EssaySchoolOption,
} from '@/components/student-tabs/essays-tab'
import { ScholarshipsTab, type ScholarshipRow } from '@/components/student-tabs/scholarships-tab'
import { SchoolsTab, type ApplicationRow } from '@/components/student-tabs/schools-tab'
import { NotesTab, type NoteRow } from '@/components/student-tabs/notes-tab'
import { InviteParentForm } from '@/components/student-tabs/invite-parent-form'

const TABS = [
  'Overview',
  'Notes',
  'Test Scores',
  'Parents',
  'Schools',
  'Scholarships',
  'Essays',
  'Activities',
  'Honors',
  'Common App',
  'Docs',
] as const

type Tab = (typeof TABS)[number]

export type StudentSummary = {
  id: string
  first_name: string
  last_name: string
  graduation_year: number
  gpa: number | null
  class_rank: string | null
  email: string | null
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

export function StudentDetailTabs({
  student,
  testScores,
  parentLinks,
  notes,
  applications,
  scholarships,
  essays,
  essaySchools,
  activities,
  honors,
  documents,
  commonAppActivities,
  commonAppHonors,
  activitySources,
  honorSources,
  commonAppTesting,
  testScoreOptions,
  commonAppProfile,
  commonAppFamily,
  studentId,
  viewerProfileId,
  canEdit,
}: {
  student: StudentSummary
  testScores: TestScoreRow[]
  parentLinks: ParentLinkRow[]
  notes: NoteRow[]
  applications: ApplicationRow[]
  scholarships: ScholarshipRow[]
  essays: EssayRow[]
  essaySchools: EssaySchoolOption[]
  activities: ActivityRow[]
  honors: HonorRow[]
  documents: DocumentRow[]
  commonAppActivities: CommonAppActivityRow[]
  commonAppHonors: CommonAppHonorRow[]
  activitySources: SourceOption[]
  honorSources: SourceOption[]
  commonAppTesting: CommonAppTestingData
  testScoreOptions: TestScoreOption[]
  commonAppProfile: CommonAppProfileData
  commonAppFamily: CommonAppFamilyRow[]
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

        {activeTab === 'Activities' && (
          <ActivitiesTab activities={activities} studentId={studentId} />
        )}

        {activeTab === 'Honors' && (
          <HonorsTab honors={honors} studentId={studentId} />
        )}

        {activeTab === 'Essays' && (
          <EssaysTab
            essays={essays}
            schools={essaySchools}
            studentId={studentId}
          />
        )}

        {activeTab === 'Scholarships' && (
          <ScholarshipsTab scholarships={scholarships} studentId={studentId} />
        )}

        {activeTab === 'Schools' && (
          <SchoolsTab applications={applications} studentId={studentId} />
        )}

        {activeTab === 'Notes' && (
          <NotesTab
            notes={notes}
            studentId={studentId}
            viewerProfileId={viewerProfileId}
          />
        )}

        {activeTab === 'Test Scores' && (
          <TestScoresTab scores={testScores} studentId={studentId} />
        )}

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

        {activeTab === 'Common App' && (
          <CommonAppTab
            activities={commonAppActivities}
            honors={commonAppHonors}
            activitySources={activitySources}
            honorSources={honorSources}
            testing={commonAppTesting}
            scoreOptions={testScoreOptions}
            profile={commonAppProfile}
            family={commonAppFamily}
            studentId={studentId}
          />
        )}

        {activeTab === 'Docs' && (
          <DocsTab documents={documents} studentId={studentId} />
        )}
      </div>
    </div>
  )
}
