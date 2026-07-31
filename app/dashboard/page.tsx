import { StudentList } from './students/student-list'

/**
 * /dashboard shows the student list — for now it is the same page as
 * /dashboard/students, so both render the same component rather than one
 * redirecting to the other.
 *
 * No requireAdmin() here: it redirects to /dashboard, which is this route.
 * app/dashboard/layout.tsx gates the section and renders a notice instead of
 * these children for anyone who is not an admin.
 */
export default async function DashboardPage() {
  return <StudentList />
}
