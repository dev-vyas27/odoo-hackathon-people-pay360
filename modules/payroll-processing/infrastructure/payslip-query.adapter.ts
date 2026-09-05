/**
 * PayslipQueryPort implementation — the projection Delivery renders.
 *
 * Money becomes plain rounded numbers exactly once, here, so the PDF, the email
 * and the screen all show the same figure.
 */
import type {
  PayslipLineView,
  PayslipQueryPort,
  PayslipView,
} from '../application/ports/payslip-query.port'
import type { PayslipRepositoryPort } from '../application/ports/payslip-repository.port'
import { linesInSequence, totalsOf, type Payslip } from '../domain/payslip'

export class PayslipQueryAdapter implements PayslipQueryPort {
  constructor(private readonly payslips: PayslipRepositoryPort) {}

  async findById(payslipId: string): Promise<PayslipView | null> {
    const payslip = await this.payslips.findById(payslipId)
    return payslip ? toView(payslip) : null
  }

  async findByPayrun(payrunId: string): Promise<PayslipView[]> {
    const payslips = await this.payslips.findByPayrun(payrunId)
    return payslips.map(toView)
  }
}

export function toView(payslip: Payslip): PayslipView {
  const totals = totalsOf(payslip)

  return {
    id: payslip.id,
    employeeId: payslip.employeeId,
    employeeName: payslip.employeeName,
    payrunId: payslip.payrunId,
    payrunName: payslip.payrunName,
    periodStart: payslip.period.start,
    periodEnd: payslip.period.end,
    structureName: payslip.structureName,
    workedDays: payslip.workedDays,
    lines: linesInSequence(payslip).map(
      (line): PayslipLineView => ({
        code: line.code,
        name: line.name,
        category: line.category,
        sequence: line.sequence,
        amount: line.amount.toNumber(),
      }),
    ),
    basic: totals.basic.toNumber(),
    gross: totals.gross.toNumber(),
    deductions: totals.deductions.toNumber(),
    net: totals.net.toNumber(),
    status: payslip.status,
  }
}
