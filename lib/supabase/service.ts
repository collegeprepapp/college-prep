// SERVER ONLY. This client uses SUPABASE_SECRET_KEY (the service role key),
// which bypasses Row Level Security entirely. Never import this from a client
// component, and never return its raw query results to the browser without
// filtering them first.
//
// The `server-only` import below turns an accidental client import into a build
// error rather than a leaked key.
import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variable.'
    )
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      // No cookie/session handling: this client is never acting as a user.
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
