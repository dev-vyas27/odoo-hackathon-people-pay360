import {
  authorize,
  authorizeOwned,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { Payslip } from '../domain/payslip'
import type { PayslipRepositoryPort } from './ports/payslip-repository.port'

export interface GetPayslipDetailInput {
  actor: Actor
  payslipId: string
}

export class GetPayslipDetailUseCase implements UseCase<GetPayslipDetailInput, Payslip> {
  constructor(private readonly payslips: PayslipRepositoryPort) {}

  async execute({ actor, payslipId }: GetPayslipDetailInput): Promise<Result<Payslip>> {
    const allowed = authorize(actor, 'payslip', 'read')
    if (!allowed.ok) return allowed

    const payslip = await this.payslips.findById(payslipId)
    if (!payslip) {
      return Err(DomainError.notFound('PAYSLIP_NOT_FOUND', 'That payslip no longer exists.'))
    }

    // Row-level rule: an `employee` may open their OWN payslip and no one
    // else's. proxy.ts cannot enforce this — it has no idea whose payslip this
    // is — so it belongs here.
    const owned = authorizeOwned(actor, 'payslip', 'read', payslip.employeeId)
    if (!owned.ok) return owned

    return Ok(payslip)
  }
}
