import { describe, expect, it } from 'vitest'
import { Attendance } from './attendance'

const d = (iso: string) => new Date(iso)

function checkedIn(overrides: Partial<{ employeeId: string; checkIn: Date; breakMinutes: number }> = {}) {
  const result = Attendance.checkIn({
    employeeId: overrides.employeeId ?? 'emp-1',
    checkIn: overrides.checkIn ?? d('2026-03-10T09:00:00Z'),
    breakMinutes: overrides.breakMinutes,
  })
  if (!result.ok) throw new Error('expected checkIn to succeed in test setup')
  return result.value
}

describe('Attendance.checkIn', () => {
  it('creates an open record with no worked hours yet', () => {
    const att = checkedIn()
    expect(att.checkOut).toBeNull()
    expect(att.manual).toBe(false)
    expect(att.workedHours().ok).toBe(false)
  })

  it('rejects a negative break', () => {
    const result = Attendance.checkIn({ employeeId: 'emp-1', checkIn: d('2026-03-10T09:00:00Z'), breakMinutes: -5 })
    expect(result.ok).toBe(false)
  })
})

describe('Attendance.recordCheckOut', () => {
  it('completes the record and makes worked hours computable', () => {
    const att = checkedIn()
    const result = att.recordCheckOut(d('2026-03-10T17:30:00Z'), 30)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const hours = result.value.workedHours()
      expect(hours.ok).toBe(true)
      if (hours.ok) expect(hours.value).toBe(8)
    }
  })

  it('rejects checking out twice', () => {
    const att = checkedIn()
    const first = att.recordCheckOut(d('2026-03-10T17:00:00Z'))
    if (!first.ok) throw new Error('setup failed')
    const second = first.value.recordCheckOut(d('2026-03-10T18:00:00Z'))
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error.code).toBe('ALREADY_CHECKED_OUT')
  })

  it('rejects a checkout whose break exceeds the shift', () => {
    const att = checkedIn()
    const result = att.recordCheckOut(d('2026-03-10T09:30:00Z'), 60)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BREAK_EXCEEDS_SHIFT')
  })
})

describe('Attendance.correct', () => {
  it('flips manual on and recomputes worked hours', () => {
    const att = checkedIn()
    const corrected = att.correct({ checkOut: d('2026-03-10T18:00:00Z'), breakMinutes: 60 })
    expect(corrected.ok).toBe(true)
    if (corrected.ok) {
      expect(corrected.value.manual).toBe(true)
      const hours = corrected.value.workedHours()
      expect(hours.ok).toBe(true)
      if (hours.ok) expect(hours.value).toBe(8)
    }
  })

  it('allows a correction that still leaves the record open', () => {
    const att = checkedIn()
    const corrected = att.correct({ checkIn: d('2026-03-10T08:45:00Z') })
    expect(corrected.ok).toBe(true)
    if (corrected.ok) {
      expect(corrected.value.manual).toBe(true)
      expect(corrected.value.checkOut).toBeNull()
    }
  })

  it('rejects a correction with invalid worked-hours maths', () => {
    const att = checkedIn()
    const corrected = att.correct({ checkOut: d('2026-03-10T09:30:00Z'), breakMinutes: 60 })
    expect(corrected.ok).toBe(false)
  })
})

describe('Attendance.status', () => {
  it('is manual after a correction, even if the schedule would say otherwise', () => {
    const att = checkedIn()
    const corrected = att.correct({ checkOut: d('2026-03-10T20:00:00Z') })
    if (!corrected.ok) throw new Error('setup failed')
    expect(corrected.value.status(null)).toBe('manual')
  })

  it('is missing_checkout before check-out is recorded', () => {
    const att = checkedIn()
    expect(att.status(null)).toBe('missing_checkout')
  })
})
