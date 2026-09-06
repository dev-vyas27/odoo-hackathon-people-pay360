

import { query, queryOne } from '@/lib/db'
import type { Period, ScheduleQueryPort, ScheduleSnapshot } from '@/modules/shared'
import {
  expectedDays as expectedDaysPure,
  expectedHours as expectedHoursPure,
  type ScheduleDayPattern,
} from '../domain/weekly-hours.service'
import {
  SCHEDULES_TABLE,
  SCHEDULE_DAYS_TABLE,
  toClock,
  type ScheduleDayRow,
  type ScheduleRow,
} from './employment.tables'

async function loadDays(scheduleId: string): Promise<ScheduleDayPattern[]> {
  const rows = await query<ScheduleDayRow>(
    `SELECT * FROM "${SCHEDULE_DAYS_TABLE}" WHERE working_schedule_id = $1 ORDER BY day_of_week`,
    [scheduleId],
  )
  return rows.map((d) => ({
    day: d.day_of_week as ScheduleDayPattern['day'],
    start: toClock(d.starts_at),
    end: toClock(d.ends_at),
    breakMinutes: d.break_minutes,
  }))
}

export class PostgresScheduleQuery implements ScheduleQueryPort {
  async findById(id: string): Promise<ScheduleSnapshot | null> {
    const row = await queryOne<ScheduleRow>(
      `SELECT id, name, weekly_hours FROM "${SCHEDULES_TABLE}" WHERE id = $1`,
      [id],
    )
    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      weeklyHours: Number(row.weekly_hours),
      days: await loadDays(row.id),
    }
  }

  async expectedHours(scheduleId: string, period: Period): Promise<number> {
    return expectedHoursPure(await loadDays(scheduleId), period)
  }

  async expectedDays(scheduleId: string, period: Period): Promise<number> {
    return expectedDaysPure(await loadDays(scheduleId), period)
  }
}
