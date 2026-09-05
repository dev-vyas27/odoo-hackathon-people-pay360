/**
 * Consistent page furniture: title, optional description, right-aligned actions.
 * Keeps every screen's top edge identical without each one re-inventing spacing.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div className="space-y-1">
        {/* font-medium is the heaviest LT Wave weight — see lib/fonts.ts */}
        <h1 className="text-2xl font-medium tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
