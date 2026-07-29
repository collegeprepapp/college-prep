import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
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

  // Students and parents go straight to the portal rather than bouncing through
  // /dashboard. A portal role with nothing to view is sent back to /dashboard by
  // the portal itself, which shows them a notice — one hop, no loop.
  const isPortalRole = profile?.role === 'student' || profile?.role === 'parent'

  redirect(isPortalRole ? '/portal' : '/dashboard')
}
