import { requireAdmin } from '../access'

export default async function SettingsPage() {
  await requireAdmin()

  return (
    <main className="flex flex-1 flex-col gap-6 p-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm opacity-70">Coming soon.</p>
    </main>
  )
}
