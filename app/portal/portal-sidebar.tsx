'use client'

import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'
import type { PortalStudent } from './access'

// Only College Timeline has a page behind it so far. The rest render as inert
// text so the shape of the portal is visible without pretending to navigate.
const PLACEHOLDER_LINKS = [
  'My Schools',
  'My Essays',
  'My Activities',
  'Settings',
]

/**
 * Client-side because the active studentId lives in a route segment BELOW this
 * layout — app/portal/layout.tsx never receives it in `params`. useParams reads
 * it from the URL instead.
 */
export function PortalSidebar({ students }: { students: PortalStudent[] }) {
  const router = useRouter()
  const params = useParams<{ studentId?: string }>()
  const pathname = usePathname()

  // On the bare /portal route there is no id yet; fall back to the first
  // student so the nav still points somewhere real while the redirect runs.
  const activeStudentId =
    typeof params.studentId === 'string' ? params.studentId : students[0]?.id

  // Keep the current section when switching students: /portal/<id>/<section>.
  const section = pathname.split('/')[3] || 'timeline'

  function switchStudent(studentId: string) {
    router.push(`/portal/${studentId}/${section}`)
  }

  const timelineHref = activeStudentId
    ? `/portal/${activeStudentId}/timeline`
    : '/portal'

  const isTimelineActive = pathname.endsWith('/timeline')

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-black/10 p-6 dark:border-white/15">
      <div>
        <Link href="/portal" className="text-lg font-semibold tracking-tight">
          College Prep
        </Link>
      </div>

      {students.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="student-switcher" className="text-xs font-medium">
            Viewing
          </label>
          <select
            id="student-switcher"
            value={activeStudentId ?? ''}
            onChange={(event) => switchStudent(event.target.value)}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.first_name} {student.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex flex-col gap-1">
        <Link
          href={timelineHref}
          className={
            isTimelineActive
              ? 'rounded-md bg-black/5 px-3 py-2 text-sm font-medium dark:bg-white/10'
              : 'rounded-md px-3 py-2 text-sm opacity-70 transition-opacity hover:opacity-100'
          }
        >
          College Timeline
        </Link>

        {PLACEHOLDER_LINKS.map((label) => (
          <span
            key={label}
            aria-disabled="true"
            title="Coming soon"
            className="cursor-default rounded-md px-3 py-2 text-sm opacity-40"
          >
            {label}
          </span>
        ))}
      </nav>

      {/* mt-auto pins this to the bottom of the sidebar, below the nav. */}
      <div className="mt-auto">
        <SignOutButton className="w-full rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20" />
      </div>
    </aside>
  )
}
