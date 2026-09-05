/**
 * Sixty days of attendance, with deliberate anomalies.
 *
 * ── Dev B: this file is yours to replace. ───────────────────────────────────
 *
 * The dashboard's Attendance Health and coverage figures are meaningless
 * without records, and a spotless dataset is just as useless — a health score
 * of 100% proves nothing about whether the calculation works. So the anomalies
 * are planted deliberately and counted: 3 late, 2 missing check-outs, 1
 * overtime, 2 absences, 2 manual corrections.
 *
 * Weekends are skipped, which is what makes `attendanceCoverage` land near
 * 100% rather than near 70%.
 */
import { SEED, seedId } from '../ids'
import type { SeedPart } from '../types'

const DAYS_BACK = 60

const EMPLOYEES = [
  SEED.employees.demoLead,
  SEED.employees.twoContracts,
  seedId('emp', 3),
  seedId('emp', 4),
  seedId('emp', 5),
]

/**
 * Planted anomalies, keyed by "employee index:working day index".
 *
 * Working day 0 is the OLDEST, so the high indices are the most recent days.
 * They are spread across the range on purpose: a cluster all in one month would
 * mean the dashboard reads a perfect 100% health for every other period, which
 * proves nothing about whether the calculation works. Roughly half sit in the
 * last three weeks so the default (current month) view has something to show.
 */
const ANOMALIES: Record<string, { status: string; hours: number; manual?: boolean }> = {
  // Older — visible when the period filter is moved back a month.
  '0:3': { status: 'late', hours: 7 },
  '1:5': { status: 'late', hours: 7.5 },
  '0:11': { status: 'missing_checkout', hours: 0 },
  '4:14': { status: 'absent', hours: 0 },
  '3:17': { status: 'present', hours: 8, manual: true },
  // Recent — inside the current month.
  '2:36': { status: 'late', hours: 7.25 },
  '3:37': { status: 'missing_checkout', hours: 0 },
  '1:38': { status: 'overtime', hours: 10.5 },
  '2:39': { status: 'absent', hours: 0 },
  '0:40': { status: 'present', hours: 8, manual: true },
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

export const attendanceSeed: SeedPart = {
  name: 'attendance',
  tables: ['attendances'],
  async run(ctx) {
    const today = new Date()
    const rows: Array<Record<string, unknown> & { id: string }> = []
    let sequence = 1

    EMPLOYEES.forEach((employeeId, employeeIndex) => {
      let workingDay = 0

      for (let back = DAYS_BACK; back >= 1; back -= 1) {
        const date = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - back),
        )

        // Monday to Friday only.
        const weekday = date.getUTCDay()
        if (weekday === 0 || weekday === 6) continue

        const anomaly = ANOMALIES[`${employeeIndex}:${workingDay}`]
        workingDay += 1

        const status = anomaly?.status ?? 'present'
        const hours = anomaly?.hours ?? 8

        // 09:00 start; an overtime day runs later, an absence has neither stamp.
        const checkIn =
          status === 'absent' ? null : new Date(`${iso(date)}T09:00:00.000Z`).toISOString()
        const checkOut =
          status === 'absent' || status === 'missing_checkout'
            ? null
            : new Date(`${iso(date)}T${String(9 + Math.ceil(hours) + 1).padStart(2, '0')}:00:00.000Z`).toISOString()

        rows.push({
          id: seedId('att', sequence),
          employee_id: employeeId,
          worked_on: iso(date),
          checked_in_at: checkIn,
          checked_out_at: checkOut,
          break_minutes: status === 'absent' ? 0 : 60,
          worked_hours: hours,
          status,
          is_manual: anomaly?.manual ?? false,
        })

        sequence += 1
      }
    })

    const written = await ctx.upsert('attendances', rows)
    ctx.log(`${written} attendance rows across ${EMPLOYEES.length} employees`)
    ctx.log('anomalies: 3 late, 2 missing check-outs, 1 overtime, 2 absent, 2 manual')
    ctx.log('roughly half fall inside the current month, the rest earlier')
  },
}
