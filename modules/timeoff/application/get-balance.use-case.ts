/**
 * An employee's leave balances — the numbers the spec calls "taken, remaining,
 * and validity periods" (A4), and what the Payroll Dashboard shows as "leave
 * balances" (B9).
 *
 * The maths is entirely in `balance.service.ts`, which is pure and tested. This
 * use case only does the parts that need the outside world: check who is asking,
 * load the rows, hand them over.
 *
 * `authorizeOwned` is the interesting line. Spec section 3 gives the plain
 * `employee` role "view own ... leave balances" — so the permission is not the
 * question, the ROW is. An employee asking for someone else's balance gets a
 * 403 even though they hold `allocation:read`.
 */
import {
  Ok,
  authorizeOwned,
  startOfDay,
  type Actor,
  type LeaveBalanceView,
  type Result,
  type UseCase,
} from '@/modules/shared'
import { buildBalances } from '../domain/balance.service'
import type { UnitOfWorkPort } from './ports/unit-of-work.port'

export interface GetBalanceInput {
  actor: Actor
  employeeId: string
  /** Balances are as-of a date; defaults to today. */
  on?: Date
}

export class GetBalanceUseCase implements UseCase<GetBalanceInput, LeaveBalanceView[]> {
  constructor(private readonly uow: UnitOfWorkPort) {}

  async execute(input: GetBalanceInput): Promise<Result<LeaveBalanceView[]>> {
    const allowed = authorizeOwned(input.actor, 'allocation', 'read', input.employeeId)
    if (!allowed.ok) return allowed

    const { types, allocations, requests } = this.uow.repos
    const on = startOfDay(input.on ?? new Date())

    const [allTypes, employeeAllocations, employeeRequests] = await Promise.all([
      types.findAll(true),
      allocations.findForEmployee(input.employeeId),
      requests.findForEmployee(input.employeeId),
    ])

    /**
     * Types that need no allocation are excluded: unpaid leave has no balance
     * to report, and showing "0 of 0 remaining" next to it implies a limit that
     * does not exist.
     */
    const withBalances = allTypes.filter((type) => type.requiresAllocation)

    return Ok(buildBalances(withBalances, employeeAllocations, employeeRequests, on))
  }
}
