/**
 * exception.ts — status derivation. PURE.
 *
 * Attendance and Employment meet here: we compare what actually happened
 * (check-in time, worked hours) against the employee's assigned working
 * schedule for that calendar day. The schedule itself is never imported
 * directly — it arrives as a plain `DailySchedule` shaped by the narrow
 * `ScheduleLookupPort` in application/ports/, which is the only place that
 * talks to the employment module.
 *
 * Precedence (first match wins):
 *  1. `manual`            — a corrected record always reports as manual,
 *                            regardless of what the numbers would otherwise say.
 *  2. `absent`             — no check-in at all for an expected working day.
 *  3. `missing_checkout`   — checked in, never checked out.
 *  4. `overtime`           — worked hours exceed the schedule's threshold.
 *  5. `late`               — check-in is after the schedule's expected start
 *                            (beyond the grace window).
 *  6. `present`            — everything else, including when there is no
 *                            schedule to compare against.
 */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'overtime' | 'missing_checkout' | 'manual'

/** The slice of a working schedule needed to judge a single day's attendance. */
export interface DailySchedule {
  /** "HH:mm" the employee is expected to start, in the same clock the check-in Date uses (UTC). */
  expectedStart: string
  /** Hours the employee is expected to work this day. */
  expectedHours: number
  /** Minutes of grace before a late check-in counts as late. Defaults to 0. */
  lateGraceMinutes?: number
  /** Hours worked beyond which the day counts as overtime. Defaults to expectedHours. */
  overtimeThresholdHours?: number
}

export interface ExceptionInput {
  checkIn: Date | null
  checkOut: Date | null
  /** Pre-computed by worked-hours.service; null when it could not be computed. */
  workedHours: number | null
  manual: boolean
}

function toMinutesSinceMidnightUtc(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

function parseHHmm(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function deriveStatus(input: ExceptionInput, schedule: DailySchedule | null): AttendanceStatus {
  if (input.manual) return 'manual'
  if (!input.checkIn) return 'absent'
  if (!input.checkOut) return 'missing_checkout'

  const worked = input.workedHours ?? 0

  if (schedule) {
    const overtimeThreshold = schedule.overtimeThresholdHours ?? schedule.expectedHours
    if (worked > overtimeThreshold) return 'overtime'

    const grace = schedule.lateGraceMinutes ?? 0
    const expectedStartMinutes = parseHHmm(schedule.expectedStart)
    const checkInMinutes = toMinutesSinceMidnightUtc(input.checkIn)
    if (checkInMinutes > expectedStartMinutes + grace) return 'late'
  }

  return 'present'
}
