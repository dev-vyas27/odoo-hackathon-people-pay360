'use client'

/**
 * One KPI tile. Spec B9 names five of them.
 *
 * `value` is `string | null`, and null renders "No data" rather than a zero.
 * That distinction is the whole reason this component exists rather than a div:
 * on a half-integrated system a zero is indistinguishable from a missing
 * integration, and the difference matters to whoever is looking at the screen.
 *
 * ── Two registers ─────────────────────────────────────────────────────────
 *
 * `featured` sets the figure at `text-2xl` — 3.898rem, the largest step in the
 * type scale that this app ever uses. Exactly one tile per screen may claim it,
 * and on the payroll dashboard that is total net paid: the number the page
 * exists to answer. Everything else is a supporting tile at `text-xl`, and the
 * size difference is what makes the hierarchy readable from across a desk.
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
  featured = false,
  className,
}: {
  label: string
  /** null means "we have no data", which is not the same as zero. */
  value: string | null
  hint?: string
  icon: IconType
  tone?: 'default' | 'success' | 'warning' | 'danger'
  /** The one headline figure on the screen. See the note above. */
  featured?: boolean
  className?: string
}) {
  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden transition-shadow hover:shadow-lg',
        featured && 'border-primary-200 bg-primary-50',
        className,
      )}
    >
      <CardContent className={cn('flex h-full flex-col', featured ? 'gap-4' : 'gap-3')}>
        {/*
          The featured tile gets a filled chip; the rest set the icon inline
          with the label. A chip on a 200px tile squeezed "Payslips generated"
          onto two lines, which knocked every figure in the row off a shared
          baseline — and the icons were decorative anyway. Only the tile that
          earns emphasis carries one.
        */}
        {featured ? (
          <div className="flex items-start justify-between gap-3">
            <span className="eyebrow">{label}</span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Icon className="size-4.5" aria-hidden />
            </span>
          </div>
        ) : (
          <span className="eyebrow flex min-h-[2.1rem] items-start gap-2">
            <Icon className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
            {label}
          </span>
        )}

        <p
          className={cn(
            'tabular font-medium text-foreground',
            featured ? 'text-2xl' : 'text-xl',
            value === null && 'text-muted-foreground/60',
            tone === 'success' && 'text-success-foreground',
            tone === 'warning' && 'text-warning-foreground',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value ?? 'No data'}
        </p>

        {hint ? <p className="mt-auto text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
