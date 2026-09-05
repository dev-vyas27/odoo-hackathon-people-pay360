import Link from 'next/link'
import { LuChevronRight, LuInbox } from 'react-icons/lu'
import type { PayrunStatus, PayslipView } from '@/modules/payroll-processing'
import { formatMoney } from '../../_lib/format'

/**
 * The payslips this run produced.
 *
 * Net is the number people scan for, so it is right-aligned and tabular; the
 * full rule breakdown is one click away on each row.
 */
export function PayslipSummary({
  payslips,
  status,
}: {
  payslips: PayslipView[]
  status: PayrunStatus
}) {
  if (!payslips.length) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center">
        <LuInbox className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">
          {status === 'draft'
            ? 'No payslips yet. Compute this pay run to generate them.'
            : 'This pay run produced no payslips.'}
        </p>
      </div>
    )
  }

  const totalNet = payslips.reduce((sum, payslip) => sum + payslip.net, 0)

  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <h2 className="text-sm font-medium text-foreground">
          {payslips.length} payslip{payslips.length === 1 ? '' : 's'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Total net <span className="tabular-nums text-foreground">{formatMoney(totalNet)}</span>
        </p>
      </header>

      <div className="hidden items-center gap-4 border-b border-border px-5 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:flex">
        <span className="flex-1">Employee</span>
        <span className="w-20 text-right">Worked</span>
        <span className="w-28 text-right">Gross</span>
        <span className="w-28 text-right">Deductions</span>
        <span className="w-28 text-right">Net</span>
        <span className="w-5" />
      </div>

      <ul className="divide-y divide-border">
        {payslips.map((payslip) => (
          <li key={payslip.id}>
            <Link
              href={`/payroll/payslips/${payslip.id}`}
              className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-accent/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">{payslip.employeeName}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {payslip.lines.length} lines · {payslip.structureName}
                </span>
              </span>
              <span className="w-20 text-right tabular-nums text-muted-foreground">
                {payslip.workedDays}d
              </span>
              <span className="w-28 text-right tabular-nums text-muted-foreground">
                {formatMoney(payslip.gross)}
              </span>
              <span className="w-28 text-right tabular-nums text-muted-foreground">
                {formatMoney(payslip.deductions)}
              </span>
              <span className="w-28 text-right tabular-nums text-foreground">
                {formatMoney(payslip.net)}
              </span>
              <LuChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
