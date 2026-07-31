import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'system_admin' | 'school_admin' | 'student' | 'parent'

const ROLES: readonly Role[] = [
  'system_admin',
  'school_admin',
  'student',
  'parent',
]

/**
 * profiles.role is plain `text` in the schema (a check constraint keeps it
 * honest), so the generated types give us `string`. Narrow it here rather than
 * casting: anything unrecognized becomes null, which every caller treats as no
 * access. Fail closed.
 */
function toRole(value: string | null | undefined): Role | null {
  return ROLES.includes(value as Role) ? (value as Role) : null
}

export type Viewer = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  role: Role | null
  // Null for system_admin, which is global rather than scoped to one school
  // (see the check constraint in migration 002).
  schoolId: string | null
}

/**
 * Resolves who is looking at the page. Anonymous visitors go to /login;
 * everyone else is returned with their role for the caller to judge.
 *
 * These are UI gates, not the security boundary — the RLS policies from 002/003
 * are what actually scope the data. The returned client is session-bound so
 * callers keep that scoping instead of reaching for the service role.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .maybeSingle()

  return {
    supabase,
    userId: user.id,
    role: toRole(profile?.role),
    schoolId: profile?.school_id ?? null,
  }
})

export function isAdminRole(role: Role | null): boolean {
  return role === 'system_admin' || role === 'school_admin'
}

/** Admin-only pages: non-admins are bounced back to the dashboard. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer()

  if (!isAdminRole(viewer.role)) {
    redirect('/dashboard')
  }

  return viewer
}
