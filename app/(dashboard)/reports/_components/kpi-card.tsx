'use client'



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
  
  value: string | null
  hint?: string
  icon: IconType
  tone?: 'default' | 'success' | 'warning' | 'danger'
  
  featured?: boolean
  className?: string
}) {
  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden transition-shadow hover:shadow-lg',
        featured && 'border-primary/25 bg-accent/70',
        className,
      )}
    >
      <CardContent className={cn('flex h-full flex-col', featured ? 'gap-4' : 'gap-3')}>
        {

}
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
