'use client'

import Link from 'next/link'
import type { IconType } from 'react-icons'
import { cn } from '@/lib/utils'

export function SmartButton({
  icon: Icon,
  label,
  count,
  href,
  className,
}: {
  icon: IconType
  label: string
  count: number | string
  href: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-w-[7.5rem] flex-col items-start gap-0.5 rounded-2xl border border-border',
        'bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent',
        className,
      )}
    >
      <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <span className="tabular text-lg font-medium text-foreground">{count}</span>
    </Link>
  )
}
