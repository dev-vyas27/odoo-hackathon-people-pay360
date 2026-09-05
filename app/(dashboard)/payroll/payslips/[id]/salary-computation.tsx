import { SALARY_CATEGORY_LABELS, type SalaryCategory } from '@/modules/payroll-config'
import type { PayslipView } from '@/modules/payroll-processing'
import { cn } from '@/lib/utils'
import { formatMoney } from '../../_lib/format'

/**
 * The Salary Computation section.
 *
 * Lines are shown IN SEQUENCE ORDER WITH THEIR CODES, which is the single design
 * choice that makes the engine readable: you can see BASIC computed, HRA taken
 * as a percentage of it, GROSS summing them and NET subtracting the deductions —
 * the computation, not just its result.
 */
export function SalaryComputation({ payslip }: { payslip: PayslipView }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <header className="border-b border-border bg-muted/40 px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">Salary computation</h2>
        <p className="text-xs text-muted-foreground">
          Rules run in sequence order; each may use the results of the rules above it.
        </p>
      </header>

      <div className="flex items-center gap-4 border-b border-border px-5 py-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="w-8">Seq</span>
        <span className="w-28">Code</span>
        <span className="flex-1">Rule</span>
        <span className="w-24">Category</span>
        <span className="w-32 text-right">Amount</span>
      </div>

      <ul className="divide-y divide-border">
        {payslip.lines.map((line) => (
          <li
            key={line.code}
            className={cn(
              'flex items-center gap-4 px-5 py-2.5 text-sm',
              line.category === 'net' && 'bg-muted/30',
            )}
          >
            <span className="w-8 tabular-nums text-xs text-muted-foreground">{line.sequence}</span>
            <span className="w-28 font-mono text-xs text-foreground">{line.code}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{line.name}</span>
            <span className="w-24 text-xs text-muted-foreground">
              {SALARY_CATEGORY_LABELS[line.category as SalaryCategory] ?? line.category}
            </span>
            <span
              className={cn(
                'w-32 text-right tabular-nums',
                line.category === 'deduction' ? 'text-destructive' : 'text-foreground',
                line.category === 'net' && 'font-medium',
              )}
            >
              {line.category === 'deduction' ? `− ${formatMoney(line.amount)}` : formatMoney(line.amount)}
            </span>
          </li>
        ))}
      </ul>

      <footer className="grid grid-cols-2 gap-4 border-t border-border bg-muted/20 px-5 py-4 sm:grid-cols-4">
        <Total label="Basic" amount={payslip.basic} />
        <Total label="Gross" amount={payslip.gross} />
        <Total label="Deductions" amount={payslip.deductions} tone="negative" />
        <Total label="Net" amount={payslip.net} tone="strong" />
      </footer>
    </section>
  )
}

function Total({
  label,
  amount,
  tone = 'plain',
}: {
  label: string
  amount: number
  tone?: 'plain' | 'negative' | 'strong'
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tabular-nums',
          tone === 'negative' && 'text-destructive',
          tone === 'strong' ? 'text-lg font-medium text-foreground' : 'text-sm text-foreground',
        )}
      >
        {formatMoney(amount)}
      </p>
    </div>
  )
}
