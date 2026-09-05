/**
 * Write-path smoke test. Creates temporary rows, verifies, then DELETES them.
 *
 * Every record is named "__SMOKE__" so anything left behind by a crash is
 * obvious and greppable. Runs against the shared dev database, so cleanup is in
 * a finally block, not a happy path.
 */
import { PostgresScheduleRepository } from '@/modules/employment'
import { PostgresDepartmentRepository } from '@/modules/people'
import { pool, query } from '@/lib/db'

const TAG = '__SMOKE__'
let pass = 0, fail = 0
const ok = (n: string, v: unknown) => { console.log(`  PASS  ${n.padEnd(38)} ${JSON.stringify(v).slice(0,90)}`); pass++ }
const bad = (n: string, e: unknown) => { console.log(`  FAIL  ${n.padEnd(38)} ${e instanceof Error ? e.message : e}`); fail++ }

const schedules = new PostgresScheduleRepository()
const departments = new PostgresDepartmentRepository()

try {
  // --- schedule create: parent + child rows in one transaction -------------
  let scheduleId: string | null = null
  try {
    const created = await schedules.create({
      name: `${TAG} Schedule`,
      days: [
        { day: 1, start: '09:00', end: '17:30', breakMinutes: 30 },
        { day: 2, start: '09:00', end: '17:30', breakMinutes: 30 },
      ],
    })
    scheduleId = created.id
    // 2 days x 8h = 16h, derived not supplied
    ok('schedule.create (txn, derived hours)', { id: created.id, weeklyHours: created.weeklyHours, days: created.days.length })
  } catch (e) { bad('schedule.create', e) }

  if (scheduleId) {
    try {
      const read = await schedules.findById(scheduleId)
      ok('schedule.findById round-trip', { days: read?.days.length, first: read?.days[0], hours: read?.weeklyHours })
    } catch (e) { bad('schedule.findById round-trip', e) }

    try {
      const updated = await schedules.update(scheduleId, {
        name: `${TAG} Renamed`,
        days: [{ day: 3, start: '10:00', end: '14:00', breakMinutes: 0 }],
      })
      ok('schedule.update (days replaced)', { hours: updated?.weeklyHours, days: updated?.days.length })
    } catch (e) { bad('schedule.update', e) }

    try {
      const gone = await schedules.delete(scheduleId)
      const orphans = await query(`SELECT id FROM working_schedule_days WHERE working_schedule_id = $1`, [scheduleId])
      ok('schedule.delete (cascade)', { deleted: gone, orphanDayRows: orphans.length })
      scheduleId = null
    } catch (e) { bad('schedule.delete', e) }
  }

  // --- department create: derived code column ------------------------------
  let deptId: string | null = null
  try {
    const d = await departments.create({ name: `${TAG} People & Culture` })
    deptId = d.id
    const row = await query<{ code: string }>(`SELECT code FROM departments WHERE id = $1`, [d.id])
    ok('department.create (derived code)', { name: d.name, code: row[0]?.code })
  } catch (e) { bad('department.create', e) }

  if (deptId) {
    try { ok('department.update', await departments.update(deptId, { name: `${TAG} Renamed Dept` }).then((r) => r?.name)) }
    catch (e) { bad('department.update', e) }
    try { ok('department.delete', await departments.delete(deptId)); deptId = null }
    catch (e) { bad('department.delete', e) }
  }
} finally {
  // Belt and braces: remove anything tagged, whatever happened above.
  const c1 = await query(`DELETE FROM working_schedules WHERE name LIKE $1 RETURNING id`, [`${TAG}%`])
  const c2 = await query(`DELETE FROM departments WHERE name LIKE $1 RETURNING id`, [`${TAG}%`])
  console.log(`\ncleanup: removed ${c1.length} schedule(s), ${c2.length} department(s)`)
  console.log(`${pass} passed, ${fail} failed\n`)
  await pool().end()
  process.exit(fail > 0 ? 1 : 0)
}
