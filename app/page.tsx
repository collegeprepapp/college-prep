import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getSession()

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>College Prep — Supabase Connection Test</h1>
      {error ? (
        <p style={{ color: 'red' }}>Error: {error.message}</p>
      ) : (
        <p style={{ color: 'green' }}>
          ✅ Successfully connected to Supabase! (No active session, which is expected — you have not logged in yet.)
        </p>
      )}
    </div>
  )
}
