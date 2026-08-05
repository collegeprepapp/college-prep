import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import { formatFileSize } from '@/lib/documents/format'
import type { NoteRow } from '@/components/student-tabs/notes-tab'
import type { ApplicationRow } from '@/components/student-tabs/schools-tab'
import type { ScholarshipRow } from '@/components/student-tabs/scholarships-tab'
import type {
  EssayRow,
  EssaySchoolOption,
} from '@/components/student-tabs/essays-tab'
import type { ActivityRow } from '@/components/student-tabs/activities-tab'
import type { HonorRow } from '@/components/student-tabs/honors-tab'
import type { DocumentRow } from '@/components/student-tabs/docs-tab'
import type { TestScoreRow } from '@/components/student-tabs/test-scores-tab'
import type {
  CommonAppActivityRow,
  CommonAppHonorRow,
  CommonAppFamilyRow,
  CommonAppProfileData,
  CommonAppTestingData,
  SourceOption,
  TestScoreOption,
} from '@/components/student-tabs/common-app-tab'

/**
 * The queries behind a student's record, shared by the admin detail page and
 * the portal.
 *
 * These were duplicated inline in the admin page until the tab components moved
 * to components/student-tabs/. Two copies of "how a college_applications row
 * becomes an ApplicationRow" would drift the moment a column changed — and the
 * date and currency formatting in particular has to happen server-side (see
 * below), so it cannot simply be pushed into the components.
 *
 * NO ACCESS CHECKS HERE. Every function takes an already-authenticated,
 * session-bound client and RLS decides what comes back: an admin sees their
 * school's students, a student their own record, a linked parent their child's.
 * A caller with no access gets empty arrays, not an error.
 */

type Client = Awaited<ReturnType<typeof createClient>>

/**
 * A plain 'YYYY-MM-DD' date column, pinned to UTC.
 *
 * `new Date('2026-10-15')` parses as UTC midnight, so formatting it in a
 * browser west of UTC shows the previous day. Formatting here, with an explicit
 * UTC timezone, is what keeps a deadline from drifting.
 */
function formatDateOnly(value: string | null): string {
  return value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''
}

/** A timestamptz column. Formatted server-side to avoid a hydration mismatch. */
function formatTimestamp(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** first + last from profiles, for the several places that resolve names. */
async function resolveProfileNames(
  supabase: Client,
  ids: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const unique = [...new Set(ids.filter(Boolean))]

  if (unique.length === 0) {
    return names
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', unique)

  for (const profile of data ?? []) {
    names.set(
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        'Unnamed'
    )
  }

  return names
}

export async function fetchTestScores(
  supabase: Client,
  studentId: string
): Promise<TestScoreRow[]> {
  const { data } = await supabase
    .from('test_scores')
    .select('id, test_type, score, test_date')
    .eq('student_id', studentId)
    .order('test_date', { ascending: false, nullsFirst: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    testType: row.test_type,
    score: row.score,
    testDate: row.test_date ?? '',
    testDateLabel: formatDateOnly(row.test_date),
  }))
}

export async function fetchNotes(
  supabase: Client,
  studentId: string
): Promise<NoteRow[]> {
  // RLS decides what comes back: the caller's own notes plus any shared note on
  // a student they can see. Private notes by others never appear.
  const { data } = await supabase
    .from('notes')
    .select('id, content, visibility, created_at, author_id')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  const notes = data ?? []
  const names = await resolveProfileNames(
    supabase,
    notes.map((note) => note.author_id)
  )

  return notes.map((note) => ({
    id: note.id,
    authorId: note.author_id,
    authorName: names.get(note.author_id) ?? 'Unknown',
    createdAtLabel: formatTimestamp(note.created_at),
    content: note.content,
    visibility: note.visibility,
  }))
}

export async function fetchApplications(
  supabase: Client,
  studentId: string
): Promise<ApplicationRow[]> {
  const { data } = await supabase
    .from('college_applications')
    .select(
      'id, school_name, status, deadline, notes, date_toured, goal_completion_date, requires_common_app_essay, requires_supplemental_essay, recommendations_needed, recommendation_notes, website_link, scholarship_info_link, resume_link, other_links, admission_rep_name, admission_rep_email, scholarship_amount'
    )
    .eq('student_id', studentId)
    .order('school_name', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    schoolName: row.school_name,
    status: row.status,
    deadline: row.deadline ?? '',
    deadlineLabel: formatDateOnly(row.deadline),
    dateToured: row.date_toured ?? '',
    dateTouredLabel: formatDateOnly(row.date_toured),
    goalCompletionDate: row.goal_completion_date ?? '',
    goalCompletionDateLabel: formatDateOnly(row.goal_completion_date),
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
      row.scholarship_amount === null
        ? ''
        : currency.format(row.scholarship_amount),
    notes: row.notes ?? '',
  }))
}

