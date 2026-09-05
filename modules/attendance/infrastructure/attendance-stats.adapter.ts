/**
 * AttendanceStatsAdapter — the real implementation of AttendanceStatsPort.
 *
 * Every method here is a single aggregation pipeline. `status` and
 * `workedHours` are pre-computed and stored on the document at write time
 * (see mongo-attendance.repository.ts), which is what makes summary() a
 * single $group with conditional accumulators instead of a fetch-then-count
 * in JavaScript.
 */
import type { Period } from '@/modules/shared'
import { AttendanceModel } from './attendance.model'
import type { AttendanceStatsPort, AttendanceSummary } from '../application/ports/attendance-stats.port'

/** Period is inclusive on both ends at day granularity; Mongo needs a half-open range. */
function periodRange(period: Period): { $gte: Date; $lt: Date } {
  const exclusiveEnd = new Date(period.end.getTime() + 24 * 60 * 60 * 1000)
  return { $gte: period.start, $lt: exclusiveEnd }
}

/** "YYYY-MM-DD" of checkIn, in UTC — used to count distinct worked days. */
const DAY_KEY_EXPR = { $dateToString: { format: '%Y-%m-%d', date: '$checkIn', timezone: 'UTC' } }

export class AttendanceStatsAdapter implements AttendanceStatsPort {
  async workedHours(employeeId: string, period: Period): Promise<number> {
    const [row] = await AttendanceModel.aggregate<{ total: number }>([
      { $match: { employeeId, checkIn: periodRange(period), workedHours: { $ne: null } } },
      { $group: { _id: null, total: { $sum: '$workedHours' } } },
    ]).exec()
    return row?.total ?? 0
  }

  async workedDays(employeeId: string, period: Period): Promise<number> {
    const result = await this.workedDaysForMany([employeeId], period)
    return result.get(employeeId) ?? 0
  }

  async workedDaysForMany(employeeIds: string[], period: Period): Promise<Map<string, number>> {
    const map = new Map<string, number>(employeeIds.map((id) => [id, 0]))
    if (employeeIds.length === 0) return map

    const rows = await AttendanceModel.aggregate<{ _id: string; days: number }>([
      {
        $match: {
          employeeId: { $in: employeeIds },
          checkIn: periodRange(period),
          checkOut: { $ne: null },
        },
      },
      { $group: { _id: { employeeId: '$employeeId', day: DAY_KEY_EXPR } } },
      { $group: { _id: '$_id.employeeId', days: { $sum: 1 } } },
    ]).exec()

    for (const row of rows) map.set(row._id, row.days)
    return map
  }

  async summary(period: Period, departmentId?: string): Promise<AttendanceSummary> {
    const match: Record<string, unknown> = { checkIn: periodRange(period) }
    if (departmentId) match.departmentId = departmentId

    const [row] = await AttendanceModel.aggregate<AttendanceSummary>([
      { $match: match },
      {
        $group: {
          _id: null,
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          overtimeHours: {
            $sum: {
              $cond: [{ $eq: ['$status', 'overtime'] }, { $ifNull: ['$workedHours', 0] }, 0],
            },
          },
          missingCheckouts: { $sum: { $cond: [{ $eq: ['$status', 'missing_checkout'] }, 1, 0] } },
          manualEdits: { $sum: { $cond: ['$manual', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          present: 1,
          late: 1,
          absent: 1,
          overtimeHours: 1,
          missingCheckouts: 1,
          manualEdits: 1,
        },
      },
    ]).exec()

    return (
      row ?? {
        present: 0,
        late: 0,
        absent: 0,
        overtimeHours: 0,
        missingCheckouts: 0,
        manualEdits: 0,
      }
    )
  }
}
