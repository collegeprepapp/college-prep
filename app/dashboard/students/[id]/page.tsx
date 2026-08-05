import { requireAdmin } from '../../access'
import {
  fetchActivities,
  fetchApplications,
  fetchDocuments,
  fetchEssays,
  fetchHonors,
  fetchNotes,
  fetchParentLinks,
  fetchScholarships,
  fetchTestScores,
  fetchCommonAppPlanner,
  fetchCommonAppTesting,
  fetchCommonAppProfileAndFamily,
} from '@/lib/student-record/queries'
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

  // Every one of these lives in lib/student-record/queries.ts so the portal
  // renders the same rows from the same code. RLS scopes them to this viewer.
  const [
    testScores,
    parentLinks,
    notes,
    applications,
    scholarships,
    activities,
    honors,
    documents,
  ] = await Promise.all([
    fetchTestScores(supabase, id),
    fetchParentLinks(supabase, id),
    fetchNotes(supabase, id),
    fetchApplications(supabase, id),
    fetchScholarships(supabase, id),
    fetchActivities(supabase, id),
    fetchHonors(supabase, id),
    fetchDocuments(supabase, id),
  ])

  // Essays need the college list for their school dropdown, so they follow it.
  const { essays, essaySchools } = await fetchEssays(supabase, id, applications)

  // Needs the working lists for its "based on" labels, so it follows them.
  const {
    commonAppActivities,
    commonAppHonors,
    activitySources,
    honorSources,
  } = await fetchCommonAppPlanner(supabase, id, activities, honors)

  // Uses the already-fetched scores to build the insertable labels.
  const { testing, scoreOptions } = await fetchCommonAppTesting(
    supabase,
    id,
    testScores
  )

  const { profile: commonAppProfile, family: commonAppFamily } =
    await fetchCommonAppProfileAndFamily(supabase, id)

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
        parentLinks={parentLinks}
        notes={notes}
        applications={applications}
        scholarships={scholarships}
        essays={essays}
        essaySchools={essaySchools}
        activities={activities}
        honors={honors}
        documents={documents}
        commonAppActivities={commonAppActivities}
        commonAppHonors={commonAppHonors}
        activitySources={activitySources}
        honorSources={honorSources}
        commonAppTesting={testing}
        testScoreOptions={scoreOptions}
        commonAppProfile={commonAppProfile}
        commonAppFamily={commonAppFamily}
        studentId={student.id}
        viewerProfileId={userId}
        // Everyone who reaches this page is an admin.
        canEdit
      />
    </Shell>
  )
}