export async function fetchScholarships(
  supabase: Client,
  studentId: string
): Promise<ScholarshipRow[]> {
  const { data } = await supabase
    .from('scholarships')
    .select('id, name, amount, status, deadline, link, notes')
    .eq('student_id', studentId)
    .order('name', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.amount,
    amountLabel: row.amount === null ? '' : currency.format(row.amount),
    status: row.status,
    deadline: row.deadline ?? '',
    deadlineLabel: formatDateOnly(row.deadline),
    link: row.link ?? '',
    notes: row.notes ?? '',
  }))
}

/**
 * Essays, plus the school options their "For School" dropdown needs.
 *
 * Takes the already-fetched applications so linking an essay to a school costs
 * no second query.
 */
export async function fetchEssays(
  supabase: Client,
  studentId: string,
  applications: ApplicationRow[]
): Promise<{ essays: EssayRow[]; essaySchools: EssaySchoolOption[] }> {
  const { data } = await supabase
    .from('essays')
    .select(
      'id, title, prompt, essay_type, college_application_id, content, word_count, updated_at'
    )
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false })

  const schoolNameById = new Map(
    applications.map((application) => [application.id, application.schoolName])
  )

  return {
    essaySchools: applications.map((application) => ({
      id: application.id,
      name: application.schoolName,
    })),
    essays: (data ?? []).map((row) => ({
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
      updatedAtLabel: formatTimestamp(row.updated_at),
    })),
  }
}

export async function fetchActivities(
  supabase: Client,
  studentId: string
): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from('activities')
    .select(
      'id, name, years_participated, total_hours, description, leadership_actions'
    )
    .eq('student_id', studentId)
    // Ties broken by name: sort_order has no uniqueness guarantee, so equal
    // values would otherwise order unpredictably between loads.
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    yearsParticipated: row.years_participated ?? '',
    totalHours: row.total_hours,
    description: row.description ?? '',
    leadershipActions: row.leadership_actions ?? '',
  }))
}

export async function fetchHonors(
  supabase: Client,
  studentId: string
): Promise<HonorRow[]> {
  const { data } = await supabase
    .from('honors')
    .select('id, name, year_earned, organization_name, description')
    .eq('student_id', studentId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    yearEarned: row.year_earned ?? '',
    organizationName: row.organization_name ?? '',
    description: row.description ?? '',
  }))
}

export async function fetchDocuments(
  supabase: Client,
  studentId: string
): Promise<DocumentRow[]> {
  const { data } = await supabase
    .from('documents')
    .select('id, file_name, mime_type, file_size_bytes, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type ?? '',
    sizeLabel: formatFileSize(row.file_size_bytes),
    uploadedAtLabel: formatTimestamp(row.created_at),
  }))
}

export type StudentParentLink = {
  id: string
  status: string
  parentName: string | null
  createdAtLabel: string
}

/**
 * Parent links for one student, read through parent_student_links_safe — the
 * view that drops invite_token and applies the same access rules the raw
 * table's policies would.
 */
export async function fetchParentLinks(
  supabase: Client,
  studentId: string
): Promise<StudentParentLink[]> {
  const { data } = await supabase
    .from('parent_student_links_safe')
    .select('id, status, parent_profile_id, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  const links = data ?? []
  const names = await resolveProfileNames(
    supabase,
    links
      .map((link) => link.parent_profile_id)
      .filter((value): value is string => Boolean(value))
  )

  return links.map((link, index) => ({
    // The view types every column nullable — Postgres does not carry NOT NULL
    // through a view definition — so an id fallback keeps React keys stable.
    id: link.id ?? `row-${index}`,
    status: link.status ?? 'pending',
    parentName: link.parent_profile_id
      ? (names.get(link.parent_profile_id) ?? 'Unnamed parent')
      : null,
    createdAtLabel: link.created_at ? formatTimestamp(link.created_at) : '',
  }))
}

/**
 * Common App planner entries.
 *
 * Takes the working lists so the "based on" labels and dropdowns resolve
 * without extra queries. A source that has since been deleted leaves
 * source_*_id null (ON DELETE SET NULL in migration 020), which surfaces here
 * as an empty sourceName rather than a dangling reference.
 */
export async function fetchCommonAppPlanner(
  supabase: Client,
  studentId: string,
  activities: ActivityRow[],
  honors: HonorRow[]
): Promise<{
  commonAppActivities: CommonAppActivityRow[]
  commonAppHonors: CommonAppHonorRow[]
  activitySources: SourceOption[]
  honorSources: SourceOption[]
}> {
  const [activityResult, honorResult] = await Promise.all([
    supabase
      .from('common_app_activities')
      .select(
        'id, source_activity_id, activity_type, position_title, organization_name, description, participation_grades, participation_timing, hours_per_week, weeks_per_year, continue_in_college'
      )
      .eq('student_id', studentId)
      // Ties broken by title: sort_order has no uniqueness guarantee.
      .order('sort_order', { ascending: true })
      .order('position_title', { ascending: true }),
    supabase
      .from('common_app_honors')
      .select(
        'id, source_honor_id, title, grade_level, level_of_recognition, description'
      )
      .eq('student_id', studentId)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true }),
  ])

  const activityNames = new Map(activities.map((row) => [row.id, row.name]))
  const honorNames = new Map(honors.map((row) => [row.id, row.name]))

  return {
    activitySources: activities.map((row) => ({ id: row.id, name: row.name })),
    honorSources: honors.map((row) => ({ id: row.id, name: row.name })),
    commonAppActivities: (activityResult.data ?? []).map((row) => ({
      id: row.id,
      sourceActivityId: row.source_activity_id ?? '',
      sourceName: row.source_activity_id
        ? (activityNames.get(row.source_activity_id) ?? '')
        : '',
      activityType: row.activity_type ?? '',
      positionTitle: row.position_title ?? '',
      organizationName: row.organization_name ?? '',
      description: row.description ?? '',
      // null and '{}' both mean "nothing selected" to the form.
      participationGrades: row.participation_grades ?? [],
      participationTiming: row.participation_timing ?? [],
      hoursPerWeek: row.hours_per_week,
      weeksPerYear: row.weeks_per_year,
      continueInCollege: row.continue_in_college ?? false,
    })),
    commonAppHonors: (honorResult.data ?? []).map((row) => ({
      id: row.id,
      sourceHonorId: row.source_honor_id ?? '',
      sourceName: row.source_honor_id
        ? (honorNames.get(row.source_honor_id) ?? '')
        : '',
      title: row.title ?? '',
      gradeLevel: row.grade_level ?? [],
      levelOfRecognition: row.level_of_recognition ?? '',
      description: row.description ?? '',
    })),
  }
}

