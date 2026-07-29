import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPortalAccess } from '../portal/access'
import { SignOutButton } from './sign-out-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // proxy.ts already redirects anonymous users, but a server-side check is the
  // real authorization boundary — the proxy is only an optimistic pre-filter.
  if (!user) {
    redirect('/login')
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('first_name, role')
    .eq('id', user.id)
    .single()

  // The dashboard is the admin side of the app. Students and parents belong in
  // /portal — but only if they actually have something to view there, since the
  // portal bounces empty viewers back here. Checking first avoids a redirect
  // loop; the 'empty' case falls through to the notice below.
  if (profile?.role === 'student' || profile?.role === 'parent') {
    const access = await getPortalAccess()

    if (access.kind === 'portal') {
      redirect('/portal')
    }

    return (
      <main className="flex flex-1 flex-col gap-6 p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome, {profile.first_name ?? user.email}
            </h1>
            <p className="mt-1 text-sm opacity-70">
              {profile.role === 'parent'
                ? 'No students are linked to your account yet. Your school will send an invite when a record is ready.'
                : 'Your student record is not set up yet. Your school will finish this shortly.'}
            </p>
          </div>
          <SignOutButton />
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {profile?.first_name ?? user.email}
          </h1>
          <p className="mt-1 text-sm opacity-70">
            Role: {profile?.role ?? 'unknown'}
          </p>
        </div>
        <SignOutButton />
      </div>

      {error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Could not load profile: {error.message}
        </p>
      )}

      <Link
        href="/dashboard/students"
        className="self-start rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70 dark:border-white/20"
      >
        View Students
      </Link>
    </main>
  )
}
