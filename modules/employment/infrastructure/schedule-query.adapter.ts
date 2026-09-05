/**
 * ScheduleQueryAdapter — implements ScheduleQueryPort for other modules
 * (payroll proration, mainly). `expectedHours`/`expectedDays` delegate to the
 * pure domain functions in weekly-hours.service.ts -- one implementation of
 * "how much of this period does the schedule cover", shared by the unit
 * tests and by real Mongo-backed data.
 */
import type { Period } from '@/modules/shared'
import { expectedDays as computeExpectedDays, expectedHours as computeExpectedHours } from '../domain/weekly-hours.service'
import type { ScheduleQueryPort, ScheduleSnapshot } from '../application/ports/schedule-query.port'
import { WorkingScheduleModel, type WorkingScheduleDoc } from './schedule.model'

function toSnapshot(doc: WorkingScheduleDoc): ScheduleSnapshot {
  return {
    id: String(doc._id),
    name: doc.name,
    weeklyHours: doc.weeklyHours,
    days: doc.days,
  }
}

export class ScheduleQueryAdapter implements ScheduleQueryPort {
  async findById(id: string): Promise<ScheduleSnapshot | null> {
    const doc = await WorkingScheduleModel.findById(id).lean<WorkingScheduleDoc>().exec()
    return doc ? toSnapshot(doc) : null
  }

  async expectedHours(scheduleId: string, period: Period): Promise<number> {
    const schedule = await this.findById(scheduleId)
    if (!schedule) return 0
    return computeExpectedHours(schedule.days, period)
  }

  async expectedDays(scheduleId: string, period: Period): Promise<number> {
    const schedule = await this.findById(scheduleId)
    if (!schedule) return 0
    return computeExpectedDays(schedule.days, period)
  }
}
