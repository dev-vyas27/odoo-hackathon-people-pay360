/**
 * Consistent page furniture: title, optional description, right-aligned actions.
 * Keeps every screen's top edge identical without each one re-inventing spacing.
 *
 * `eyebrow` names the section the page belongs to — "Payroll", "People" — so a
 * detail screen deep in the app can say where it sits without a breadcrumb
 * trail. It is optional and most list pages do not need it.
 */
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-8',
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {/* text-xl is 1.972rem — the page-title step. font-medium is the
            heaviest weight LT Wave has; see lib/fonts.ts. */}
        <h1 className="text-xl font-medium text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
