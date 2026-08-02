'use client'

import { INPUT_CLASS } from './student-form-fields'

export type SchoolOption = {
  id: string
  name: string
}

/**
 * School picker, shown to system_admin only.
 *
 * The decision is by ROLE, not by whether the viewer's profile happens to carry
 * a school_id. A system_admin is global — even one whose profile has a school
 * set may be acting on any school, so they always choose. A school_admin is
 * scoped to exactly one school by migration 002's check constraint, so the
 * field is hidden for them and the calling form fills in their own school_id.
 *
 * Renders nothing (returns null) rather than being conditionally mounted by the
 * caller, so the rule lives here instead of being duplicated at each call site.
 *
 * Falls back to a raw UUID input when the school list is empty. That is not
 * dead code: public.schools had RLS on with zero policies until migration 009,
 * so if 009 has not been applied the select returns nothing and pasting an id
 * is still the only way through.
 */
export function SchoolField({
  idPrefix,
  role,
  schools,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  // Loose on purpose: an unrecognized role falls through to "not system_admin",
  // which hides the field and uses the profile's own school. Fail closed.
  role: string | null
  schools: SchoolOption[]
  value: string
  onChange: (schoolId: string) => void
  disabled?: boolean
}) {
  if (role !== 'system_admin') {
    return null
  }

  const fieldId = `${idPrefix}-school`

  if (schools.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium">
          School ID
        </label>
        <input
          id={fieldId}
          type="text"
          required
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT_CLASS} font-mono`}
        />
        <p className="text-xs opacity-60">
          No schools are readable from this account, so paste the school UUID.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium">
        School
      </label>
      <select
        id={fieldId}
        required
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      >
        <option value="">Select a school…</option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>
      <p className="text-xs opacity-60">
        As a system admin you can add to any school.
      </p>
    </div>
  )
}
