


import { DomainError, Period, type LeaveBalanceView } from '@/modules/shared'
import type { Allocation } from './allocation'
import type { LeaveRequest } from './leave-request'
import type { TimeOffType } from './time-off-type'



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
        
        a.covers(request.period),
    )
    .sort((a, b) => a.validity.end.getTime() - b.validity.end.getTime())
}



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
      
      
      remaining: round2(allocated - taken - pending),
    }
  })
}


export interface AllocationTotal {
  timeOffTypeId: string
  allocated: number
  taken: number
}


export interface PendingTotal {
  timeOffTypeId: string
  pending: number
}



export function buildBalanceTotals(
  types: TimeOffType[],
  allocationTotals: AllocationTotal[],
  pendingTotals: PendingTotal[],
): LeaveBalanceView[] {
  const allocatedByType = new Map(allocationTotals.map((row) => [row.timeOffTypeId, row]))
  const pendingByType = new Map(pendingTotals.map((row) => [row.timeOffTypeId, row.pending]))

  return types.map((type) => {
    const row = allocatedByType.get(type.id)
    const allocated = row?.allocated ?? 0
    const taken = row?.taken ?? 0
    const pending = pendingByType.get(type.id) ?? 0

    return {
      timeOffTypeId: type.id,
      timeOffTypeName: type.name,
      unit: type.unit,
      allocated,
      taken,
      pending,
      remaining: round2(allocated - taken - pending),
    }
  })
}



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
