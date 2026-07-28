import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'system_admin' | 'school_admin' | 'student' | 'parent'

export type Viewer = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  role: Role | null
}

/**
 * Resolves who is looking at the page. Anonymous visitors go to /login;
 * everyone else is returned with their role for the caller to judge.
 *
 * These are UI gates, not the security boundary — the RLS policies from 002/003
 * are what actually scope the data. The returned client is session-bound so
 * callers keep that scoping instead of reaching for the service role.
 */
export async function getViewer(): Promise<Viewer> {
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

  return { supabase, userId: user.id, role: profile?.role ?? null }
}

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
