import 'server-only'

import type { Database } from '@/lib/supabase/database.types'
import { createServiceClient } from '@/lib/supabase/service'

type TimelineTemplateRow =
  Database['public']['Tables']['timeline_templates']['Row']

const UNIQUE_VIOLATION = '23505'

/**
 * Materializes timeline_templates into assigned_tasks for one student.
 *
 * SERVICE ROLE, deliberately. Migration 007 grants insert on assigned_tasks to
 * admins only, and this runs while a student or parent is viewing their own
 * timeline — their session client would be refused by RLS. Nothing here comes
 * from user input: studentId was already authorized by the [studentId] layout,
 * and every field is copied from a template row that was read through the
 * viewer's own RLS-scoped query. Callers must not pass templates from a school
 * the viewer cannot see.
 *
 * Not idempotent through ON CONFLICT: PostgREST's `onConflict` emits
 * `ON CONFLICT (student_id, template_id)` with no WHERE clause, and Postgres
 * refuses to infer a PARTIAL unique index from that (verified: 42P10, "there is
 * no unique or exclusion constraint matching the ON CONFLICT specification").
 * So duplicates are handled by catching the unique violation instead.
 */
export async function surfaceTemplatesForStudent(
  studentId: string,
  templates: TimelineTemplateRow[]
): Promise<void> {
  if (templates.length === 0) {
    return
  }

  const service = createServiceClient()

  const rows = templates.map((template) => ({
    student_id: studentId,
    template_id: template.id,
    title: template.title,
    description: template.description,
    icon: template.icon,
    // Copied from the template — a task that defaulted to 'student' would be
    // uncompletable by the parent it was written for (see migration 008).
    audience: template.audience,
    // Null marks this as auto-surfaced rather than hand-assigned.
    assigned_by: null,
  }))

  const { error } = await service.from('assigned_tasks').insert(rows)

  if (!error) {
    return
  }

  if (error.code !== UNIQUE_VIOLATION) {
    console.error('surfaceTemplatesForStudent: batch insert failed', error)
    return
  }

  // A concurrent request surfaced at least one of these first. The batch is a
  // single statement, so one conflict rolls back all of it — retry row by row
  // so the rows that are genuinely new still land.
  for (const row of rows) {
    const { error: rowError } = await service.from('assigned_tasks').insert(row)

    if (rowError && rowError.code !== UNIQUE_VIOLATION) {
      console.error('surfaceTemplatesForStudent: row insert failed', rowError)
    }
  }
}
