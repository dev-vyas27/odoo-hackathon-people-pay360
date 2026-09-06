

import { describe, expect, it } from 'vitest'
import { InMemoryEventBus, Period, unwrap, type Actor, type DomainEvent } from '@/modules/shared'
import { RequestLeaveUseCase } from './request-leave.use-case'
import { SubmitLeaveUseCase } from './submit-leave.use-case'
import { RefuseLeaveUseCase } from './refuse-leave.use-case'
import { InMemoryUnitOfWork } from './test-support/in-memory-unit-of-work'
import { fakeEmployees, fakeSchedules } from './test-support/fake-schedule-lookup'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const hr: Actor = { employeeId: 'hr-1', role: 'hr_manager', email: 'hr@co.com', name: 'HR' }
const employeeId = 'employee-1'

function trackedBus(): { bus: InMemoryEventBus; published: DomainEvent[] } {
  const bus = new InMemoryEventBus()
  const published: DomainEvent[] = []
  bus.subscribe('leave_request.approved', (event) => {
    published.push(event)
  })
  return { bus, published }
}

function seedAutoApproveType(uow: InMemoryUnitOfWork, requiresAllocation = true) {
  return uow.types.seed({
    name: 'Work From Home',
    code: 'WFH',
    unit: 'day',
    requiresAllocation,
    autoApprove: true,
    isPaid: true,
    isActive: true,
  })
}

function seedManualType(uow: InMemoryUnitOfWork) {
  return uow.types.seed({
    name: 'Paid Time Off',
    code: 'PL',
    unit: 'day',
    requiresAllocation: true,
    autoApprove: false,
    isPaid: true,
    isActive: true,
  })
}

describe('RequestLeaveUseCase — auto-approval', () => {
  it('submits straight to approved and consumes the allocation, for a type configured to auto-approve', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus, published } = trackedBus()
    const type = seedAutoApproveType(uow)
    const allocation = uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const result = await new RequestLeaveUseCase(uow, bus, fakeEmployees(), fakeSchedules()).execute({
      actor: hr,
      employeeId,
      timeOffTypeId: type.id,
      start: day('2026-03-02'),
      end: day('2026-03-06'),
    })

    const view = unwrap(result)
    expect(view.status).toBe('approved')
    expect(view.allocationId).toBe(allocation.id)
    
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(5)
    expect(published).toHaveLength(1)
    expect(published[0]).toMatchObject({ requestId: view.id, employeeId })
  })

  it('does not auto-approve a request saved as a draft, even for an auto-approve type', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus, published } = trackedBus()
    const type = seedAutoApproveType(uow)
    const allocation = uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const result = await new RequestLeaveUseCase(uow, bus, fakeEmployees(), fakeSchedules()).execute({
      actor: hr,
      employeeId,
      timeOffTypeId: type.id,
      start: day('2026-03-02'),
      end: day('2026-03-06'),
      asDraft: true,
    })

    const view = unwrap(result)
    expect(view.status).toBe('draft')
    expect(view.allocationId).toBeNull()
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(0)
    expect(published).toHaveLength(0)
  })

  it('creates no request at all when an auto-approve type cannot be funded', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus } = trackedBus()
    const type = seedAutoApproveType(uow)
    
    uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 2,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const result = await new RequestLeaveUseCase(uow, bus, fakeEmployees(), fakeSchedules()).execute({
      actor: hr,
      employeeId,
      timeOffTypeId: type.id,
      start: day('2026-03-02'),
      end: day('2026-03-06'),
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INSUFFICIENT_BALANCE')
    expect(uow.requests.rows.size).toBe(0)
  })

  it('still lands in to_approve, unconsumed, for a type left at the manual default', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus, published } = trackedBus()
    const type = seedManualType(uow)
    const allocation = uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const result = await new RequestLeaveUseCase(uow, bus, fakeEmployees(), fakeSchedules()).execute({
      actor: hr,
      employeeId,
      timeOffTypeId: type.id,
      start: day('2026-03-02'),
      end: day('2026-03-06'),
    })

    const view = unwrap(result)
    expect(view.status).toBe('to_approve')
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(0)
    expect(published).toHaveLength(0)
  })
})

describe('SubmitLeaveUseCase — auto-approval', () => {
  it('sends a draft of an auto-approve type straight to approved', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus, published } = trackedBus()
    const type = seedAutoApproveType(uow)
    const allocation = uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })
    const draft = uow.requests.seed({
      employeeId,
      timeOffTypeId: type.id,
      period: Period.of(day('2026-03-02'), day('2026-03-06')),
      unit: 'day',
      duration: 5,
      status: 'draft',
    })

    const result = await new SubmitLeaveUseCase(uow, bus).execute({
      actor: hr,
      requestId: draft.id,
    })

    const view = unwrap(result)
    expect(view.status).toBe('approved')
    expect(view.allocationId).toBe(allocation.id)
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(5)
    expect(published).toHaveLength(1)
  })

  it('leaves a manual-type draft at to_approve, awaiting a human decision', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus, published } = trackedBus()
    const type = seedManualType(uow)
    uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })
    const draft = uow.requests.seed({
      employeeId,
      timeOffTypeId: type.id,
      period: Period.of(day('2026-03-02'), day('2026-03-06')),
      unit: 'day',
      duration: 5,
      status: 'draft',
    })

    const result = await new SubmitLeaveUseCase(uow, bus).execute({
      actor: hr,
      requestId: draft.id,
    })

    const view = unwrap(result)
    expect(view.status).toBe('to_approve')
    expect(view.allocationId).toBeNull()
    expect(published).toHaveLength(0)
  })
})

describe('refusing an auto-approved request', () => {
  it('restores the balance exactly as it would for a manual approval', async () => {
    const uow = new InMemoryUnitOfWork()
    const { bus } = trackedBus()
    const type = seedAutoApproveType(uow)
    const allocation = uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 10,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const approved = unwrap(
      await new RequestLeaveUseCase(uow, bus, fakeEmployees(), fakeSchedules()).execute({
        actor: hr,
        employeeId,
        timeOffTypeId: type.id,
        start: day('2026-03-02'),
        end: day('2026-03-06'),
      }),
    )
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(5)

    
    const refused = unwrap(
      await new RefuseLeaveUseCase(uow, bus).execute({ actor: hr, requestId: approved.id }),
    )

    expect(refused.status).toBe('refused')
    expect(refused.allocationId).toBeNull()
    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(0)
  })
})
