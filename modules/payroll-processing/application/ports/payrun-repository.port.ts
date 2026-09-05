/**
 * Persistence port for payruns.
 *
 * Reads follow the shared IReadRepository, but writes are deliberately NOT a
 * generic `update(id, data)`: a payrun's figures are never patched field by
 * field. It is created once and then moves through its lifecycle, so the only
 * write besides creation is a status transition the aggregate has approved.
 */
import type { IReadRepository } from '@/modules/shared'
import type { Payrun } from '../../domain/payrun'
import type { PayrunStatus } from '../../domain/payrun-state'

export interface PayrunRepositoryPort extends IReadRepository<Payrun> {
  /** The adapter maps the fields it persists and assigns the real id. */
  create(payrun: Payrun): Promise<Payrun>
  updateStatus(id: string, status: PayrunStatus): Promise<Payrun | null>
}
