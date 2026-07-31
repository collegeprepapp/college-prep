'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'

const NAV_LINKS = [
  { href: '/dashboard/students', label: 'Students' },
  { href: '/dashboard/timeline', label: 'Timeline Templates' },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-black/10 px-10 py-4 dark:border-white/15">
      <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
        College Prep
      </Link>

      <nav className="flex flex-1 flex-wrap gap-1">
        {NAV_LINKS.map((link) => {
          const isActive = pathname.startsWith(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'rounded-md bg-black/5 px-3 py-1.5 text-sm font-medium dark:bg-white/10'
                  : 'rounded-md px-3 py-1.5 text-sm opacity-70 transition-opacity hover:opacity-100'
              }
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      <SignOutButton />
    </header>
  )
}
