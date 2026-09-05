import { describe, expect, it } from 'vitest'
import { deriveStatus, type DailySchedule } from './exception'

const d = (iso: string) => new Date(iso)

const schedule: DailySchedule = { expectedStart: '09:00', expectedHours: 8 }

describe('deriveStatus', () => {
  it('reports manual regardless of the numbers', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T12:00:00Z'), checkOut: null, workedHours: null, manual: true },
      schedule,
    )
    expect(status).toBe('manual')
  })

  it('reports absent when there is no check-in', () => {
    const status = deriveStatus({ checkIn: null, checkOut: null, workedHours: null, manual: false }, schedule)
    expect(status).toBe('absent')
  })

  it('reports missing_checkout when checked in but never out', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T09:00:00Z'), checkOut: null, workedHours: null, manual: false },
      schedule,
    )
    expect(status).toBe('missing_checkout')
  })

  it('reports present for an on-time, on-schedule day', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T09:00:00Z'), checkOut: d('2026-03-10T17:00:00Z'), workedHours: 8, manual: false },
      schedule,
    )
    expect(status).toBe('present')
  })

  it('reports late when check-in is after the expected start plus grace', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T09:30:00Z'), checkOut: d('2026-03-10T17:30:00Z'), workedHours: 8, manual: false },
      { ...schedule, lateGraceMinutes: 10 },
    )
    expect(status).toBe('late')
  })

  it('does not report late when check-in is within the grace window', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T09:05:00Z'), checkOut: d('2026-03-10T17:05:00Z'), workedHours: 8, manual: false },
      { ...schedule, lateGraceMinutes: 10 },
    )
    expect(status).toBe('present')
  })

  it('reports overtime when worked hours exceed the threshold', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T09:00:00Z'), checkOut: d('2026-03-10T20:00:00Z'), workedHours: 11, manual: false },
      schedule,
    )
    expect(status).toBe('overtime')
  })

  it('falls back to present when no schedule is available', () => {
    const status = deriveStatus(
      { checkIn: d('2026-03-10T13:00:00Z'), checkOut: d('2026-03-10T14:00:00Z'), workedHours: 1, manual: false },
      null,
    )
    expect(status).toBe('present')
  })
})
