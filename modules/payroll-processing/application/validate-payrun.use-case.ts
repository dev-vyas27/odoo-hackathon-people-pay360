/**
 * Validate a payrun — the point of no return.
 *
 * Warnings are re-run here rather than trusted from the compute step: minutes
 * may have passed, a contract may have been edited, another run may have been
 * created. Blocking problems (a duplicate payslip, a missing contract) refuse
 * the transition; advisory ones are surfaced but do not stop a human who has
 * looked at them.
 *
 * Publishes `payrun.validated` so Delivery and Analytics can react without this
 * module knowing they exist.
 */
import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type IEventBus,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { EmployeeLookupPort } from '@/modules/shared'
import type { ContractQueryPort, ContractSnapshot } from '@/modules/shared'
import { markValidated, type Payrun } from '../domain/payrun'
import type { PayrollWarning } from '../domain/warnings/warning.port'
import { blockingWarnings, runWarningChecks } from '../domain/warnings/warning.registry'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'
import type { PayslipRepositoryPort } from './ports/payslip-repository.port'
import { attempt } from './attempt'

export interface ValidatePayrunInput {
  actor: Actor
  payrunId: string
}

export interface ValidatePayrunOutput {
  payrun: Payrun
  warnings: PayrollWarning[]
}

export class ValidatePayrunUseCase implements UseCase<ValidatePayrunInput, ValidatePayrunOutput> {
  constructor(
    private readonly payruns: PayrunRepositoryPort,
    private readonly payslips: PayslipRepositoryPort,
    private readonly employees: EmployeeLookupPort,
    private readonly contracts: ContractQueryPort,
    private readonly events: IEventBus,
  ) {}

  async execute({ actor, payrunId }: ValidatePayrunInput): Promise<Result<ValidatePayrunOutput>> {
    const allowed = authorize(actor, 'payrun', 'approve')
    if (!allowed.ok) return allowed

    const payrun = await this.payruns.findById(payrunId)
    if (!payrun) {
      return Err(DomainError.notFound('PAYRUN_NOT_FOUND', 'That payrun no longer exists.'))
    }

    const payslips = await this.payslips.findByPayrun(payrun.id)
    if (!payslips.length) {
      return Err(
        DomainError.rule(
          'PAYRUN_NOT_COMPUTED',
          'Compute this payrun before validating it — it has no payslips yet.',
        ),
      )
    }

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
    const contracts = new Map<string, ContractSnapshot | null>(contractEntries)

    const elsewhere = await this.payslips.findOverlapping(
      employees.map((e) => e.id),
      payrun.period,
      payrun.id,
    )

    const warnings = runWarningChecks({
      payrunId: payrun.id,
      period: payrun.period,
      employees,
      contracts,
      payslips,
      payslipsElsewhere: elsewhere,
    })

    const blocking = blockingWarnings(warnings)
    if (blocking.length) {
      return Err(
        DomainError.rule(
          'PAYRUN_HAS_BLOCKING_WARNINGS',
          `This payrun cannot be validated until ${blocking.length} issue${blocking.length === 1 ? '' : 's'} ${blocking.length === 1 ? 'is' : 'are'} resolved.`,
          { warnings: blocking },
        ),
      )
    }

    const transitioned = attempt(() => markValidated(payrun))
    if (!transitioned.ok) return transitioned

    const saved = await this.payruns.updateStatus(payrun.id, 'validated')
    await this.payslips.setStatusForPayrun(payrun.id, 'validated')

    await this.events.publish({
      type: 'payrun.validated',
      occurredAt: new Date(),
      payrunId: payrun.id,
      payslipIds: payslips.map((p) => p.id),
    })

    return Ok({ payrun: saved ?? transitioned.value, warnings })
  }
}
