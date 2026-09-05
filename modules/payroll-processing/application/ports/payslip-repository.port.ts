/**
 * Persistence port for payslips.
 *
 * Payslips are written per payrun, not one at a time: recomputing a run
 * replaces its whole set atomically, which is why there is no `update`. Keeping
 * the port this narrow means an adapter cannot offer a half-computed run.
 */
import type { Period } from '@/modules/shared'
import type { Payslip } from '../../domain/payslip'
import type { PayslipStatus } from '../../domain/payslip'

export interface PayslipRepositoryPort {
  findById(id: string): Promise<Payslip | null>

  findByPayrun(payrunId: string): Promise<Payslip[]>

  /** Recompute: discard this run's payslips and store the new set. */
  replaceForPayrun(payrunId: string, payslips: Payslip[]): Promise<Payslip[]>

  /**
   * Payslips for these employees whose period overlaps, from OTHER payruns.
   * Feeds the duplicate-payslip warning, which cannot be answered from inside a
   * single run.
   */
  findOverlapping(
    employeeIds: string[],
    period: Period,
    excludePayrunId: string,
  ): Promise<Payslip[]>

  /** Payslips follow their payrun's lifecycle; they are never finalised alone. */
  setStatusForPayrun(payrunId: string, status: PayslipStatus): Promise<void>
}
