


import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { EmployeeLookupPort } from '@/modules/shared'
import type { ContractQueryPort, ContractSnapshot } from '@/modules/shared'
import type { Payrun } from '../domain/payrun'
import type { Payslip } from '../domain/payslip'
import type { PayrollWarning } from '../domain/warnings/warning.port'
import { runWarningChecks } from '../domain/warnings/warning.registry'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'
import type { PayslipRepositoryPort } from './ports/payslip-repository.port'

export interface GetPayrunDetailInput {
  actor: Actor
  payrunId: string
}

export interface PayrunDetail {
  payrun: Payrun
  payslips: Payslip[]
  warnings: PayrollWarning[]
}

export class GetPayrunDetailUseCase implements UseCase<GetPayrunDetailInput, PayrunDetail> {
  constructor(
    private readonly payruns: PayrunRepositoryPort,
    private readonly payslips: PayslipRepositoryPort,
    private readonly employees: EmployeeLookupPort,
    private readonly contracts: ContractQueryPort,
  ) {}

  async execute({ actor, payrunId }: GetPayrunDetailInput): Promise<Result<PayrunDetail>> {
    const allowed = authorize(actor, 'payrun', 'read')
    if (!allowed.ok) return allowed

    const payrun = await this.payruns.findById(payrunId)
    if (!payrun) {
      return Err(DomainError.notFound('PAYRUN_NOT_FOUND', 'That payrun no longer exists.'))
    }

    const payslips = await this.payslips.findByPayrun(payrun.id)
    const warnings = await this.warningsFor(payrun, payslips)

    return Ok({ payrun, payslips, warnings })
  }

  


  private async warningsFor(payrun: Payrun, payslips: Payslip[]): Promise<PayrollWarning[]> {
    try {
      const employees = await this.employees.findManyByIds([...payrun.employeeIds])
      const contractEntries = await Promise.all(
        employees.map(
          async (employee) =>
            [
              employee.id,
              await this.contracts.findApplicableContract(employee.id, payrun.period),
            ] as const,
        ),
      )
      const elsewhere = await this.payslips.findOverlapping(
        employees.map((e) => e.id),
        payrun.period,
        payrun.id,
      )

      return runWarningChecks({
        payrunId: payrun.id,
        period: payrun.period,
        employees,
        contracts: new Map<string, ContractSnapshot | null>(contractEntries),
        payslips,
        payslipsElsewhere: elsewhere,
      })
    } catch (reason) {
      console.warn('[payroll] warning checks unavailable:', reason)
      return [
        {
          code: 'WARNINGS_UNAVAILABLE',
          severity: 'warning',
          message:
            'Pre-finalisation checks could not run because employee and contract data is unavailable.',
          employeeId: null,
          employeeName: null,
        },
      ]
    }
  }
}
