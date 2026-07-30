import type { Database } from '@/lib/supabase/database.types'
import { getCurrentGradeLevel } from '@/lib/timeline/grade'
import { surfaceTemplatesForStudent } from '@/lib/timeline/surface'
import { getPortalViewer } from '../../access'
import { TaskCheckbox } from './task-checkbox'

type AssignedTaskRow = Database['public']['Tables']['assigned_tasks']['Row']

type GroupedTask = AssignedTaskRow & { season: string; sortOrder: number }

const SEASONS = ['Fall', 'Winter', 'Spring', 'Summer'] as const

/** Tasks whose template is gone, or that were assigned by hand, have no season. */
const UNSCHEDULED = 'Anytime' as const

/**
 * Whether this viewer may check the task off. Mirrors the trigger from
 * migration 008 — the database is what actually enforces it; this only decides
 * whether the checkbox is interactive.
 */
function canToggleAudience(
  role: 'student' | 'parent',
  audience: string
): boolean {
  return role === 'student'
    ? audience === 'student' || audience === 'both'
    : audience === 'parent' || audience === 'both'
}

export default async function PortalTimelinePage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  // The [studentId] layout already verified this id belongs to the viewer.
  const { supabase, role } = await getPortalViewer()

  const { data: student } = await supabase
    .from('students')
    .select('first_name, last_name, graduation_year, school_id')
    .eq('id', studentId)
    .maybeSingle()

  if (!student) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Timeline</h1>
        <p className="text-sm opacity-70">This record is not available.</p>
      </div>
    )
  }

  const gradeLevel = getCurrentGradeLevel(student.graduation_year)

  // Every template for the school, not just the current grade: tasks surfaced in
  // earlier years still need their season for grouping below.
  const { data: templateRows } = await supabase
    .from('timeline_templates')
    .select('*')
    .eq('school_id', student.school_id)

  const templates = templateRows ?? []

  const { data: existingRows } = await supabase
    .from('assigned_tasks')
    .select('*')
    .eq('student_id', studentId)

  const alreadySurfaced = new Set(
    (existingRows ?? [])
      .map((task) => task.template_id)
      .filter((value): value is string => Boolean(value))
  )

  const missing = templates.filter(
    (template) =>
      template.grade_level === gradeLevel && !alreadySurfaced.has(template.id)
  )

  // Lazy surfacing, per the model documented in migration 007: templates become
  // real tasks the first time someone opens the timeline.
  await surfaceTemplatesForStudent(studentId, missing)

  let tasks = existingRows ?? []

  if (missing.length > 0) {
    const { data: refreshed } = await supabase
      .from('assigned_tasks')
      .select('*')
      .eq('student_id', studentId)

    tasks = refreshed ?? tasks
  }

  // Season lives on the template, not on the task, so it has to be looked up.
  const seasonByTemplate = new Map(
    templates.map((template) => [
      template.id,
      { season: template.season, sortOrder: template.sort_order },
    ])
  )

  const grouped: GroupedTask[] = tasks.map((task) => {
    const fromTemplate = task.template_id
      ? seasonByTemplate.get(task.template_id)
      : undefined

    return {
      ...task,
      season: fromTemplate?.season ?? UNSCHEDULED,
      sortOrder: fromTemplate?.sortOrder ?? 0,
    }
  })

  const sections = [...SEASONS, UNSCHEDULED]
    .map((season) => ({
      season,
      tasks: grouped
        .filter((task) => task.season === season)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
        ),
    }))
    .filter((section) => section.tasks.length > 0)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          College Timeline
        </h1>
        <p className="mt-1 text-sm opacity-70">
          {student.first_name} {student.last_name} · Grade {gradeLevel} · Class
          of {student.graduation_year}
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm opacity-70">
          No timeline steps yet for grade {gradeLevel}.
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.season} className="flex flex-col gap-3">
            <h2 className="text-base font-medium">{section.season}</h2>

            <ul className="flex flex-col gap-3">
              {section.tasks.map((task) => {
                const canToggle = canToggleAudience(role, task.audience)

                return (
                  <li key={task.id} className="flex items-start gap-3">
                    <TaskCheckbox
                      taskId={task.id}
                      studentId={studentId}
                      completed={task.completed}
                      canToggle={canToggle}
                      label={task.title}
                    />

                    <div className="flex flex-col gap-0.5">
                      <span
                        className={
                          task.completed
                            ? 'text-sm line-through opacity-60'
                            : 'text-sm'
                        }
                      >
                        {task.icon ? `${task.icon} ` : ''}
                        {task.title}
                      </span>

                      {task.description && (
                        <span className="text-xs opacity-70">
                          {task.description}
                        </span>
                      )}

                      {!canToggle && (
                        <span className="text-xs opacity-50">
                          For the {task.audience === 'parent' ? 'parent' : 'student'} to
                          complete
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
