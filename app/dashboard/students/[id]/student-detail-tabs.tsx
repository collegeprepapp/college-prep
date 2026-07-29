'use client'

import { useState } from 'react'
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

// Tabs whose features do not exist yet. Removing a name from here means the
// switch below needs a real branch for it.
const PLACEHOLDER_TABS: readonly Tab[] = [
  'Notes',
  'Schools',
  'Scholarships',
  'Essays',
  'Activities',
  'Docs',
]

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

function ComingSoon({ tab }: { tab: Tab }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center text-center">
      <p className="text-sm opacity-70">{tab} — coming soon</p>
    </div>
  )
}

export function StudentDetailTabs({
  student,
  testScores,
  parentLinks,
}: {
  student: StudentSummary
  testScores: TestScoreRow[]
  parentLinks: ParentLinkRow[]
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
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Graduation Year" value={student.graduation_year} />
            <Field label="GPA" value={student.gpa ?? '—'} />
            <Field label="Class Rank" value={student.class_rank ?? '—'} />
            <Field label="Email" value={student.email ?? '—'} />
          </dl>
        )}

        {activeTab === 'Test Scores' &&
          (testScores.length === 0 ? (
            <p className="text-sm opacity-70">No test scores recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {testScores.map((score) => (
                <li key={score.id} className="text-sm">
                  <span className="font-medium">{score.test_type}</span>{' '}
                  {score.score}
                  <span className="opacity-60">
                    {score.test_date ? ` — ${score.test_date}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ))}

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

        {PLACEHOLDER_TABS.includes(activeTab) && <ComingSoon tab={activeTab} />}
      </div>
    </div>
  )
}
