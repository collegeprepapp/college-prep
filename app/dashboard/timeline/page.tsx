import Link from 'next/link'
import { requireAdmin } from '../access'
import { AddTemplateForm } from './add-template-form'
import { SEASONS } from './constants'
import { TemplateRow, type TemplateRowData } from './template-row'

export default async function TimelineTemplatesPage() {
  const { supabase, schoolId } = await requireAdmin()

  // No school filter here on purpose: the select policy from 007 already scopes
  // school_admin to their own school and lets system_admin see every school.
  const { data: templateRows, error } = await supabase
    .from('timeline_templates')
    .select('id, icon, title, description, grade_level, season, audience')
    .order('grade_level', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  const templates = templateRows ?? []

  // Grade ascending, then season in school-year order rather than alphabetical.
  const grades = [...new Set(templates.map((t) => t.grade_level))].sort(
    (a, b) => a - b
  )

  // Widened to string on purpose: season is plain text in the schema (a check
  // constraint keeps it honest), so a row could hold a value outside SEASONS.
  const knownSeasons = new Set<string>(SEASONS)

  const byGrade = grades.map((grade) => ({
    grade,
    seasons: [...SEASONS]
      .map((season) => ({
        season,
        templates: templates.filter(
          (template) =>
            template.grade_level === grade && template.season === season
        ),
      }))
      .filter((group) => group.templates.length > 0),
    // Any season value outside the four known ones would otherwise vanish.
    unknownSeason: templates.filter(
      (template) =>
        template.grade_level === grade && !knownSeasons.has(template.season)
    ),
  }))

  function toRowData(template: (typeof templates)[number]): TemplateRowData {
    return {
      id: template.id,
      icon: template.icon,
      title: template.title,
      description: template.description,
      gradeLevel: template.grade_level,
      season: template.season,
      audience: template.audience,
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">College Prep</h1>
        <Link
          href="/dashboard"
          className="mt-1 inline-block text-sm underline opacity-70 hover:opacity-100"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-medium">Timeline Templates</h2>
        <p className="mt-1 text-sm opacity-70">
          Steps here appear on a student&apos;s timeline once they reach the
          matching grade.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Could not load templates: {error.message}
        </p>
      )}

      <AddTemplateForm schoolId={schoolId} />

      {!error && templates.length === 0 && (
        <p className="text-sm opacity-70">No templates yet.</p>
      )}

      {byGrade.map(({ grade, seasons, unknownSeason }) => (
        <section key={grade} className="flex flex-col gap-4">
          <h3 className="border-b border-black/10 pb-1 text-base font-medium dark:border-white/15">
            Grade {grade}
          </h3>

          {seasons.map((group) => (
            <div key={group.season} className="flex flex-col gap-2">
              <h4 className="text-sm font-medium opacity-70">{group.season}</h4>
              <ul className="flex flex-col gap-2">
                {group.templates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={toRowData(template)}
                  />
                ))}
              </ul>
            </div>
          ))}

          {unknownSeason.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium opacity-70">Other</h4>
              <ul className="flex flex-col gap-2">
                {unknownSeason.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={toRowData(template)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </main>
  )
}
