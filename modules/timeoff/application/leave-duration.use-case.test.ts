

import { describe, expect, it } from 'vitest'
import { InMemoryEventBus, Period, unwrap, type Actor } from '@/modules/shared'
import { RequestLeaveUseCase } from './request-leave.use-case'
import { InMemoryUnitOfWork } from './test-support/in-memory-unit-of-work'
import {
  MON_TO_FRI,
  MON_TO_THU,
  fakeEmployees,
  fakeSchedules,
} from './test-support/fake-schedule-lookup'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const hr: Actor = { employeeId: 'hr-1', role: 'hr_manager', email: 'hr@co.com', name: 'HR' }
const employeeId = 'employee-1'

function seed(uow: InMemoryUnitOfWork) {
  const type = uow.types.seed({
    name: 'Paid Time Off',
    code: 'PL',
    unit: 'day',
    requiresAllocation: true,
    autoApprove: false,
    isPaid: true,
    isActive: true,
  })
  uow.allocations.seed({
    employeeId,
    timeOffTypeId: type.id,
    unit: 'day',
    allocated: 30,
    taken: 0,
    validity: Period.of(day('2026-01-01'), day('2026-12-31')),
    status: 'approved',
  })
  return type
}

const start = day('2026-03-02')
const end = day('2026-03-13')

async function request(schedules: ReturnType<typeof fakeSchedules>, scheduleId?: string | null) {
  const uow = new InMemoryUnitOfWork()
  const type = seed(uow)
  const result = await new RequestLeaveUseCase(
    uow,
    new InMemoryEventBus(),
    fakeEmployees(scheduleId === undefined ? 'schedule-1' : scheduleId),
    schedules,
  ).execute({ actor: hr, employeeId, timeOffTypeId: type.id, start, end })
  return unwrap(result)
}

describe('leave duration respects the working schedule', () => {
  it('excludes weekends for a Mon-Fri employee', async () => {
    const view = await request(fakeSchedules(MON_TO_FRI))

    
    expect(Period.of(start, end).days).toBe(12)
    expect(view.duration).toBe(10)
  })

  it('excludes the Friday too on a compressed Mon-Thu week', async () => {
    const view = await request(fakeSchedules(MON_TO_THU))

    
    expect(view.duration).toBe(8)
  })

  it('falls back to the calendar span when the employee has no schedule', async () => {
    const view = await request(fakeSchedules(MON_TO_FRI), null)

    expect(view.duration).toBe(12)
  })

  it('rejects a request that lands entirely on days off', async () => {
    const uow = new InMemoryUnitOfWork()
    const type = seed(uow)

    const result = await new RequestLeaveUseCase(
      uow,
      new InMemoryEventBus(),
      fakeEmployees(),
      fakeSchedules(MON_TO_FRI),
    ).execute({
      actor: hr,
      employeeId,
      timeOffTypeId: type.id,
      
      start: day('2026-03-07'),
      end: day('2026-03-08'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('LEAVE_NO_WORKING_DAYS')
  })

  it('consumes only the working days from the allocation on approval', async () => {
    const uow = new InMemoryUnitOfWork()
    const type = uow.types.seed({
      name: 'Work From Home',
      code: 'WFH',
      unit: 'day',
      requiresAllocation: true,
      autoApprove: true,
      isPaid: true,
      isActive: true,
    })
    const allocation = uow.allocations.seed({
      employeeId,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 30,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    await new RequestLeaveUseCase(
      uow,
      new InMemoryEventBus(),
      fakeEmployees(),
      fakeSchedules(MON_TO_FRI),
    ).execute({ actor: hr, employeeId, timeOffTypeId: type.id, start, end })

    
    const after = await uow.allocations.findById(allocation.id)
    expect(after?.taken).toBe(10)
  })
})
