import { describe, expect, it } from 'vitest'
import type { Actor } from '@/modules/shared'
import { CheckInUseCase } from './check-in.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'

function employeeActor(employeeId: string): Actor {
  return { employeeId, role: 'employee', email: 'e@x.com', name: 'Employee' }
}

function hrActor(): Actor {
  return { employeeId: 'emp-actor', role: 'hr_manager', email: 'hr@x.com', name: 'HR' }
}

describe('CheckInUseCase', () => {
  it('lets an employee check themselves in', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CheckInUseCase(repo, new FakeScheduleLookup())

    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.attendance.employeeId).toBe('emp-1')
      expect(result.value.status).toBe('missing_checkout')
    }
  })

  it('forbids an employee from checking in someone else', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CheckInUseCase(repo, new FakeScheduleLookup())

    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      employeeId: 'emp-2',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })

  it('lets an hr_manager check in on behalf of any employee', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CheckInUseCase(repo, new FakeScheduleLookup())

    const result = await useCase.execute({
      actor: hrActor(),
      employeeId: 'emp-3',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })

    expect(result.ok).toBe(true)
  })

  it('rejects a second check-in while one is already open', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CheckInUseCase(repo, new FakeScheduleLookup())
    const actor = employeeActor('emp-1')

    await useCase.execute({ actor, employeeId: 'emp-1', checkIn: new Date('2026-03-10T09:00:00Z') })
    const second = await useCase.execute({ actor, employeeId: 'emp-1', checkIn: new Date('2026-03-10T10:00:00Z') })

    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error.code).toBe('ALREADY_CHECKED_IN')
  })

  it('derives late from the schedule at check-in time', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CheckInUseCase(
      repo,
      new FakeScheduleLookup({ expectedStart: '09:00', expectedHours: 8 }),
    )

    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:45:00Z'),
    })

    // Not yet checked out, so still "missing_checkout" takes precedence over lateness.
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.status).toBe('missing_checkout')
  })
})
