import { describe, expect, it } from 'vitest'
import { InMemoryEventBus, Period, unwrap, type Actor } from '@/modules/shared'
import { RequestLeaveUseCase } from './request-leave.use-case'
import { UpdateLeaveUseCase } from './update-leave.use-case'
import { ApproveLeaveUseCase } from './approve-leave.use-case'
import { DeleteLeaveUseCase } from './submit-leave.use-case'
import { InMemoryUnitOfWork } from './test-support/in-memory-unit-of-work'
import { fakeEmployees, fakeSchedules } from './test-support/fake-schedule-lookup'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const EMPLOYEE = 'employee-1'
const OTHER = 'employee-2'

const employee: Actor = {
  employeeId: EMPLOYEE,
  role: 'employee',
  email: 'priya@co.com',
  name: 'Priya',
}
const colleague: Actor = { ...employee, employeeId: OTHER, email: 'rahul@co.com', name: 'Rahul' }
const hr: Actor = { employeeId: 'hr-1', role: 'hr_manager', email: 'hr@co.com', name: 'HR' }

function seedType(uow: InMemoryUnitOfWork, requiresAllocation = true) {
  return uow.types.seed({
    name: 'Paid Time Off',
    code: 'PL',
    unit: 'day',
    requiresAllocation,
    autoApprove: false,
    isPaid: true,
    isActive: true,
  })
}

async function pendingRequest(uow: InMemoryUnitOfWork, requiresAllocation = true) {
  const type = seedType(uow, requiresAllocation)
  const allocation = uow.allocations.seed({
    employeeId: EMPLOYEE,
    timeOffTypeId: type.id,
    unit: 'day',
    allocated: 20,
    taken: 0,
    validity: Period.of(day('2026-01-01'), day('2026-12-31')),
    status: 'approved',
  })

  const created = unwrap(
    await new RequestLeaveUseCase(
      uow,
      new InMemoryEventBus(),
      fakeEmployees(),
      fakeSchedules(),
    ).execute({
      actor: employee,
      employeeId: EMPLOYEE,
      timeOffTypeId: type.id,
      start: day('2026-03-02'),
      end: day('2026-03-06'),
    }),
  )

  return { type, allocation, created }
}

const updater = (uow: InMemoryUnitOfWork) =>
  new UpdateLeaveUseCase(uow, fakeEmployees(), fakeSchedules())

describe('amending a pending request', () => {
  it('moves the dates and re-derives the duration from working days', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)
    expect(created.status).toBe('to_approve')
    expect(created.duration).toBe(5)

    const amended = unwrap(
      await updater(uow).execute({
        actor: employee,
        requestId: created.id,
        start: day('2026-03-02'),
        end: day('2026-03-04'),
      }),
    )

    expect(amended.duration).toBe(3)

    expect(amended.status).toBe('to_approve')
    expect(amended.id).toBe(created.id)
  })

  it('does not overlap itself when the dates barely move', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)

    const amended = await updater(uow).execute({
      actor: employee,
      requestId: created.id,
      start: day('2026-03-03'),
      end: day('2026-03-06'),
    })

    expect(amended.ok).toBe(true)
  })

  it('changes only the reason without touching the duration', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)

    const amended = unwrap(
      await updater(uow).execute({
        actor: employee,
        requestId: created.id,
        reason: 'Family wedding',
      }),
    )

    expect(amended.reason).toBe('Family wedding')
    expect(amended.duration).toBe(created.duration)
    expect(amended.start).toBe(created.start)
  })

  it('refuses to amend somebody else’s request', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)

    const attempt = await updater(uow).execute({
      actor: colleague,
      requestId: created.id,
      reason: 'Not mine to change',
    })

    expect(attempt.ok).toBe(false)
  })

  it('still refuses when the new dates clash with a DIFFERENT request', async () => {
    const uow = new InMemoryUnitOfWork()
    const { type, created } = await pendingRequest(uow)

    const second = unwrap(
      await new RequestLeaveUseCase(
        uow,
        new InMemoryEventBus(),
        fakeEmployees(),
        fakeSchedules(),
      ).execute({
        actor: employee,
        employeeId: EMPLOYEE,
        timeOffTypeId: type.id,
        start: day('2026-03-16'),
        end: day('2026-03-20'),
      }),
    )

    const clash = await updater(uow).execute({
      actor: employee,
      requestId: created.id,
      start: day('2026-03-16'),
      end: day('2026-03-20'),
    })

    expect(clash.ok).toBe(false)
    if (clash.ok) return
    expect(clash.error.code).toBe('LEAVE_OVERLAP')
    expect(second.id).not.toBe(created.id)
  })

  it('refuses to stretch a request beyond the remaining balance', async () => {
    const uow = new InMemoryUnitOfWork()
    const type = seedType(uow)
    uow.allocations.seed({
      employeeId: EMPLOYEE,
      timeOffTypeId: type.id,
      unit: 'day',
      allocated: 5,
      taken: 0,
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
      status: 'approved',
    })

    const created = unwrap(
      await new RequestLeaveUseCase(
        uow,
        new InMemoryEventBus(),
        fakeEmployees(),
        fakeSchedules(),
      ).execute({
        actor: employee,
        employeeId: EMPLOYEE,
        timeOffTypeId: type.id,
        start: day('2026-03-02'),
        end: day('2026-03-06'),
      }),
    )

    const tooLong = await updater(uow).execute({
      actor: employee,
      requestId: created.id,
      start: day('2026-03-02'),
      end: day('2026-03-20'),
    })

    expect(tooLong.ok).toBe(false)
    if (tooLong.ok) return
    expect(tooLong.error.code).toBe('INSUFFICIENT_BALANCE')
  })
})

describe('once a decision has been made', () => {
  it('cannot be amended', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)

    unwrap(
      await new ApproveLeaveUseCase(uow, new InMemoryEventBus()).execute({
        actor: hr,
        requestId: created.id,
      }),
    )

    const attempt = await updater(uow).execute({
      actor: employee,
      requestId: created.id,
      reason: 'Too late',
    })

    expect(attempt.ok).toBe(false)
    if (attempt.ok) return
    expect(attempt.error.code).toBe('LEAVE_NOT_EDITABLE')
  })

  it('cannot be withdrawn — refusing it is the only way back', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)

    unwrap(
      await new ApproveLeaveUseCase(uow, new InMemoryEventBus()).execute({
        actor: hr,
        requestId: created.id,
      }),
    )

    const attempt = await new DeleteLeaveUseCase(uow).execute({
      actor: employee,
      requestId: created.id,
    })

    expect(attempt.ok).toBe(false)
    if (attempt.ok) return
    expect(attempt.error.code).toBe('LEAVE_NOT_EDITABLE')
  })
})

describe('withdrawing a pending request', () => {
  it('removes it, and consumes no balance on the way out', async () => {
    const uow = new InMemoryUnitOfWork()
    const { allocation, created } = await pendingRequest(uow)

    const withdrawn = await new DeleteLeaveUseCase(uow).execute({
      actor: employee,
      requestId: created.id,
    })

    expect(withdrawn.ok).toBe(true)
    expect(await uow.repos.requests.findById(created.id)).toBeNull()

    expect(uow.allocations.rows.get(allocation.id)?.taken).toBe(0)
  })

  it('refuses to withdraw somebody else’s request', async () => {
    const uow = new InMemoryUnitOfWork()
    const { created } = await pendingRequest(uow)

    const attempt = await new DeleteLeaveUseCase(uow).execute({
      actor: colleague,
      requestId: created.id,
    })

    expect(attempt.ok).toBe(false)
  })
})
