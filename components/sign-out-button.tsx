'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_CLASS =
  'rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20'

/**
 * Shared by the admin nav and the portal sidebar. Signing out is identical for
 * every role — clear the session, then land on /login — so only the styling
 * differs between the two placements.
 */
export function SignOutButton({ className }: { className?: string } = {}) {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)

    const supabase = createClient()
    await supabase.auth.signOut()

    router.refresh()
    router.push('/login')
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className={className ?? DEFAULT_CLASS}
    >
      {isSigningOut ? 'Signing out…' : 'Sign Out'}
    </button>
  )
}
