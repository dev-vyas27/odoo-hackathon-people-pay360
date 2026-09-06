/**
 * Forty-five days of attendance across the whole workforce.
 *
 * The dashboard's Attendance Health and coverage figures are meaningless
 * without records, and a spotless dataset is just as useless — a health score
 * of 100% proves nothing about whether the calculation works. So exceptions are
 * generated at realistic rates rather than planted one by one:
 *
 *   late              4%
 *   absent            1.6%
 *   overtime          1.2%
 *   missing_checkout  0.9%
 *   manually edited   1%   (of otherwise-present days)
 *
 * That lands health in the low nineties, which is what a real company looks
 * like and what makes the number worth reading.
 *
 * Weekends are skipped, which is what makes coverage land near 100% rather than
 * near 70%. Each person's working days come from their own schedule, so the
 * Compressed 36h staff correctly have no Friday.
 */
import { seedId } from '../ids'
import { IST_OFFSET_MS } from '@/modules/shared'
import { ACTIVE_ROSTER, SCHEDULES } from '../roster'
import type { SeedPart, SeedRow } from '../types'

const DAYS_BACK = 45

/** Which weekdays each schedule works, and the hours a normal day carries. */
const PATTERN: Record<string, { days: number[]; hours: number; startHour: number }> = {
  [SCHEDULES.standard40]: { days: [1, 2, 3, 4, 5], hours: 8, startHour: 9 },
  [SCHEDULES.compressed36]: { days: [1, 2, 3, 4], hours: 9, startHour: 9 },
  [SCHEDULES.intern30]: { days: [1, 2, 3, 4, 5], hours: 6, startHour: 10 },
  [SCHEDULES.partTime20]: { days: [1, 2, 3, 4, 5], hours: 4, startHour: 9 },
}

/** mulberry32, seeded per run so the anomalies fall in the same places twice. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (date: Date) => date.toISOString().slice(0, 10)

/**
 * A timestamp from minutes-since-midnight IST.
 *
 * Minutes rather than an (hour, minute) pair because a late start is expressed
 * as "47 minutes after the shift began" and adding that to an hour field
 * produces 09:69, which Postgres rejects outright. Arithmetic in one unit, split
 * into two only at the very end. Clamped to 23:59 so a long overtime day cannot
 * roll past midnight into the wrong date.
 *
 * The pattern times below are WALL-CLOCK IST — a 09:00 start means nine in the
 * morning in India — so the offset is subtracted to get the real instant. Left
 * as UTC, the whole seeded company appeared to start work at 14:30 once the
 * screens began rendering in IST, which is what a demo dataset looks like when
 * it was written against a different clock than the one displaying it.
 */
function stamp(day: string, minutesFromMidnight: number): string {
  const clamped = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutesFromMidnight)))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  const [year, month, date] = day.split('-').map(Number)
  return new Date(
    Date.UTC(year, month - 1, date, hour, minute) - IST_OFFSET_MS,
  ).toISOString()
}

export const attendanceSeed: SeedPart = {
  name: 'attendance',
  tables: ['attendances'],
  async run(ctx) {
    const random = makeRng(20_260_906)
    const today = new Date()
    const rows: SeedRow[] = []
    const tally: Record<string, number> = {}
    let manualEdits = 0
    let sequence = 1

    for (const person of ACTIVE_ROSTER) {
      const pattern = PATTERN[person.scheduleId] ?? PATTERN[SCHEDULES.standard40]

      for (let back = DAYS_BACK; back >= 1; back -= 1) {
        const date = new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - back),
        )
        if (!pattern.days.includes(date.getUTCDay())) continue

        const day = iso(date)
        const roll = random()

        let status: string
        if (roll < 0.016) status = 'absent'
        else if (roll < 0.056) status = 'late'
        else if (roll < 0.068) status = 'overtime'
        else if (roll < 0.077) status = 'missing_checkout'
        else status = 'present'

        tally[status] = (tally[status] ?? 0) + 1

        // A late start is 20–70 minutes after the shift begins and costs the
        // day roughly that much; overtime runs two to three hours past.
        const lateMinutes = status === 'late' ? 20 + Math.floor(random() * 50) : 0
        const overtimeHours = status === 'overtime' ? 2 + Math.round(random() * 10) / 10 : 0

        const hours =
          status === 'absent' || status === 'missing_checkout'
            ? 0
            : status === 'late'
              ? Math.round((pattern.hours - lateMinutes / 60) * 100) / 100
              : status === 'overtime'
                ? Math.round((pattern.hours + overtimeHours) * 100) / 100
                : pattern.hours

        const breakMinutes = status === 'absent' || pattern.hours <= 4 ? 0 : 60
        const startedAt = pattern.startHour * 60 + lateMinutes
        const checkIn = status === 'absent' ? null : stamp(day, startedAt)
        const checkOut =
          status === 'absent' || status === 'missing_checkout'
            ? null
            : // Worked hours plus the unpaid break: leaving is later than the
              // hours alone, which is what makes the break visible on screen.
              stamp(day, startedAt + hours * 60 + breakMinutes)

        // Somebody in HR corrected the record afterwards. Only ever on a day
        // that has both stamps — correcting an absence would need a reason.
        const isManual = status === 'present' && random() < 0.01
        if (isManual) manualEdits += 1

        rows.push({
          id: seedId('att', sequence),
          employee_id: person.id,
          worked_on: day,
          checked_in_at: checkIn,
          checked_out_at: checkOut,
          break_minutes: breakMinutes,
          worked_hours: hours,
          status,
          is_manual: isManual,
        })
        sequence += 1
      }
    }

    const written = await ctx.upsert('attendances', rows)
    ctx.log(`${written} attendance rows across ${ACTIVE_ROSTER.length} employees, ${DAYS_BACK} days`)

    const total = rows.length
    const clean = tally.present ?? 0
    ctx.log(
      `exceptions: ${tally.late ?? 0} late, ${tally.absent ?? 0} absent, ` +
        `${tally.overtime ?? 0} overtime, ${tally.missing_checkout ?? 0} missing check-out, ` +
        `${manualEdits} manually corrected`,
    )
    ctx.log(`attendance health ≈ ${((clean / total) * 100).toFixed(1)}%`)
  },
}
