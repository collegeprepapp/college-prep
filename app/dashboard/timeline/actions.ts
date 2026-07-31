'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  AUDIENCES,
  GRADE_LEVELS,
  SEASONS,
  type Audience,
  type Season,
  type TemplateFormInput,
} from './constants'

export type SaveTemplateResult = { ok: true } | { ok: false; error: string }

type TemplateFields = {
  title: string
  description: string | null
  icon: string | null
  grade_level: number
  season: Season
  audience: Audience
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseTemplateFields(
  input: TemplateFormInput
): { ok: true; fields: TemplateFields } | { ok: false; error: string } {
  const title = input.title.trim()

  if (!title) {
    return { ok: false, error: 'A title is required.' }
  }

  const gradeLevel = Number(input.gradeLevel)

  // Mirrors the check constraint from 007 (grade_level between 6 and 12), so a
  // bad value comes back as a message rather than a Postgres error.
  if (!GRADE_LEVELS.includes(gradeLevel as (typeof GRADE_LEVELS)[number])) {
    return { ok: false, error: 'Grade level must be between 6 and 12.' }
  }

  if (!SEASONS.includes(input.season as Season)) {
    return { ok: false, error: 'Pick a valid season.' }
  }

  if (!AUDIENCES.includes(input.audience as Audience)) {
    return { ok: false, error: 'Pick a valid audience.' }
  }

  return {
    ok: true,
    fields: {
      title,
      description: input.description.trim() || null,
      icon: input.icon.trim() || null,
      grade_level: gradeLevel,
      season: input.season as Season,
      audience: input.audience as Audience,
    },
  }
}

/**
 * All three actions use the session-bound client with no permission check of
 * their own. The policies from migration 007 restrict writes on
 * timeline_templates to school_admin within their own school and system_admin
 * anywhere — an unauthorized caller gets an error or zero affected rows.
 */
export async function createTemplate(
  schoolId: string,
  input: TemplateFormInput
): Promise<SaveTemplateResult> {
  if (!UUID_PATTERN.test(schoolId.trim())) {
    return { ok: false, error: 'A valid school is required.' }
  }

  const parsed = parseTemplateFields(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('timeline_templates')
    .insert({ ...parsed.fields, school_id: schoolId.trim() })

  if (error) {
    console.error('createTemplate: insert failed', error)
    return {
      ok: false,
      error: 'Could not create this template. Check your permissions.',
    }
  }

  revalidatePath('/dashboard/timeline')
  return { ok: true }
}

export async function updateTemplate(
  templateId: string,
  input: TemplateFormInput
): Promise<SaveTemplateResult> {
  if (!UUID_PATTERN.test(templateId.trim())) {
    return { ok: false, error: 'That does not look like a valid template.' }
  }

  const parsed = parseTemplateFields(input)
  if (!parsed.ok) {
    return parsed
  }

  const supabase = await createClient()

  // sort_order and school_id are deliberately not in the form, so they are not
  // in the update either — a partial update leaves them as they are.
  const { data, error } = await supabase
    .from('timeline_templates')
    .update(parsed.fields)
    .eq('id', templateId.trim())
    .select('id')

  if (error) {
    console.error('updateTemplate: update failed', error)
    return { ok: false, error: 'Could not save changes. Please try again.' }
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Could not save changes. You may not have permission to edit this.',
    }
  }

  revalidatePath('/dashboard/timeline')
  return { ok: true }
}

/**
 * Deleting a template does NOT delete tasks already surfaced from it —
 * assigned_tasks.template_id is ON DELETE SET NULL (migration 007), so student
 * progress survives. Those tasks lose their season and fall into the portal's
 * "Anytime" group.
 */
export async function deleteTemplate(
  templateId: string
): Promise<SaveTemplateResult> {
  if (!UUID_PATTERN.test(templateId.trim())) {
    return { ok: false, error: 'That does not look like a valid template.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('timeline_templates')
    .delete()
    .eq('id', templateId.trim())
    .select('id')

  if (error) {
    console.error('deleteTemplate: delete failed', error)
    return { ok: false, error: 'Could not delete this template.' }
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Could not delete. You may not have permission to remove this.',
    }
  }

  revalidatePath('/dashboard/timeline')
  return { ok: true }
}
