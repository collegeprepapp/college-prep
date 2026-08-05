import { requireAdmin } from '../../access'
import type { NoteRow } from './notes-tab'
import type { ApplicationRow } from './schools-tab'
import type { ScholarshipRow } from './scholarships-tab'
import type { EssayRow, EssaySchoolOption } from './essays-tab'
import {
  StudentDetailTabs,
  type ParentLinkRow,
} from './student-detail-tabs'

// Note: every column on parent_student_links_safe is typed nullable. Postgres
// does not carry NOT NULL through a view definition, so the generator cannot
// know better. The values are non-null in practice, but the render path handles
// null anyway.

// Branding, nav, and sign-out come from app/dashboard/layout.tsx.
function Shell({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col gap-6 p-10">{children}</main>
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Admin-only page. app/dashboard/layout.tsx already gates the whole section;
  // this repeats the check so the page is not relying on a parent layout for
  // authorization. Students and parents read their own records via /portal.
  const { supabase, userId } = await requireAdmin()

  // An admin from another school gets zero rows back from RLS rather than an
  // error, which is indistinguishable from a bad id — both land on "not found".
  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, graduation_year, gpa, class_rank, email')
    .eq('id', id)
    .maybeSingle()

  if (!student) {
    return (
      <Shell>
        <p className="text-sm opacity-70">Student not found.</p>
      </Shell>
    )
  }

  const { data: scores } = await supabase
    .from('test_scores')
    .select('id, test_type, score, test_date')
    .eq('student_id', id)
    .order('test_date', { ascending: false, nullsFirst: false })

  // The view drops invite_token and applies the same access rules the table's
  // policies would have.
  const { data: links } = await supabase
    .from('parent_student_links_safe')
    .select('id, status, parent_profile_id, created_at, accepted_at')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  // Inferred, not annotated: the row types follow the exact select lists above,
  // so adding or dropping a column updates these automatically.
  const testScores = scores ?? []
  const parentLinks = links ?? []

  // Resolve names for accepted links in one round trip.
  const parentIds = parentLinks
    .map((link) => link.parent_profile_id)
    .filter((value): value is string => Boolean(value))

  const parentNames = new Map<string, string>()

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', parentIds)

    for (const parent of parents ?? []) {
      const name = [parent.first_name, parent.last_name]
        .filter(Boolean)
        .join(' ')
      parentNames.set(parent.id, name || 'Unnamed parent')
    }
  }

  // Notes: RLS decides what comes back — the caller's own notes plus any shared
  // note on a student they can see. Authors are resolved separately rather than
  // through an embed, matching how parent names are resolved above.
  const { data: noteRows } = await supabase
    .from('notes')
    .select('id, content, visibility, created_at, author_id')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  const notes = noteRows ?? []
  const authorIds = [...new Set(notes.map((note) => note.author_id))]
  const authorNames = new Map<string, string>()

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', authorIds)

    for (const author of authors ?? []) {
      authorNames.set(
        author.id,
        [author.first_name, author.last_name].filter(Boolean).join(' ') ||
          'Unnamed'
      )
    }
  }

  // Dates are formatted here, on the server. Formatting an ISO string inside a
  // client component would render one way on the server and another in the
  // browser's timezone, which React reports as a hydration mismatch.
  const noteRowsForClient: NoteRow[] = notes.map((note) => ({
    id: note.id,
    authorId: note.author_id,
    authorName: authorNames.get(note.author_id) ?? 'Unknown',
    createdAtLabel: new Date(note.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    content: note.content,
    visibility: note.visibility,
  }))

  const { data: applicationRows } = await supabase
    .from('college_applications')
    .select(
      'id, school_name, status, deadline, notes, date_toured, goal_completion_date, requires_common_app_essay, requires_supplemental_essay, recommendations_needed, recommendation_notes, website_link, scholarship_info_link, resume_link, other_links, admission_rep_name, admission_rep_email, scholarship_amount'
    )
    .eq('student_id', id)
    .order('school_name', { ascending: true })

  // Dates are plain 'YYYY-MM-DD'. Formatting them with new Date() in the
  // browser shifts them a day in negative-offset timezones, since the string
  // parses as UTC midnight — so they are formatted here, pinned to UTC. The raw
  // value travels alongside for the date inputs and for sorting.
  const formatDate = (value: string | null) =>
    value
      ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : ''

  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  const applications: ApplicationRow[] = (applicationRows ?? []).map((row) => ({
    id: row.id,
    schoolName: row.school_name,
    status: row.status,
    deadline: row.deadline ?? '',
    deadlineLabel: formatDate(row.deadline),
    dateToured: row.date_toured ?? '',
    dateTouredLabel: formatDate(row.date_toured),
    goalCompletionDate: row.goal_completion_date ?? '',
    goalCompletionDateLabel: formatDate(row.goal_completion_date),
    requiresCommonAppEssay: row.requires_common_app_essay,
    requiresSupplementalEssay: row.requires_supplemental_essay,
    recommendationsNeeded: row.recommendations_needed,
    recommendationNotes: row.recommendation_notes ?? '',
    websiteLink: row.website_link ?? '',
    scholarshipInfoLink: row.scholarship_info_link ?? '',
    resumeLink: row.resume_link ?? '',
    otherLinks: row.other_links ?? '',
    admissionRepName: row.admission_rep_name ?? '',
    admissionRepEmail: row.admission_rep_email ?? '',
    scholarshipAmount: row.scholarship_amount,
    scholarshipAmountLabel:
      row.scholarship_amount === null ? '' : currency.format(row.scholarship_amount),
    notes: row.notes ?? '',
  }))

  const { data: scholarshipRows } = await supabase
    .from('scholarships')
    .select('id, name, amount, status, deadline, link, notes')
    .eq('student_id', id)
    .order('name', { ascending: true })

  const scholarships: ScholarshipRow[] = (scholarshipRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    amountLabel: row.amount === null ? '' : currency.format(row.amount),
    status: row.status,
    deadline: row.deadline ?? '',
    deadlineLabel: formatDate(row.deadline),
    link: row.link ?? '',
    notes: row.notes ?? '',
  }))

  const { data: essayRows } = await supabase
    .from('essays')
    .select(
      'id, title, prompt, essay_type, college_application_id, content, word_count, updated_at'
    )
    .eq('student_id', id)
    .order('updated_at', { ascending: false })

  // The school link resolves against the college list already fetched above,
  // so linking an essay costs no extra query.
  const schoolNameById = new Map(
    applications.map((application) => [application.id, application.schoolName])
  )

  const essaySchools: EssaySchoolOption[] = applications.map((application) => ({
    id: application.id,
    name: application.schoolName,
  }))

  const essays: EssayRow[] = (essayRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    prompt: row.prompt ?? '',
    essayType: row.essay_type,
    collegeApplicationId: row.college_application_id ?? '',
    schoolName: row.college_application_id
      ? (schoolNameById.get(row.college_application_id) ?? '')
      : '',
    content: row.content,
    wordCount: row.word_count,
    updatedAtLabel: new Date(row.updated_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
  }))

  // Flattened here rather than passing the Map across the server/client
  // boundary, so the client component gets plain rows it can render directly.
  const parentLinkRows: ParentLinkRow[] = parentLinks.map((link) => ({
    id: link.id,
    status: link.status,
    parentName: link.parent_profile_id
      ? (parentNames.get(link.parent_profile_id) ?? null)
      : null,
  }))

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">
        {student.first_name} {student.last_name}
      </h1>

      <StudentDetailTabs
        student={{
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          graduation_year: student.graduation_year,
          gpa: student.gpa,
          class_rank: student.class_rank,
          email: student.email,
        }}
        testScores={testScores}
        parentLinks={parentLinkRows}
        notes={noteRowsForClient}
        applications={applications}
        scholarships={scholarships}
        essays={essays}
        essaySchools={essaySchools}
        studentId={student.id}
        viewerProfileId={userId}
        // Everyone who reaches this page is an admin.
        canEdit
      />
    </Shell>
  )
}
