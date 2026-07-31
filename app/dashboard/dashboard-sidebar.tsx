'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'

type NavItem = {
  href: string
  label: string
  /**
   * Whether this item is the active section. Explicit per item because
   * "Dashboard" and "Students" share a destination — a plain href comparison
   * would light up both at once.
   */
  isActive: (pathname: string) => boolean
}

const PRIMARY_ITEMS: NavItem[] = [
  {
    href: '/dashboard/students',
    label: 'Dashboard',
    isActive: (pathname) => pathname === '/dashboard',
  },
  {
    href: '/dashboard/students',
    label: 'Students',
    isActive: (pathname) => pathname.startsWith('/dashboard/students'),
  },
  {
    href: '/dashboard/parents',
    label: 'Parents',
    isActive: (pathname) => pathname.startsWith('/dashboard/parents'),
  },
  {
    href: '/dashboard/timeline',
    label: 'Timelines',
    isActive: (pathname) => pathname.startsWith('/dashboard/timeline'),
  },
]

const FOOTER_ITEMS: NavItem[] = [
  {
    href: '/dashboard/settings',
    label: 'Settings',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings'),
  },
]

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.isActive(pathname)

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-md bg-black/5 px-3 py-2 text-sm font-medium dark:bg-white/10'
          : 'rounded-md px-3 py-2 text-sm opacity-70 transition-opacity hover:opacity-100'
      }
    >
      {item.label}
    </Link>
  )
}

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-black/10 p-6 dark:border-white/15">
      <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
        College Prep
      </Link>

      <nav className="flex flex-col gap-1">
        {PRIMARY_ITEMS.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* mt-auto pushes Settings and Sign Out to the bottom of the sidebar. */}
      <div className="mt-auto flex flex-col gap-1">
        {FOOTER_ITEMS.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}

        <SignOutButton className="mt-2 w-full rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-white/20" />
      </div>
    </aside>
  )
}
