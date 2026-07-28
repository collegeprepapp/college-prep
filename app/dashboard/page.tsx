import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    </main>
  )
}
