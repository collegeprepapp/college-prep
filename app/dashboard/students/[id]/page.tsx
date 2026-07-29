import Link from 'next/link'
import { getViewer, isAdminRole } from '../access'
import {
  StudentDetailTabs,
  type ParentLinkRow,
} from './student-detail-tabs'

// Note: every column on parent_student_links_safe is typed nullable. Postgres
// does not carry NOT NULL through a view definition, so the generator cannot
// know better. The values are non-null in practice, but the render path handles
// null anyway.

// The student list is admin-only, so a student viewing their own record gets
// sent back to the dashboard instead.
function Shell({
  isAdmin,
  children,
}: {
  isAdmin: boolean
  children: React.ReactNode
}) {
  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">College Prep</h1>
        <Link
          href={isAdmin ? '/dashboard/students' : '/dashboard'}
          className="mt-1 inline-block text-sm underline opacity-70 hover:opacity-100"
        >
          {isAdmin ? '← Back to students' : '← Back to dashboard'}
        </Link>
      </div>
      {children}
    </main>
  )
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, userId, role } = await getViewer()
  const isAdmin = isAdminRole(role)

  // An admin from another school gets zero rows back from RLS rather than an
  // error, which is indistinguishable from a bad id — both land on "not found".
  const { data: student } = await supabase
    .from('students')
    .select(
      'id, first_name, last_name, graduation_year, gpa, class_rank, email, profile_id'
    )
    .eq('id', id)
    .maybeSingle()

  // Admins see any student their RLS scope allows; a student sees only the
  // record linked to their own profile. Everyone else — parents included, even
  // though RLS would let a linked parent read the row — gets the same message,
  // so a refusal never reveals whether the student exists.
  const isOwnRecord = role === 'student' && student?.profile_id === userId

  if (!student || (!isAdmin && !isOwnRecord)) {
    return (
      <Shell isAdmin={isAdmin}>
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
    <Shell isAdmin={isAdmin}>
      <h2 className="text-lg font-medium">
        {student.first_name} {student.last_name}
      </h2>

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
      />
    </Shell>
  )
}
