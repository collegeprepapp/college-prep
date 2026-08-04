import { requireAdmin } from '../access'
import { AdminsSection, type AdminRow } from './admins-section'
import { ProfileSection } from './profile-section'
import { SchoolSection } from './school-section'

const ADMIN_ROLES = ['school_admin', 'system_admin']

export default async function SettingsPage() {
  const { supabase, userId, role, schoolId } = await requireAdmin()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', userId)
    .maybeSingle()

  // RLS scopes this: school_admin sees only their own school, system_admin sees
  // all. Empty means migration 009's select policy has not been applied.
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name, slug')
    .order('name', { ascending: true })

  const visibleSchools = schools ?? []

  // A school_admin edits their own school. A system_admin has no school of
  // their own, so for now they get the first one they can see.
  const activeSchool =
    visibleSchools.find((school) => school.id === schoolId) ??
    visibleSchools[0] ??
    null

  let admins: AdminRow[] = []

  if (activeSchool) {
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', activeSchool.id)
      .in('role', ADMIN_ROLES)
      .order('last_name', { ascending: true })

    admins = (adminProfiles ?? []).map((adminProfile) => ({
      id: adminProfile.id,
      name:
        [adminProfile.first_name, adminProfile.last_name]
          .filter(Boolean)
          .join(' ') || 'Unnamed',
      role: adminProfile.role,
    }))
  }

  return (
    <main className="flex flex-1 flex-col gap-10 p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <ProfileSection
        firstName={profile?.first_name ?? ''}
        lastName={profile?.last_name ?? ''}
        role={profile?.role ?? role ?? 'unknown'}
        schoolName={activeSchool?.name ?? null}
      />

      {activeSchool ? (
        <SchoolSection
          schoolId={activeSchool.id}
          name={activeSchool.name}
          slug={activeSchool.slug}
          otherSchoolCount={Math.max(visibleSchools.length - 1, 0)}
        />
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">School Info</h2>
          <p className="text-sm opacity-70">
            No school is readable from this account. Migration 009 adds the
            select policy this section needs.
          </p>
        </section>
      )}

      {activeSchool ? (
        <AdminsSection admins={admins} schoolId={activeSchool.id} />
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Manage Admins</h2>
          <p className="text-sm opacity-70">
            Unavailable until a school is readable.
          </p>
        </section>
      )}
    </main>
  )
}
