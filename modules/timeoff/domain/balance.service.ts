/**
 * Balance maths. Pure functions, no I/O, no dates read from the clock.
 *
 * Everything interesting about Time Off lives here: which allocation funds a
 * request, whether it can, and what an employee's remaining entitlement is once
 * pending requests are taken into account. Because it is pure, the whole rule
 * set is unit-testable in milliseconds — which matters, because these are
 * exactly the rules a demo will be poked at.
 */
import { DomainError, Period, type LeaveBalanceView } from '@/modules/shared'
import type { Allocation } from './allocation'
import type { LeaveRequest } from './leave-request'
import type { TimeOffType } from './time-off-type'

/**
 * The allocations that could legally fund this request, best candidate first.
 *
 * "Best" is the one expiring soonest: consuming a balance that is about to
 * lapse before one that runs for another year is what a human would do, and
 * doing it the other way round silently destroys entitlement.
 */
export function eligibleAllocations(
  allocations: Allocation[],
  request: { employeeId: string; timeOffTypeId: string; period: Period },
): Allocation[] {
  return allocations
    .filter(
      (a) =>
        a.isUsable &&
        a.employeeId === request.employeeId &&
        a.timeOffTypeId === request.timeOffTypeId &&
        // Validity must span the WHOLE request — see Allocation.covers().
        a.covers(request.period),
    )
    .sort((a, b) => a.validity.end.getTime() - b.validity.end.getTime())
}

/**
 * Pick the allocation to draw from, or explain why none will do.
 *
 * Returns `null` only when the caller has already established that this leave
 * type needs no allocation. Otherwise it throws a DomainError carrying the
 * numbers, so the API message is "Insufficient balance: 3 of 5 days remaining"
 * rather than "Bad request".
 */
export function selectAllocation(
  allocations: Allocation[],
  request: { employeeId: string; timeOffTypeId: string; period: Period; duration: number },
): Allocation {
  const eligible = eligibleAllocations(allocations, request)

  if (eligible.length === 0) {
    throw DomainError.rule(
      'NO_ALLOCATION',
      'No approved allocation covers these dates for this leave type',
      { from: request.period.start.toISOString(), to: request.period.end.toISOString() },
    )
  }

  const funder = eligible.find((a) => a.canAbsorb(request.duration))

  if (!funder) {
    const best = Math.max(...eligible.map((a) => a.remaining))
    throw DomainError.rule(
      'INSUFFICIENT_BALANCE',
      `Insufficient balance: ${best} remaining, ${request.duration} requested`,
      { remaining: best, requested: request.duration },
    )
  }

  return funder
}

/**
 * Everything an employee has, per leave type, as of a date.
 *
 * `pending` is separated from `taken` on purpose: submitted-but-unapproved
 * requests have NOT consumed the allocation yet, but an employee deciding
 * whether to book more leave needs to see them. Rolling them into `taken` would
 * make the number disagree with the allocation record; hiding them entirely
 * invites people to overbook and then be refused.
 */
export function buildBalances(
  types: TimeOffType[],
  allocations: Allocation[],
  requests: LeaveRequest[],
  on: Date,
): LeaveBalanceView[] {
  const activeOn = (a: Allocation) => a.isUsable && a.validity.contains(on)

  return types.map((type) => {
    const mine = allocations.filter((a) => a.timeOffTypeId === type.id && activeOn(a))

    const allocated = sum(mine.map((a) => a.allocated))
    const taken = sum(mine.map((a) => a.taken))

    const pending = sum(
      requests
        .filter((r) => r.timeOffTypeId === type.id && r.status === 'to_approve')
        .map((r) => r.duration),
    )

    return {
      timeOffTypeId: type.id,
      timeOffTypeName: type.name,
      unit: type.unit,
      allocated,
      taken,
      pending,
      // Pending is subtracted so the number answers "how much more may I book",
      // which is the question the employee is actually asking.
      remaining: round2(allocated - taken - pending),
    }
  })
}

/**
 * Reject a request that collides with one the employee already has.
 *
 * Only draft/to_approve/approved requests count — a refused one is not a
 * booking, and blocking on it would make a refusal permanently poison those
 * dates.
 */
export function assertNoOverlap(request: LeaveRequest, existing: LeaveRequest[]): void {
  const blocking = existing.filter(
    (r) => r.employeeId === request.employeeId && r.status !== 'refused',
  )

  const clash = blocking.find((r) => request.overlaps({ period: r.period, id: r.id }))

  if (clash) {
    throw DomainError.conflict(
      'LEAVE_OVERLAP',
      `These dates overlap an existing ${clash.status.replace(/_/g, ' ')} request`,
      { conflictingRequestId: clash.id },
    )
  }
}

function sum(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
