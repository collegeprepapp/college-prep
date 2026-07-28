'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
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
      className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20"
    >
      {isSigningOut ? 'Signing out…' : 'Sign Out'}
    </button>
  )
}
