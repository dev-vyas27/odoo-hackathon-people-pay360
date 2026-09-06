


import { seedId } from '../ids'
import { IST_OFFSET_MS } from '@/modules/shared'
import { ACTIVE_ROSTER, SCHEDULES } from '../roster'
import type { SeedPart, SeedRow } from '../types'

const DAYS_BACK = 45


const PATTERN: Record<string, { days: number[]; hours: number; startHour: number }> = {
  [SCHEDULES.standard40]: { days: [1, 2, 3, 4, 5], hours: 8, startHour: 9 },
  [SCHEDULES.compressed36]: { days: [1, 2, 3, 4], hours: 9, startHour: 9 },
  [SCHEDULES.intern30]: { days: [1, 2, 3, 4, 5], hours: 6, startHour: 10 },
  [SCHEDULES.partTime20]: { days: [1, 2, 3, 4, 5], hours: 4, startHour: 9 },
}


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
            : 
              
              stamp(day, startedAt + hours * 60 + breakMinutes)

        
        
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
