import { createServiceClient } from '@/lib/supabase/service'
import { SignupForm } from './signup-form'

// One generic message for every failure mode — missing token, already accepted,
// or a student/school row that will not load. A stranger with a guessed token
// should not be able to tell the difference.
function InvalidInvite() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-center text-sm opacity-70">
        This invite link is no longer valid.
      </p>
    </main>
  )
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // parent_student_links has no RLS policies, and this visitor is anonymous, so
  // the lookup has to go through the service-role client. Nothing from the raw
  // row — the token least of all — is rendered below.
  const service = createServiceClient()

  const { data: link, error: linkError } = await service
    .from('parent_student_links')
    .select('id, student_id, status')
    .eq('invite_token', token)
    .maybeSingle()

  if (linkError || !link || link.status !== 'pending') {
    return <InvalidInvite />
  }

  const { data: student, error: studentError } = await service
    .from('students')
    .select('first_name, last_name, school_id')
    .eq('id', link.student_id)
    .maybeSingle()

  if (studentError || !student) {
    return <InvalidInvite />
  }

  const { data: school } = await service
    .from('schools')
    .select('name')
    .eq('id', student.school_id)
    .maybeSingle()

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-semibold tracking-tight">
          College Prep
        </h1>
        <p className="mt-4 text-center text-sm">
          You&apos;ve been invited to view {student.first_name}{' '}
          {student.last_name}&apos;s record
          {school?.name ? ` at ${school.name}` : ''}.
        </p>
        <p className="mt-2 text-center text-sm opacity-70">
          Create an account to continue.
        </p>

        <SignupForm token={token} studentFirstName={student.first_name} />
      </div>
    </main>
  )
}
