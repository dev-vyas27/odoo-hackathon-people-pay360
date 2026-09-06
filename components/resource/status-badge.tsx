'use client'



import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Intent = 'neutral' | 'info' | 'success' | 'warning' | 'danger'


const INTENT_BY_STATUS: Record<string, Intent> = {
  
  draft: 'neutral',
  computed: 'info',
  validated: 'success',
  paid: 'success',
  cancelled: 'danger',
  
  to_approve: 'warning',
  approved: 'success',
  refused: 'danger',
  
  present: 'success',
  late: 'warning',
  absent: 'danger',
  overtime: 'info',
  missing_checkout: 'warning',
  manual: 'info',
  
  active: 'success',
  expired: 'neutral',
  upcoming: 'info',
  archived: 'neutral',
}



const CLASSES: Record<Intent, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-info/30 bg-info/10 text-info-foreground',
  success: 'border-success/35 bg-success/12 text-success-foreground',
  warning: 'border-warning/40 bg-warning/15 text-warning-foreground',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
}

function humanize(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const intent = INTENT_BY_STATUS[status] ?? 'neutral'
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 px-2.5 py-0.5 font-medium', CLASSES[intent], className)}
    >
      {
}
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
      {humanize(status)}
    </Badge>
  )
}
