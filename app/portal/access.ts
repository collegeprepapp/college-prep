import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PortalStudent = {
  id: string
  first_name: string
  last_name: string
}

export type PortalViewer = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  role: 'student' | 'parent'
  /**
   * Every student this viewer may look at, sorted by name. A student has
   * exactly one; a parent has one row per accepted link. Never empty — callers
   * that would end up with none are redirected away instead.
   */
  students: PortalStudent[]
}

function sortByName(students: PortalStudent[]): PortalStudent[] {
  return [...students].sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name)
  )
}

/**
 * Resolves which students the current viewer may see in the portal.
 *
 * The portal is for students and linked parents only. Admins have the
 * /dashboard side of the app, so they are sent back there rather than being
 * given a second, weaker view of the same data.
 *
 * This is the real access boundary for the portal, alongside RLS: every id in
 * `students` came from a query the database already scoped to this viewer.
 *
 * Wrapped in React's cache(), so the portal layout, the [studentId] layout, and
 * the page all share one result per request instead of re-running the queries.
 * The memo lives for a single request only — it never leaks between users.
 */
export const getPortalViewer = cache(async (): Promise<PortalViewer> => {
  const access = await getPortalAccess()

  if (access.kind !== 'portal') {
    redirect('/dashboard')
  }

  return {
    supabase: access.supabase,
    userId: access.userId,
    role: access.role,
    students: access.students,
  }
})

export type PortalAccess =
  // Portal role with at least one visible student.
  | {
      kind: 'portal'
      supabase: Awaited<ReturnType<typeof createClient>>
      userId: string
      role: 'student' | 'parent'
      students: PortalStudent[]
    }
  // Portal role, but nothing to look at: a student profile with no CRM record,
  // or a parent whose invites are all still pending.
  | { kind: 'empty'; role: 'student' | 'parent' }
  // Admins, unrecognized roles, and profiles with no role at all.
  | { kind: 'ineligible' }

/**
 * The same resolution as getPortalViewer, minus the redirect on failure.
 *
 * Callers outside the portal need this: /dashboard sends students and parents
 * to /portal, and getPortalViewer sends portal-less viewers back to /dashboard.
 * If the dashboard could not tell "has a portal" from "has none", those two
 * rules would bounce an empty student or parent between the routes forever.
 * Reporting the 'empty' case instead of redirecting is what breaks that cycle.
 *
 * Still redirects anonymous visitors to /login — there is no cycle there.
 */
export const getPortalAccess = cache(async (): Promise<PortalAccess> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role

  if (role === 'student') {
    // RLS lets a student read only their own record, so this is at most one row.
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('profile_id', user.id)

    if (!students || students.length === 0) {
      return { kind: 'empty', role: 'student' }
    }

    return {
      kind: 'portal',
      supabase,
      userId: user.id,
      role: 'student',
      students: sortByName(students),
    }
  }

  if (role === 'parent') {
    const { data: links } = await supabase
      .from('parent_student_links_safe')
      .select('student_id')
      .eq('parent_profile_id', user.id)
      .eq('status', 'accepted')

    const studentIds = (links ?? [])
      .map((link) => link.student_id)
      .filter((value): value is string => Boolean(value))

    if (studentIds.length === 0) {
      return { kind: 'empty', role: 'parent' }
    }

    // is_linked_parent_of() in the students policies is what actually authorizes
    // this read; the id list only narrows it.
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .in('id', studentIds)

    if (!students || students.length === 0) {
      return { kind: 'empty', role: 'parent' }
    }

    return {
      kind: 'portal',
      supabase,
      userId: user.id,
      role: 'parent',
      students: sortByName(students),
    }
  }

  return { kind: 'ineligible' }
})
