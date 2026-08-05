import Link from 'next/link'
import { requireAdmin } from '../access'
import { ParentLinkActions } from './parent-link-actions'

type ParentLink = {
  id: string
  studentId: string | null
  studentName: string | null
  status: string
  createdAt: string | null
  invitedByName: string | null
}

type ParentGroup = {
  key: string
  parentName: string | null
  links: ParentLink[]
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fullName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ')
  return name || null
}

// Three states since migration 018. Anything unrecognised falls through to the
// neutral tone showing its raw value, rather than being mislabelled "Pending".
const STATUS_TONE: Record<string, string> = {
  accepted:
    'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  pending:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  revoked: 'border-red-600/25 bg-red-600/5 text-red-700/80 dark:text-red-400/80',
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  pending: 'Pending',
  revoked: 'Revoked',
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    STATUS_TONE[status] ??
    'border-black/15 bg-black/5 dark:border-white/20 dark:bg-white/10'

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default async function ParentsPage() {
  const { supabase } = await requireAdmin()

  // No school filter here on purpose. parent_student_links_safe reproduces the
  // same scoping in its own WHERE clause (migration 005): a school_admin sees
  // only links for students in their school, a system_admin sees every school.
  const { data: linkRows, error } = await supabase
    .from('parent_student_links_safe')
    .select('id, student_id, parent_profile_id, invited_by, status, created_at')
    .order('created_at', { ascending: false })

  const links = linkRows ?? []

  const studentIds = [
    ...new Set(
      links
        .map((link) => link.student_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]

  // The parent and the inviting admin are both profiles rows, so one lookup
  // covers them.
  const profileIds = [
    ...new Set(
      [
        ...links.map((link) => link.parent_profile_id),
        ...links.map((link) => link.invited_by),
      ].filter((value): value is string => Boolean(value))
    ),
  ]

  const studentNames = new Map<string, string>()
  const profileNames = new Map<string, string>()

  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .in('id', studentIds)

    for (const student of students ?? []) {
      studentNames.set(
        student.id,
        fullName(student.first_name, student.last_name) ?? 'Unnamed student'
      )
    }
  }

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', profileIds)

    for (const profile of profiles ?? []) {
      profileNames.set(
        profile.id,
        fullName(profile.first_name, profile.last_name) ?? 'Unnamed'
      )
    }
  }

  // Accepted links group under the parent they belong to. Pending links cannot:
  // parent_profile_id stays null until acceptance, so there is no identity to
  // group them by — each one stands alone.
  const groupsByParent = new Map<string, ParentGroup>()
  const ungrouped: ParentGroup[] = []

  for (const [index, link] of links.entries()) {
    const entry: ParentLink = {
      id: link.id ?? `row-${index}`,
      studentId: link.student_id,
      studentName: link.student_id
        ? (studentNames.get(link.student_id) ?? 'Unknown student')
        : null,
      status: link.status ?? 'pending',
      createdAt: link.created_at,
      invitedByName: link.invited_by
        ? (profileNames.get(link.invited_by) ?? null)
        : null,
    }

    if (!link.parent_profile_id) {
      ungrouped.push({ key: entry.id, parentName: null, links: [entry] })
      continue
    }

    const existing = groupsByParent.get(link.parent_profile_id)

    if (existing) {
      existing.links.push(entry)
    } else {
      groupsByParent.set(link.parent_profile_id, {
        key: link.parent_profile_id,
        parentName: profileNames.get(link.parent_profile_id) ?? 'Unnamed parent',
        links: [entry],
      })
    }
  }

  // Named parents first, alphabetically; not-yet-accepted invites after them.
  const groups = [
    ...[...groupsByParent.values()].sort((a, b) =>
      (a.parentName ?? '').localeCompare(b.parentName ?? '')
    ),
    ...ungrouped,
  ]

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Parents</h1>

      {error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Could not load parent invites: {error.message}
        </p>
      )}

      {!error && groups.length === 0 && (
        <p className="text-sm opacity-70">No parent invites yet.</p>
      )}

      {groups.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                <th className="py-2 pr-4 font-medium">Parent</th>
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Invited</th>
                <th className="py-2 pr-4 font-medium">Invited By</th>
                <th className="py-2 pr-4 font-medium" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                group.links.map((link, indexInGroup) => (
                  <tr
                    key={link.id}
                    className={
                      // Border only above the first row of a group, so one
                      // parent's several students read as a single block.
                      indexInGroup === 0
                        ? 'border-t border-black/10 dark:border-white/15'
                        : ''
                    }
                  >
                    <td className="py-2 pr-4 align-top">
                      {indexInGroup > 0 ? (
                        // Repeating the name on every row would read as
                        // separate parents; screen readers still get it.
                        <span className="sr-only">{group.parentName}</span>
                      ) : group.parentName ? (
                        <span className="font-medium">{group.parentName}</span>
                      ) : (
                        <span className="opacity-60">
                          Pending — not yet accepted
                        </span>
                      )}
                    </td>

                    <td className="py-2 pr-4 align-top">
                      {link.studentId && link.studentName ? (
                        <Link
                          href={`/dashboard/students/${link.studentId}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {link.studentName}
                        </Link>
                      ) : (
                        <span className="opacity-60">Unknown student</span>
                      )}
                    </td>

                    <td className="py-2 pr-4 align-top">
                      <StatusBadge status={link.status} />
                    </td>

                    <td className="py-2 pr-4 align-top">
                      {formatDate(link.createdAt)}
                    </td>

                    <td className="py-2 pr-4 align-top opacity-70">
                      {link.invitedByName ?? '—'}
                    </td>

                    <td className="py-2 pr-4 align-top">
                      <ParentLinkActions
                        linkId={link.id}
                        status={link.status}
                        parentName={group.parentName}
                        studentName={link.studentName ?? 'this student'}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
