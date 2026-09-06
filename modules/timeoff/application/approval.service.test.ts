

import { describe, expect, it } from 'vitest'
import { DomainError, Period } from '@/modules/shared'
import { LeaveRequest } from '../domain/leave-request'
import { InMemoryUnitOfWork } from './test-support/in-memory-unit-of-work'
import { consumeAllocationForApproval } from './approval.service'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const EMP = 'employee-1'

function makeRequest(uow: InMemoryUnitOfWork, typeId: string, duration = 3) {
  const period = Period.of(day('2026-03-02'), day('2026-03-06'))
  return LeaveRequest.from({
    id: 'unsaved',
    employeeId: EMP,
    timeOffTypeId: typeId,
    period,
    unit: 'day',
    duration,
    status: 'to_approve',
  })
}

describe('consumeAllocationForApproval', () => {
  it('returns null and touches nothing when the type needs no allocation', async () => {
    const uow = new InMemoryUnitOfWork()
    const type = uow.types.seed({
      name: 'Unpaid Leave',
      code: 'UL',
      unit: 'day',
      requiresAllocation: false,
      autoApprove: true,
      isPaid: false,
      isActive: true,
    })

    const allocationId = await consumeAllocationForApproval(
      uow.repos,
      type,
      makeRequest(uow, type.id),
    )

    expect(allocationId).toBeNull()
  })

  it('selects, locks and consumes the funding allocation', async () => {
    const uow = new InMemoryUnitOfWork()
    const type = uow.types.seed({
      name: 'Sick Leave',
      code: 'SL',
      unit: 'day',
      requiresAllocation: true,
      autoApprove: true,
      isPaid: true,
      isActive: true,
    })
    const allocation = uow.allocations.seed({
      employeeId: EMP,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const allocationId = await consumeAllocationForApproval(
      uow.repos,
      type,
      makeRequest(uow, type.id, 3),
    )

    expect(allocationId).toBe(allocation.id)
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(3)
  })

  it('throws INSUFFICIENT_BALANCE and leaves the allocation untouched', async () => {
    const uow = new InMemoryUnitOfWork()
    const type = uow.types.seed({
      name: 'Sick Leave',
      code: 'SL',
      unit: 'day',
      requiresAllocation: true,
      autoApprove: true,
      isPaid: true,
      isActive: true,
    })
    const allocation = uow.allocations.seed({
      employeeId: EMP,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 2,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    await expect(
      consumeAllocationForApproval(uow.repos, type, makeRequest(uow, type.id, 3)),
    ).rejects.toThrowError(DomainError)

    
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(0)
  })
})
