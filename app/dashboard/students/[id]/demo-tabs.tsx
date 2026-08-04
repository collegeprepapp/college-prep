'use client'

import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@/components/student-form-fields'
import {
  DEMO_ACTIVITIES,
  DEMO_DOCS,
  DEMO_ESSAYS,
  DEMO_NOTES,
  DEMO_SCHOLARSHIPS,
  DEMO_SCHOOLS,
  type ActivityCategory,
  type DemoDoc,
  type NoteVisibility,
  type ScholarshipStatus,
  type SchoolStatus,
} from './demo-data'

/**
 * VISUAL MOCKUPS. Every tab below renders hardcoded data from demo-data.ts and
 * every button is inert — no handlers, no Supabase, no server actions.
 *
 * Styling deliberately reuses the conventions already in the app: the table
 * shape from the students list, the pill badge from the parents page, and the
 * shared button classes. When these features are built for real, the markup
 * should carry over and only the data source changes.
 */

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'blue' | 'amber' | 'green' | 'red' | 'purple'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-black/15 bg-black/5 dark:border-white/20 dark:bg-white/10',
  blue: 'border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  green: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  red: 'border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400',
  purple:
    'border-purple-600/30 bg-purple-600/10 text-purple-700 dark:text-purple-400',
}

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  )
}

/** Section heading with its (inert) primary action on the right. */
function TabHeader({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="text-base font-medium">{title}</h3>
      <button type="button" className={PRIMARY_BUTTON_CLASS}>
        {action}
      </button>
    </div>
  )
}

const TABLE_CLASS = 'w-full min-w-2xl border-collapse text-sm'
const THEAD_ROW_CLASS =
  'border-b border-black/15 text-left dark:border-white/20'
const TH_CLASS = 'py-2 pr-4 font-medium'
const TD_CLASS = 'py-2 pr-4'
const TR_CLASS = 'border-b border-black/5 dark:border-white/10'

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

const VISIBILITY_TONE: Record<NoteVisibility, Tone> = {
  'Staff Only': 'neutral',
  'Shared with Student': 'blue',
  'Shared with Student & Parents': 'green',
}

export function NotesTab() {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Notes" action="Add Note" />

      <ul className="flex flex-col gap-3">
        {DEMO_NOTES.map((note) => (
          <li
            key={note.id}
            className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{note.author}</span>
              <div className="flex items-center gap-2">
                <Badge
                  label={note.visibility}
                  tone={VISIBILITY_TONE[note.visibility]}
                />
                <span className="text-xs opacity-60">{note.date}</span>
              </div>
            </div>

            <p className="text-sm opacity-80">{note.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

const SCHOOL_STATUS_TONE: Record<SchoolStatus, Tone> = {
  Researching: 'neutral',
  Touring: 'blue',
  Applied: 'amber',
  Accepted: 'green',
  Committed: 'purple',
}

export function SchoolsTab() {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Schools" action="Add School" />

      <div className="overflow-x-auto">
        <table className={TABLE_CLASS}>
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <th className={TH_CLASS}>School</th>
              <th className={TH_CLASS}>Status</th>
              <th className={TH_CLASS}>Application Deadline</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SCHOOLS.map((school) => (
              <tr key={school.id} className={TR_CLASS}>
                <td className={`${TD_CLASS} font-medium`}>{school.name}</td>
                <td className={TD_CLASS}>
                  <Badge
                    label={school.status}
                    tone={SCHOOL_STATUS_TONE[school.status]}
                  />
                </td>
                <td className={TD_CLASS}>{school.deadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scholarships
// ---------------------------------------------------------------------------

const SCHOLARSHIP_STATUS_TONE: Record<ScholarshipStatus, Tone> = {
  Researching: 'neutral',
  Applied: 'amber',
  Awarded: 'green',
  Denied: 'red',
}

export function ScholarshipsTab() {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Scholarships" action="Add Scholarship" />

      <div className="overflow-x-auto">
        <table className={TABLE_CLASS}>
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <th className={TH_CLASS}>Scholarship</th>
              <th className={TH_CLASS}>Amount</th>
              <th className={TH_CLASS}>Status</th>
              <th className={TH_CLASS}>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SCHOLARSHIPS.map((scholarship) => (
              <tr key={scholarship.id} className={TR_CLASS}>
                <td className={`${TD_CLASS} font-medium`}>
                  {scholarship.name}
                </td>
                <td className={TD_CLASS}>{scholarship.amount}</td>
                <td className={TD_CLASS}>
                  <Badge
                    label={scholarship.status}
                    tone={SCHOLARSHIP_STATUS_TONE[scholarship.status]}
                  />
                </td>
                <td className={TD_CLASS}>{scholarship.deadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Essays
// ---------------------------------------------------------------------------

export function EssaysTab() {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Essays" action="New Essay" />

      <ul className="flex flex-col gap-3">
        {DEMO_ESSAYS.map((essay) => (
          <li
            key={essay.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{essay.title}</span>
              <span className="text-xs opacity-70">{essay.promptFor}</span>
              <span className="mt-1 text-xs opacity-60">
                {essay.wordCount} words · last edited {essay.lastEdited}
              </span>
            </div>

            {/* Inert, like every other action in this file. */}
            <button
              type="button"
              aria-label={`Edit ${essay.title}`}
              className={`shrink-0 ${SECONDARY_BUTTON_CLASS}`}
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

const ACTIVITY_CATEGORY_TONE: Record<ActivityCategory, Tone> = {
  Volunteer: 'green',
  Leadership: 'purple',
  Athletics: 'blue',
  Arts: 'amber',
  Work: 'neutral',
}

export function ActivitiesTab() {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Activities" action="Add Activity" />

      <div className="overflow-x-auto">
        <table className={TABLE_CLASS}>
          <thead>
            <tr className={THEAD_ROW_CLASS}>
              <th className={TH_CLASS}>Activity</th>
              <th className={TH_CLASS}>Category</th>
              <th className={TH_CLASS}>Hours</th>
              <th className={TH_CLASS}>Dates</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ACTIVITIES.map((activity) => (
              <tr key={activity.id} className={TR_CLASS}>
                <td className={`${TD_CLASS} font-medium`}>{activity.name}</td>
                <td className={TD_CLASS}>
                  <Badge
                    label={activity.category}
                    tone={ACTIVITY_CATEGORY_TONE[activity.category]}
                  />
                </td>
                <td className={TD_CLASS}>{activity.hours}</td>
                <td className={TD_CLASS}>{activity.dateRange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

// Emoji stand-ins, matching the icon convention used by timeline templates.
const DOC_ICON: Record<DemoDoc['kind'], string> = {
  pdf: '📄',
  doc: '📝',
  sheet: '📊',
  image: '🖼️',
}

export function DocsTab() {
  return (
    <div className="flex flex-col gap-4">
      <TabHeader title="Documents" action="Upload" />

      <ul className="flex flex-col gap-2">
        {DEMO_DOCS.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/15"
          >
            <span aria-hidden="true" className="text-lg">
              {DOC_ICON[doc.kind]}
            </span>

            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{doc.filename}</span>
              <span className="text-xs opacity-60">
                Uploaded {doc.uploadedAt} · {doc.size}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
