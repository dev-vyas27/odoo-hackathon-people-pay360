import { describe, expect, it } from 'vitest'
import type { Actor } from '@/modules/shared'
import { CheckInUseCase } from './check-in.use-case'
import { CheckOutUseCase } from './check-out.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'

function employeeActor(employeeId: string): Actor {
  return { employeeId, role: 'employee', email: 'e@x.com', name: 'Employee' }
}

function otherEmployeeActor(): Actor {
  return { employeeId: 'emp-2', role: 'employee', email: 'other@x.com', name: 'Other' }
}

describe('CheckOutUseCase', () => {
  async function checkedIn(repo: InMemoryAttendanceRepository, schedule = new FakeScheduleLookup()) {
    const checkInUseCase = new CheckInUseCase(repo, schedule)
    const result = await checkInUseCase.execute({
      actor: employeeActor('emp-1'),
      employeeId: 'emp-1',
      checkIn: new Date('2026-03-10T09:00:00Z'),
    })
    if (!result.ok) throw new Error('setup failed')
    return result.value.attendance.id
  }

  it('completes the record and reports present when on schedule', async () => {
    const repo = new InMemoryAttendanceRepository()
    const schedule = new FakeScheduleLookup({ expectedStart: '09:00', expectedHours: 8 })
    const id = await checkedIn(repo, schedule)

    const useCase = new CheckOutUseCase(repo, schedule)
    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      attendanceId: id,
      checkOut: new Date('2026-03-10T17:00:00Z'),
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.status).toBe('present')
  })

  it('forbids checking out someone else\'s record', async () => {
    const repo = new InMemoryAttendanceRepository()
    const id = await checkedIn(repo)

    const useCase = new CheckOutUseCase(repo, new FakeScheduleLookup())
    const result = await useCase.execute({
      actor: otherEmployeeActor(),
      attendanceId: id,
      checkOut: new Date('2026-03-10T17:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })

  it('returns not_found for an unknown attendance id', async () => {
    const repo = new InMemoryAttendanceRepository()
    const useCase = new CheckOutUseCase(repo, new FakeScheduleLookup())

    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      attendanceId: 'missing',
      checkOut: new Date('2026-03-10T17:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('not_found')
  })

  it('surfaces invalid worked-hours maths as a domain error', async () => {
    const repo = new InMemoryAttendanceRepository()
    const id = await checkedIn(repo)

    const useCase = new CheckOutUseCase(repo, new FakeScheduleLookup())
    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      attendanceId: id,
      checkOut: new Date('2026-03-10T09:30:00Z'),
      breakMinutes: 60,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BREAK_EXCEEDS_SHIFT')
  })
})
