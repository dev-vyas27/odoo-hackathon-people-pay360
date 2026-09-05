/**
 * Mark a validated payrun as paid.
 *
 * The aggregate refuses this on anything but a validated run, so the "someone
 * clicked Mark Paid on a draft" bug cannot exist. Publishes `payrun.paid` for
 * Delivery and Analytics.
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
import { markPaid, type Payrun } from '../domain/payrun'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'
import type { PayslipRepositoryPort } from './ports/payslip-repository.port'
import { attempt } from './attempt'

export interface MarkPayrunPaidInput {
  actor: Actor
  payrunId: string
}

export class MarkPayrunPaidUseCase implements UseCase<MarkPayrunPaidInput, Payrun> {
  constructor(
    private readonly payruns: PayrunRepositoryPort,
    private readonly payslips: PayslipRepositoryPort,
    private readonly events: IEventBus,
  ) {}

  async execute({ actor, payrunId }: MarkPayrunPaidInput): Promise<Result<Payrun>> {
    const allowed = authorize(actor, 'payrun', 'approve')
    if (!allowed.ok) return allowed

    const payrun = await this.payruns.findById(payrunId)
    if (!payrun) {
      return Err(DomainError.notFound('PAYRUN_NOT_FOUND', 'That payrun no longer exists.'))
    }

    const transitioned = attempt(() => markPaid(payrun))
    if (!transitioned.ok) return transitioned

    const saved = await this.payruns.updateStatus(payrun.id, 'paid')
    await this.payslips.setStatusForPayrun(payrun.id, 'paid')

    await this.events.publish({
      type: 'payrun.paid',
      occurredAt: new Date(),
      payrunId: payrun.id,
    })

    return Ok(saved ?? transitioned.value)
  }
}
