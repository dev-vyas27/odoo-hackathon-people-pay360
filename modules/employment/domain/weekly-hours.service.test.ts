import { describe, expect, it } from 'vitest'
import { Period } from '@/modules/shared'
import { computeWeeklyHours, expectedDays, expectedHours, type ScheduleDayPattern } from './weekly-hours.service'

const mondayToFriday9to6WithLunch: ScheduleDayPattern[] = [1, 2, 3, 4, 5].map((day) => ({
  day: day as ScheduleDayPattern['day'],
  start: '09:00',
  end: '18:00',
  breakMinutes: 60,
}))

describe('computeWeeklyHours', () => {
  it('computes a standard 5-day week with a lunch break', () => {
    
    expect(computeWeeklyHours(mondayToFriday9to6WithLunch)).toBe(40)
  })

  it('is zero for an empty pattern', () => {
    expect(computeWeeklyHours([])).toBe(0)
  })

  it('handles an irregular pattern with a short Friday and no Saturday break', () => {
    const days: ScheduleDayPattern[] = [
      { day: 1, start: '09:00', end: '18:00', breakMinutes: 60 }, 
      { day: 2, start: '09:00', end: '18:00', breakMinutes: 60 }, 
      { day: 3, start: '09:00', end: '18:00', breakMinutes: 60 }, 
      { day: 4, start: '09:00', end: '18:00', breakMinutes: 60 }, 
      { day: 5, start: '09:00', end: '13:00', breakMinutes: 0 }, 
      { day: 6, start: '10:00', end: '14:00', breakMinutes: 0 }, 
    ]
    expect(computeWeeklyHours(days)).toBe(40)
  })

  it('sums a split shift: two rows on the same day', () => {
    const days: ScheduleDayPattern[] = [
      { day: 1, start: '09:00', end: '13:00', breakMinutes: 0 }, 
      { day: 1, start: '15:00', end: '19:00', breakMinutes: 0 }, 
    ]
    expect(computeWeeklyHours(days)).toBe(8)
  })

  it('never returns negative hours when a break exceeds the span (bad data guard)', () => {
    const days: ScheduleDayPattern[] = [{ day: 1, start: '09:00', end: '10:00', breakMinutes: 120 }]
    expect(computeWeeklyHours(days)).toBe(0)
  })

  it('rounds to two decimal places', () => {
    const days: ScheduleDayPattern[] = [{ day: 1, start: '09:00', end: '09:20', breakMinutes: 0 }]
    
    expect(computeWeeklyHours(days)).toBe(0.33)
  })
})

describe('expectedDays', () => {
  it('counts only the weekdays the schedule actually covers within the period', () => {
    
    const period = Period.month(2026, 3)
    expect(expectedDays(mondayToFriday9to6WithLunch, period)).toBe(22)
  })

  it('returns 0 for an empty pattern', () => {
    const period = Period.month(2026, 3)
    expect(expectedDays([], period)).toBe(0)
  })

  it('counts a single day pattern correctly for a one-week period', () => {
    
    const wedOnly: ScheduleDayPattern[] = [{ day: 3, start: '09:00', end: '17:00', breakMinutes: 60 }]
    const period = Period.of(new Date('2026-03-02'), new Date('2026-03-08')) 
    expect(expectedDays(wedOnly, period)).toBe(1)
  })
})

describe('expectedHours', () => {
  it('sums scheduled hours across the days the period actually covers', () => {
    const period = Period.month(2026, 3) 
    expect(expectedHours(mondayToFriday9to6WithLunch, period)).toBe(22 * 8)
  })

  it('is zero when the schedule covers none of the period', () => {
    const wedOnly: ScheduleDayPattern[] = [{ day: 3, start: '09:00', end: '17:00', breakMinutes: 60 }]
    
    const period = Period.of(new Date('2026-03-02'), new Date('2026-03-02'))
    expect(expectedHours(wedOnly, period)).toBe(0)
  })

  it('handles an irregular pattern over a partial period', () => {
    const days: ScheduleDayPattern[] = [
      { day: 1, start: '09:00', end: '18:00', breakMinutes: 60 }, 
      { day: 5, start: '09:00', end: '13:00', breakMinutes: 0 }, 
    ]
    
    const period = Period.of(new Date('2026-03-02'), new Date('2026-03-06'))
    expect(expectedHours(days, period)).toBe(12)
  })
})
