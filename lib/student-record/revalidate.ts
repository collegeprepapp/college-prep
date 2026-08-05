import { revalidatePath } from 'next/cache'

/**
 * Invalidates every route that renders a student's record.
 *
 * The student-record tabs are shared by the admin detail page and the student
 * portal, so an action fired from one must not leave the other stale. Before
 * the tabs moved to components/student-tabs/, each action revalidated only
 * `/dashboard/students/<id>` — which was correct while the admin page was the
 * sole caller and silently wrong the moment the portal rendered the same
 * component.
 *
 * The portal entry uses 'layout' so the whole /portal/<id> subtree — overview,
 * timeline, and whatever comes next — is covered by one call.
 *
 * This is cache invalidation, not authorization. Who may see what is decided by
 * RLS on every request; revalidating a path a given viewer cannot read simply
 * has no effect for them.
 */
export function revalidateStudentRecord(studentId: string) {
  const id = studentId.trim()

  if (!id) {
    return
  }

  revalidatePath(`/dashboard/students/${id}`)
  revalidatePath(`/portal/${id}`, 'layout')
}