/**
 * The testing section, plus the student's real scores formatted for insertion.
 *
 * common_app_testing is a singleton (migration 021) and holds no row until
 * someone saves, so this reads with maybeSingle() and returns an empty answer
 * rather than null — the form always has something to bind to, and the upsert
 * decides on save whether that becomes an insert or an update.
 *
 * Score labels are built here so the date is formatted server-side and pinned
 * to UTC, like every other date column: test_date is a plain 'YYYY-MM-DD', and
 * formatting it in the browser would shift it a month at a boundary.
 */
export async function fetchCommonAppTesting(
  supabase: Client,
  studentId: string,
  scores: TestScoreRow[]
): Promise<{ testing: CommonAppTestingData; scoreOptions: TestScoreOption[] }> {
  const { data } = await supabase
    .from('common_app_testing')
    .select('test_optional, reported_scores, notes')
    .eq('student_id', studentId)
    .maybeSingle()

  return {
    testing: {
      testOptional: data?.test_optional ?? false,
      reportedScores: data?.reported_scores ?? '',
      notes: data?.notes ?? '',
    },
    scoreOptions: scores.map((score) => {
      // Month and year, not the full date — "SAT: 1450 (March 2026)" is how a
      // score gets referred to. Pinned to UTC like every other date column.
      const when = score.testDate
        ? new Date(`${score.testDate}T00:00:00Z`).toLocaleDateString('en-US', {
            timeZone: 'UTC',
            month: 'long',
            year: 'numeric',
          })
        : ''

      return {
        id: score.id,
        label: `${score.testType}: ${score.score}${when ? ` (${when})` : ''}`,
      }
    }),
  }
}

/**
 * The profile and family sections.
 *
 * common_app_profile is a singleton with no row until someone saves (migration
 * 022), so this reads with maybeSingle() and returns an empty profile rather
 * than null — the form always has something to bind to, and the upsert sorts
 * out insert-versus-update on save.
 */
export async function fetchCommonAppProfileAndFamily(
  supabase: Client,
  studentId: string
): Promise<{ profile: CommonAppProfileData; family: CommonAppFamilyRow[] }> {
  const [profileResult, familyResult] = await Promise.all([
    supabase
      .from('common_app_profile')
      .select(
        'legal_first_name, legal_middle_name, legal_last_name, preferred_first_name, address_line1, address_line2, city, state, postal_code, country, phone, personal_email'
      )
      .eq('student_id', studentId)
      .maybeSingle(),
    supabase
      .from('common_app_family_members')
      .select(
        'id, relationship, full_name, occupation, employer, education_level'
      )
      .eq('student_id', studentId)
      // Ties broken by name: sort_order has no uniqueness guarantee.
      .order('sort_order', { ascending: true })
      .order('full_name', { ascending: true }),
  ])

  const row = profileResult.data

  return {
    profile: {
      legalFirstName: row?.legal_first_name ?? '',
      legalMiddleName: row?.legal_middle_name ?? '',
      legalLastName: row?.legal_last_name ?? '',
      preferredFirstName: row?.preferred_first_name ?? '',
      addressLine1: row?.address_line1 ?? '',
      addressLine2: row?.address_line2 ?? '',
      city: row?.city ?? '',
      state: row?.state ?? '',
      postalCode: row?.postal_code ?? '',
      country: row?.country ?? '',
      phone: row?.phone ?? '',
      personalEmail: row?.personal_email ?? '',
    },
    family: (familyResult.data ?? []).map((member) => ({
      id: member.id,
      relationship: member.relationship ?? '',
      fullName: member.full_name ?? '',
      occupation: member.occupation ?? '',
      employer: member.employer ?? '',
      educationLevel: member.education_level ?? '',
    })),
  }
}
