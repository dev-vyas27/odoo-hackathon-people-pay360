import Link from 'next/link'
import { isFinalised, toPayrunView } from '@/modules/payroll-processing'
import {
  contractQuery,
  employeeLookup,
  GetPayrunDetailUseCase,
  payrunRepository,
  payslipRepository,
  toPayslipView,
} from '@/modules/payroll-processing/server'
import { PageHeader } from '@/components/resource/page-header'
import { StatusBadge } from '@/components/resource/status-badge'
import { ErrorState, Field, InfoNote } from '../../_components/states'
import { formatPeriod } from '../../_lib/format'
import { load, pageActor } from '../../_lib/session'
import { PayrunActions } from './payrun-actions'
import { PayrunWarnings } from './payrun-warnings'
import { PayslipSummary } from './payslip-summary'

export default async function PayrunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await pageActor()

  const result = await load(async () => {
    const outcome = await new GetPayrunDetailUseCase(
      payrunRepository(),
      payslipRepository(),
      employeeLookup(),
      contractQuery(),
    ).execute({ actor, payrunId: id })
    if (!outcome.ok) throw outcome.error

    return {
      payrun: toPayrunView(outcome.value.payrun),
      payslips: outcome.value.payslips.map(toPayslipView),
      warnings: outcome.value.warnings,
    }
  })

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Pay run" />
        <ErrorState title="Could not open this pay run" message={result.message} />
      </>
    )
  }

  const { payrun, payslips, warnings } = result.data
  const readOnly = isFinalised(payrun.status)

  return (
    <>
      <PageHeader
        title={payrun.name}
        description={`${payrun.structureName} · ${formatPeriod(payrun.periodStart, payrun.periodEnd)}`}
        actions={<PayrunActions payrun={payrun} payslipCount={payslips.length} />}
      />

      <section className="mb-6 grid grid-cols-2 gap-6 rounded-2xl border border-border bg-card px-5 py-4 sm:grid-cols-4">
        <Field label="Status">
          <StatusBadge status={payrun.status} />
        </Field>
        <Field label="Structure">
          <Link href={`/payroll/structures/${payrun.structureId}`} className="hover:underline">
            {payrun.structureName}
          </Link>
        </Field>
        <Field label="Period">{formatPeriod(payrun.periodStart, payrun.periodEnd)}</Field>
        <Field label="Employees">
          <span className="tabular-nums">{payrun.employeeCount}</span>
        </Field>
      </section>

      {/* Warnings sit ABOVE the payslips: the spec requires them to be seen
          before anyone finalises, not discovered afterwards. */}
      <PayrunWarnings warnings={warnings} />

      {readOnly ? (
        <InfoNote className="mb-6">
          <p className="font-medium">This pay run is {payrun.status} and is kept as history.</p>
          <p className="text-muted-foreground">
            Its figures can no longer be changed. Create a new run for corrections.
          </p>
        </InfoNote>
      ) : null}

      <PayslipSummary payslips={payslips} status={payrun.status} />
    </>
  )
}
