/**
 * Weekly hours + payroll proration denominators — spec A3.
 *
 * PURE. `weeklyHours` on a WorkingSchedule is COMPUTED from the day pattern,
 * never typed in by the user; this is the one and only place that computation
 * happens. `expectedHours`/`expectedDays` reuse the same per-day math to
 * answer "how much of `period` does this schedule actually cover" -- the
 * denominators Payroll prorates against.
 */
import type { Period } from '@/modules/shared'

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** One row of a weekly schedule. Multiple rows may share a `day` (a split shift). */
export interface ScheduleDayPattern {
  readonly day: Weekday
  readonly start: string // "HH:mm"
  readonly end: string // "HH:mm"
  readonly breakMinutes: number
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/** Net worked minutes for one pattern row: span minus break, floored at 0 against bad data. */
function rowMinutes(row: ScheduleDayPattern): number {
  const span = toMinutes(row.end) - toMinutes(row.start)
  return Math.max(0, span - row.breakMinutes)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Sum the net hours the pattern allocates to each weekday. Split-shift rows
 * on the same day are added together.
 */
function hoursByWeekday(days: readonly ScheduleDayPattern[]): Map<Weekday, number> {
  const map = new Map<Weekday, number>()
  for (const row of days) {
    map.set(row.day, (map.get(row.day) ?? 0) + rowMinutes(row) / 60)
  }
  return map
}

/** The schedule's total weekly hours. This is what gets stored as `weeklyHours`. */
export function computeWeeklyHours(days: readonly ScheduleDayPattern[]): number {
  const totalMinutes = days.reduce((sum, row) => sum + rowMinutes(row), 0)
  return round2(totalMinutes / 60)
}

/** Count only the calendar days within `period` that the schedule actually covers. */
export function expectedDays(days: readonly ScheduleDayPattern[], period: Period): number {
  const workedWeekdays = new Set(days.map((row) => row.day))
  if (workedWeekdays.size === 0) return 0
  return period.eachDay().filter((date) => workedWeekdays.has(date.getUTCDay() as Weekday)).length
}

/** Sum of scheduled hours across the calendar days within `period` the schedule covers. */
export function expectedHours(days: readonly ScheduleDayPattern[], period: Period): number {
  const perWeekday = hoursByWeekday(days)
  if (perWeekday.size === 0) return 0
  let total = 0
  for (const date of period.eachDay()) {
    total += perWeekday.get(date.getUTCDay() as Weekday) ?? 0
  }
  return round2(total)
}
