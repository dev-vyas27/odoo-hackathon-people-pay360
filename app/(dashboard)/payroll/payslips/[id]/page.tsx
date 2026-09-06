import Link from 'next/link'
import { LuArrowLeft, LuDownload, LuPrinter } from 'react-icons/lu'
import { GetPayslipDetailUseCase, payslipRepository, toPayslipView } from '@/modules/payroll-processing/server'
import { PageHeader } from '@/components/resource/page-header'
import { StatusBadge } from '@/components/resource/status-badge'
import { Button } from '@/components/ui/button'
import { ErrorState, Field } from '../../_components/states'
import { formatPeriod } from '../../_lib/format'
import { load, pageActor } from '../../_lib/session'
import { SalaryComputation } from './salary-computation'

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await pageActor()

  const result = await load(async () => {
    const outcome = await new GetPayslipDetailUseCase(payslipRepository()).execute({
      actor,
      payslipId: id,
    })
    if (!outcome.ok) throw outcome.error
    return toPayslipView(outcome.value)
  })

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Payslip" />
        <ErrorState title="Could not open this payslip" message={result.message} />
      </>
    )
  }

  const payslip = result.data

  return (
    <>
      <PageHeader
        title={payslip.employeeName}
        description={`${payslip.payrunName} · ${payslip.structureName}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href={`/payroll/payruns/${payslip.payrunId}`}>
                <LuArrowLeft className="size-4" aria-hidden />
                Back to pay run
              </Link>
            </Button>
            {/* Rendered by the delivery module. Inline preview here… */}
            <Button asChild variant="outline">
              <a href={`/api/payslips/${payslip.id}/pdf`} target="_blank" rel="noreferrer">
                <LuPrinter className="size-4" aria-hidden />
                Print PDF
              </a>
            </Button>
            {/* …and the same route with ?download=1 for a save dialog. */}
            <Button asChild>
              <a href={`/api/payslips/${payslip.id}/pdf?download=1`}>
                <LuDownload className="size-4" aria-hidden />
                Download
              </a>
            </Button>
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-6 rounded-2xl border border-border bg-card px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Employee">{payslip.employeeName}</Field>
        <Field label="Structure">{payslip.structureName}</Field>
        <Field label="Pay run">
          <Link href={`/payroll/payruns/${payslip.payrunId}`} className="hover:underline">
            {payslip.payrunName}
          </Link>
        </Field>
        <Field label="Period">{formatPeriod(payslip.periodStart, payslip.periodEnd)}</Field>
        <Field label="Status">
          <StatusBadge status={payslip.status} />
        </Field>
        <Field label="Worked days">
          <span className="tabular-nums">{payslip.workedDays}</span>
        </Field>
      </section>

      <SalaryComputation payslip={payslip} />
    </>
  )
}
