import { LuCircleAlert, LuCircleCheck, LuTriangleAlert } from 'react-icons/lu'
import type { PayrollWarning } from '@/modules/payroll-processing'

/**
 * Pre-finalisation checks, grouped by whether they BLOCK.
 *
 * The split is what keeps this panel useful: an error means validation will
 * refuse, a warning means a human should look and may proceed anyway. A single
 * undifferentiated list is the fastest way to teach people to ignore it.
 */
export function PayrunWarnings({ warnings }: { warnings: PayrollWarning[] }) {
  if (!warnings.length) {
    return (
      <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-success/25 bg-success/8 px-4 py-3 text-sm">
        <LuCircleCheck className="size-4 text-success" aria-hidden />
        <span className="text-foreground">All pre-finalisation checks passed.</span>
      </div>
    )
  }

  const errors = warnings.filter((w) => w.severity === 'error')
  const advisories = warnings.filter((w) => w.severity !== 'error')

  return (
    <div className="mb-6 space-y-3">
      {errors.length ? (
        <section className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LuCircleAlert className="size-4 text-destructive" aria-hidden />
            {errors.length} issue{errors.length === 1 ? '' : 's'} must be resolved before validating
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-8 text-sm text-muted-foreground">
            {errors.map((warning, index) => (
              <li key={`${warning.code}-${warning.employeeId}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {advisories.length ? (
        <section className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LuTriangleAlert className="size-4 text-warning-foreground" aria-hidden />
            {advisories.length} thing{advisories.length === 1 ? '' : 's'} to check
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-8 text-sm text-muted-foreground">
            {advisories.map((warning, index) => (
              <li key={`${warning.code}-${warning.employeeId}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
