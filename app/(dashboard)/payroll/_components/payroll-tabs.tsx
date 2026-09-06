'use client'



import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuCalculator, LuLayers, LuReceipt } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { cn } from '@/lib/utils'

const TABS: Array<{ href: string; label: string; icon: IconType }> = [
  { href: '/payroll/payruns', label: 'Pay Runs', icon: LuReceipt },
  { href: '/payroll/structures', label: 'Salary Structures', icon: LuLayers },
  { href: '/payroll/rules', label: 'Salary Rules', icon: LuCalculator },
]

export function PayrollTabs() {
  const pathname = usePathname()

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 border-b border-border pb-px">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-t-md border-b-2 px-3.5 py-2.5 text-sm transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
