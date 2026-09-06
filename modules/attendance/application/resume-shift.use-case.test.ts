import { beforeEach, describe, expect, it } from 'vitest'
import { CheckInUseCase } from './check-in.use-case'
import { CheckOutUseCase } from './check-out.use-case'
import { GetTodayAttendanceUseCase } from './get-today-attendance.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'
import type { Actor } from '@/modules/shared'




const EMPLOYEE = '656d7000-0000-4000-8000-000000000001'

const employee: Actor = {
  employeeId: EMPLOYEE,
  role: 'employee',
  email: 'priya@example.com',
  name: 'Priya Sharma',
}



const ist = (day: string, hhmm: string) => {
  const [year, month, date] = day.split('-').map(Number)
  const [hours, minutes] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, date, hours, minutes) - 5.5 * 3600_000)
}

describe('a day with a break in the middle of it', () => {
  let repo: InMemoryAttendanceRepository
  let checkIn: CheckInUseCase
  let checkOut: CheckOutUseCase

  beforeEach(() => {
    repo = new InMemoryAttendanceRepository()
    checkIn = new CheckInUseCase(repo, new FakeScheduleLookup())
    checkOut = new CheckOutUseCase(repo, new FakeScheduleLookup())
  })

  it('turns the gap between check-out and the next check-in into break minutes', async () => {
    const opened = await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '09:00'),
      workMode: 'office',
    })
    expect(opened.ok).toBe(true)
    if (!opened.ok) return

    const closed = await checkOut.execute({
      actor: employee,
      attendanceId: opened.value.attendance.id,
      checkOut: ist('2026-03-10', '13:00'),
    })
    expect(closed.ok).toBe(true)

    
    const resumed = await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '13:45'),
      workMode: 'home',
    })
    expect(resumed.ok).toBe(true)
    if (!resumed.ok) return

    expect(resumed.value.attendance.breakMinutes).toBe(45)
    expect(resumed.value.attendance.isOpen).toBe(true)
    
    expect(resumed.value.attendance.id).toBe(opened.value.attendance.id)
    
    expect(resumed.value.attendance.workMode).toBe('home')
  })

  it('deducts the break from worked hours when the day is finally closed', async () => {
    const opened = await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '09:00'),
    })
    if (!opened.ok) throw new Error('setup failed')

    await checkOut.execute({
      actor: employee,
      attendanceId: opened.value.attendance.id,
      checkOut: ist('2026-03-10', '13:00'),
    })
    await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '14:00'),
    })
    const final = await checkOut.execute({
      actor: employee,
      attendanceId: opened.value.attendance.id,
      checkOut: ist('2026-03-10', '18:00'),
    })

    expect(final.ok).toBe(true)
    if (!final.ok) return
    
    expect(final.value.attendance.workedHoursOrNull()).toBe(8)
  })

  it('refuses a second check-in while the shift is still open', async () => {
    await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '09:00'),
    })
    const again = await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '09:30'),
    })

    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.error.code).toBe('ALREADY_CHECKED_IN')
  })
})

describe('a shift nobody closed', () => {
  it('is auto-closed against its own day, so the next one can start', async () => {
    const repo = new InMemoryAttendanceRepository()
    const checkIn = new CheckInUseCase(repo, new FakeScheduleLookup())

    
    const forgotten = await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-09', '09:00'),
    })
    if (!forgotten.ok) throw new Error('setup failed')

    


    const tuesday = await checkIn.execute({
      actor: employee,
      employeeId: EMPLOYEE,
      checkIn: ist('2026-03-10', '09:00'),
    })
    expect(tuesday.ok).toBe(true)
    if (!tuesday.ok) return
    expect(tuesday.value.attendance.id).not.toBe(forgotten.value.attendance.id)

    const monday = await repo.findById(forgotten.value.attendance.id)
    expect(monday?.attendance.isOpen).toBe(false)
    
    expect(monday?.attendance.checkOut?.toISOString().slice(0, 10)).toBe('2026-03-09')
  })
})

describe('the clock widget’s view of today', () => {
  it('reports nothing started before the first check-in', async () => {
    const repo = new InMemoryAttendanceRepository()
    const today = await new GetTodayAttendanceUseCase(repo).execute({
      actor: employee,
      employeeId: EMPLOYEE,
    })

    expect(today.ok).toBe(true)
    if (!today.ok) return
    expect(today.value.state).toBe('not_started')
    expect(today.value.workedMinutes).toBe(0)
  })

  it('refuses to report on somebody else', async () => {
    const repo = new InMemoryAttendanceRepository()
    const other = await new GetTodayAttendanceUseCase(repo).execute({
      actor: employee,
      employeeId: '656d7000-0000-4000-8000-000000000099',
    })

    expect(other.ok).toBe(false)
  })
})
