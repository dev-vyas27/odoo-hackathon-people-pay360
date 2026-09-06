

import { createScheduleQuery } from '@/modules/employment'
import type { DailySchedule } from '../domain/exception'
import type { ScheduleLookupPort } from '../application/ports/schedule-lookup.port'

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
    
    private readonly workingScheduleIdFor: (employeeId: string) => Promise<string | null>,
  ) {}

  async scheduleForDay(employeeId: string, date: Date): Promise<DailySchedule | null> {
    const scheduleId = await this.workingScheduleIdFor(employeeId)
    if (!scheduleId) return null

    const snapshot = await createScheduleQuery().findById(scheduleId)
    if (!snapshot) return null

    
    const dayOfWeek = date.getUTCDay()
    const day = snapshot.days.find((d) => d.day === dayOfWeek)
    if (!day) return null

    const start = toMinutes(day.start)
    const end = toMinutes(day.end)
    if (start === null || end === null) return null

    
    const span = end >= start ? end - start : end + 24 * 60 - start
    const expectedHours = Math.max(0, (span - day.breakMinutes) / 60)

    return { expectedStart: day.start, expectedHours }
  }
}
