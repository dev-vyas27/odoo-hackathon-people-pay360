import { SALARY_CATEGORY_LABELS, type SalaryCategory } from '@/modules/payroll-config'
import { formatMoney } from '../../_lib/format'

export interface PreviewLine {
  code: string
  name: string
  category: string
  sequence: number
  amount: number
}

/**
 * A worked example of what this structure computes.
 *
 * Codes are shown beside every line because that is how the rules address each
 * other — seeing BASIC, then HRA at 40% of it, then NET subtracting PF, makes
 * the engine legible at a glance.
 */
export function StructurePreview({
  lines,
  wage = 50000,
}: {
  lines: PreviewLine[] | null
  wage?: number
}) {
  if (!lines?.length) return null

  return (
    <section className="rounded-lg border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">Computation preview</h2>
        <p className="text-xs text-muted-foreground">
          Sample contract wage {formatMoney(wage)} · full attendance
        </p>
      </header>

      <ul className="divide-y divide-border">
        {lines.map((line) => (
          <li key={line.code} className="flex items-center gap-4 px-5 py-2.5 text-sm">
            <span className="w-8 shrink-0 tabular-nums text-xs text-muted-foreground">
              {line.sequence}
            </span>
            <span className="w-28 shrink-0 font-mono text-xs text-foreground">{line.code}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{line.name}</span>
            <span className="w-24 shrink-0 text-xs text-muted-foreground">
              {SALARY_CATEGORY_LABELS[line.category as SalaryCategory] ?? line.category}
            </span>
            <span className="w-32 shrink-0 text-right tabular-nums text-foreground">
              {formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
