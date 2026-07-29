import Link from 'next/link'
import { getViewer, isAdminRole } from '../access'
import { InviteParentForm } from './invite-parent-form'

// Note: every column on parent_student_links_safe is typed nullable. Postgres
// does not carry NOT NULL through a view definition, so the generator cannot
// know better. The values are non-null in practice, but the render path below
// handles null anyway.

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide opacity-60">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
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

  return (
    <Shell isAdmin={isAdmin}>
      <div>
        <h2 className="text-lg font-medium">
          {student.first_name} {student.last_name}
        </h2>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Graduation Year" value={student.graduation_year} />
        <Field label="GPA" value={student.gpa ?? '—'} />
        <Field label="Class Rank" value={student.class_rank ?? '—'} />
        <Field label="Email" value={student.email ?? '—'} />
      </dl>

      <section>
        <h3 className="text-base font-medium">Test Scores</h3>
        {testScores.length === 0 ? (
          <p className="mt-2 text-sm opacity-70">No test scores recorded.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
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
        )}
      </section>

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
                    {link.parent_profile_id
                      ? (parentNames.get(link.parent_profile_id) ??
                        'Unknown parent')
                      : 'Unknown parent'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <InviteParentForm studentId={student.id} />
    </Shell>
  )
}
