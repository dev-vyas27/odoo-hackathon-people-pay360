/**
 * ScheduleLookupAdapter — bridges our narrow ScheduleLookupPort to the
 * employment module's published ScheduleQueryPort.
 *
 * The narrow port stays: exception derivation asks exactly one question ("what
 * was this employee expected to do on this day?") rather than depending on
 * employment's full schedule shape. This adapter is the single place the two
 * modules meet, and it talks only to employment's public surface.
 *
 * Unit tests for attendance use cases never exercise this file — they use
 * FakeScheduleLookup, so the domain stays testable with no database.
 */
import { createScheduleQuery } from '@/modules/employment'
import type { DailySchedule } from '../domain/exception'
import type { ScheduleLookupPort } from '../application/ports/schedule-lookup.port'

/** "HH:mm" -> minutes since midnight. Returns null for malformed input. */
function toMinutes(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export class ScheduleLookupAdapter implements ScheduleLookupPort {
  constructor(
    /** Resolves an employee's assigned working-schedule id (supplied by the caller). */
    private readonly workingScheduleIdFor: (employeeId: string) => Promise<string | null>,
  ) {}

  async scheduleForDay(employeeId: string, date: Date): Promise<DailySchedule | null> {
    const scheduleId = await this.workingScheduleIdFor(employeeId)
    if (!scheduleId) return null

    const snapshot = await createScheduleQuery().findById(scheduleId)
    if (!snapshot) return null

    // Not every weekday is a working day — a missing entry means "not expected in".
    const dayOfWeek = date.getUTCDay()
    const day = snapshot.days.find((d) => d.day === dayOfWeek)
    if (!day) return null

    const start = toMinutes(day.start)
    const end = toMinutes(day.end)
    if (start === null || end === null) return null

    // A shift may cross midnight; roll the end forward a day when it does.
    const span = end >= start ? end - start : end + 24 * 60 - start
    const expectedHours = Math.max(0, (span - day.breakMinutes) / 60)

    return { expectedStart: day.start, expectedHours }
  }
}
