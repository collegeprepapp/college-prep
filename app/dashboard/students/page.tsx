import { requireAdmin } from '../access'
import { StudentList } from './student-list'

export default async function StudentsPage() {
  // Safe here (this is not /dashboard, so redirecting there cannot loop) and
  // worth keeping so the page does not depend on an ancestor layout for
  // authorization. getViewer is cache()-wrapped, so this costs no extra query.
  await requireAdmin()

  return <StudentList />
}
