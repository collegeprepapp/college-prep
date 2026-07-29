import { redirect } from 'next/navigation'
import { getPortalViewer } from './access'

export default async function PortalIndexPage() {
  const { students } = await getPortalViewer()

  // students is sorted by name and never empty here — getPortalViewer redirects
  // away rather than returning an empty list. For a student that one row is
  // their own record; for a parent it is the first of their linked children,
  // matching the order the sidebar switcher shows.
  redirect(`/portal/${students[0].id}/timeline`)
}
