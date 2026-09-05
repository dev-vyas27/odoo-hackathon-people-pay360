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

/**
 * Tint for the fill and rule, the darker `-foreground` step for the ink.
 *
 * Design.md's success (#22c55e) and error (#ef4444) are a fill green and a fill
 * red — 2.3:1 and 3.8:1 on white. Legible as a swatch, not as 12px type. The
 * ink is a darker step of the same hue, which is the convention `warning`
 * already used here before the palette changed.
 */
const CLASSES: Record<Intent, string> = {
  neutral: 'border-border bg-secondary-100 text-muted-foreground',
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
      {/* The dot carries the intent at a glance; the word confirms it. Scanning
          a list of forty payslips, the eye reads colour long before text. */}
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden />
      {humanize(status)}
    </Badge>
  )
}
