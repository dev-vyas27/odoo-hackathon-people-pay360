'use client'

/**
 * Section tabs. A client component only because it needs the current pathname
 * to mark the active one; the LIST of tabs is decided on the server.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface TimeOffTab {
  href: string
  label: string
}

export function TimeOffTabs({ tabs }: { tabs: TimeOffTab[] }) {
  const pathname = usePathname()

  return (
    <nav className="mb-6 flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
