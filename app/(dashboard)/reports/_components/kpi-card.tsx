'use client'

/**
 * One KPI tile. Spec B9 names five of them.
 *
 * `value` is `string | null`, and null renders "No data" rather than a zero.
 * That distinction is the whole reason this component exists rather than a div:
 * on a half-integrated system a zero is indistinguishable from a missing
 * integration, and the difference matters to whoever is looking at the screen.
 */
import type { IconType } from 'react-icons'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  /** null means "we have no data", which is not the same as zero. */
  value: string | null
  hint?: string
  icon: IconType
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5 pt-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </div>

        <p
          className={cn(
            'tabular text-2xl font-medium tracking-tight',
            value === null && 'text-muted-foreground/60',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning-foreground',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value ?? 'No data'}
        </p>

        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
