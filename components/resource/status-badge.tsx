'use client'

/**
 * One badge for every status in the system.
 *
 * Payrun, Payslip, LeaveRequest, Allocation and Attendance all have states. If
 * each screen picks its own colours, "validated" ends up green here and blue
 * there and the demo looks careless. This maps status -> intent once.
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Intent = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/** Every known status across all modules, mapped to a visual intent. */
const INTENT_BY_STATUS: Record<string, Intent> = {
  // Payrun / Payslip
  draft: 'neutral',
  computed: 'info',
  validated: 'success',
  paid: 'success',
  cancelled: 'danger',
  // Leave requests & allocations
  to_approve: 'warning',
  approved: 'success',
  refused: 'danger',
  // Attendance
  present: 'success',
  late: 'warning',
  absent: 'danger',
  overtime: 'info',
  missing_checkout: 'warning',
  manual: 'info',
  // Contracts & employees
  active: 'success',
  expired: 'neutral',
  upcoming: 'info',
  archived: 'neutral',
}

const CLASSES: Record<Intent, string> = {
  neutral: 'bg-muted text-muted-foreground border-transparent',
  info: 'bg-info/12 text-info border-info/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/15 text-warning-foreground border-warning/30',
  danger: 'bg-destructive/12 text-destructive border-destructive/25',
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
    <Badge variant="outline" className={cn('font-normal', CLASSES[intent], className)}>
      {humanize(status)}
    </Badge>
  )
}
