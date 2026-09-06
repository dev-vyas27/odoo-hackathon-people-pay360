

import type { Period } from '@/modules/shared'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ScheduleDayPattern {
  readonly day: Weekday
  readonly start: string 
  readonly end: string 
  readonly breakMinutes: number
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function rowMinutes(row: ScheduleDayPattern): number {
  const span = toMinutes(row.end) - toMinutes(row.start)
  return Math.max(0, span - row.breakMinutes)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function hoursByWeekday(days: readonly ScheduleDayPattern[]): Map<Weekday, number> {
  const map = new Map<Weekday, number>()
  for (const row of days) {
    map.set(row.day, (map.get(row.day) ?? 0) + rowMinutes(row) / 60)
  }
  return map
}

export function computeWeeklyHours(days: readonly ScheduleDayPattern[]): number {
  const totalMinutes = days.reduce((sum, row) => sum + rowMinutes(row), 0)
  return round2(totalMinutes / 60)
}

export function expectedDays(days: readonly ScheduleDayPattern[], period: Period): number {
  const workedWeekdays = new Set(days.map((row) => row.day))
  if (workedWeekdays.size === 0) return 0
  return period.eachDay().filter((date) => workedWeekdays.has(date.getUTCDay() as Weekday)).length
}

export function expectedHours(days: readonly ScheduleDayPattern[], period: Period): number {
  const perWeekday = hoursByWeekday(days)
  if (perWeekday.size === 0) return 0
  let total = 0
  for (const date of period.eachDay()) {
    total += perWeekday.get(date.getUTCDay() as Weekday) ?? 0
  }
  return round2(total)
}
