'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type StudentListRow = {
  id: string
  first_name: string
  last_name: string
  graduation_year: number
  gpa: number | null
}

export function StudentTable({ students }: { students: StudentListRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  /**
   * Row click is a mouse convenience layered on top of a real link, not a
   * replacement for it. The anchor in the name cell stays in the tab order and
   * activates with Enter, so keyboard and screen-reader users are unaffected —
   * and middle-click / cmd-click still open a new tab through the anchor.
   */
  function handleRowClick(
    event: React.MouseEvent<HTMLTableRowElement>,
    studentId: string
  ) {
    // The anchor already handles its own activation; without this the row would
    // navigate a second time.
    if ((event.target as HTMLElement).closest('a')) {
      return
    }

    // Leave modified clicks alone rather than hijacking new-tab intent.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    router.push(`/dashboard/students/${studentId}`)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()

    if (!needle) {
      return students
    }

    return students.filter((student) => {
      const first = student.first_name.toLowerCase()
      const last = student.last_name.toLowerCase()

      // "first last" and "last first" both match, so typing either order works.
      return (
        first.includes(needle) ||
        last.includes(needle) ||
        `${first} ${last}`.includes(needle) ||
        `${last} ${first}`.includes(needle)
      )
    })
  }, [students, query])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search students…"
          aria-label="Search students by name"
          className="w-full max-w-xs rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />

        {query.trim() && (
          <span className="text-xs opacity-60">
            {filtered.length} of {students.length}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm opacity-70">
          No students match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/15 text-left dark:border-white/20">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Grad Year</th>
                <th className="py-2 pr-4 font-medium">GPA</th>
              </tr>
            </thead>
            <tbody>
              {/* even:/odd: follow rendered position, so the banding stays
                  alternating as rows are filtered out. */}
              {filtered.map((student) => (
                <tr
                  key={student.id}
                  onClick={(event) => handleRowClick(event, student.id)}
                  // focus-within mirrors the hover tint when the row's link is
                  // focused by keyboard, so tabbing shows the same row emphasis.
                  className="cursor-pointer border-b border-black/5 transition-colors even:bg-black/[0.02] hover:bg-black/[0.05] focus-within:bg-black/[0.05] dark:border-white/10 dark:even:bg-white/[0.03] dark:hover:bg-white/[0.07] dark:focus-within:bg-white/[0.07]"
                >
                  <td className="py-2 pr-4">
                    <Link
                      href={`/dashboard/students/${student.id}`}
                      // No outline-none here: the focus ring is the primary
                      // keyboard cue, and the row tint only reinforces it.
                      className="font-medium no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {student.first_name} {student.last_name}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{student.graduation_year}</td>
                  <td className="py-2 pr-4">{student.gpa ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
