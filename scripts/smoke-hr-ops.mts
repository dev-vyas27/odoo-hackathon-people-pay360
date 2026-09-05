/**
 * Smoke test for Dev B's Postgres repositories against the REAL database.
 *
 * The 144 unit tests all use in-memory fakes, so none of this SQL has ever
 * executed. This exercises each query once, read-only, and reports what works.
 */
import { Period } from '@/modules/shared'
import { PostgresEmployeeRepository, PostgresEmployeeLookup, PostgresDepartmentRepository, PostgresJobPositionRepository } from '@/modules/people'
import { PostgresContractQuery, PostgresScheduleQuery, PostgresScheduleRepository, PostgresContractRepository } from '@/modules/employment'
import { PostgresAttendanceStats } from '@/modules/attendance'
import { pool } from '@/lib/db'

let pass = 0, fail = 0
async function check(name: string, fn: () => Promise<unknown>) {
  try {
    const out = await fn()
    const shown = typeof out === 'object' ? JSON.stringify(out).slice(0, 110) : String(out)
    console.log(`  PASS  ${name.padEnd(42)} ${shown}`)
    pass++
  } catch (err) {
    console.log(`  FAIL  ${name.padEnd(42)} ${err instanceof Error ? err.message : String(err)}`)
    fail++
  }
}

const period = Period.month(2026, 9)

console.log('\nPEOPLE')
const employees = new PostgresEmployeeRepository()
const lookup = new PostgresEmployeeLookup()
await check('employees.findMany', () => employees.findMany({ page: 1, limit: 3 }).then((p) => `${p.total} total`))
await check('employees.findMany + search', () => employees.findMany({ search: 'a' }).then((p) => `${p.total} matched`))
await check('departments.findMany', () => new PostgresDepartmentRepository().findMany({}).then((p) => `${p.total} total`))
await check('jobPositions.findMany', () => new PostgresJobPositionRepository().findMany({}).then((p) => `${p.total} total`))

const first = (await employees.findMany({ page: 1, limit: 1 })).items[0]
if (first) {
  await check('employees.findById', () => employees.findById(first.id).then((e) => e?.name))
  await check('employees.findByEmail', () => employees.findByEmail(first.email).then((e) => e?.email))
  await check('lookup.findById (JOIN)', () => lookup.findById(first.id))
  await check('lookup.findManyByIds (batch)', () => lookup.findManyByIds([first.id]).then((r) => `${r.length} rows`))
}
await check('lookup.findEligible', () => lookup.findEligible({ activeOn: new Date() }).then((r) => `${r.length} eligible`))

console.log('\nEMPLOYMENT')
await check('contracts.findMany', () => new PostgresContractRepository().findMany({}).then((p) => `${p.total} total`))
await check('schedules.findMany (+days)', () => new PostgresScheduleRepository().findMany({}).then((p) => `${p.total} total, first days=${p.items[0]?.days.length ?? 0}`))
const sched = (await new PostgresScheduleRepository().findMany({ limit: 1 })).items[0]
if (sched) {
  await check('schedules.findById (+days)', () => new PostgresScheduleRepository().findById(sched.id).then((s) => `${s?.days.length} days, ${s?.weeklyHours}h`))
  await check('scheduleQuery.findById', () => new PostgresScheduleQuery().findById(sched.id).then((s) => `${s?.days.length} days`))
  await check('scheduleQuery.expectedDays', () => new PostgresScheduleQuery().expectedDays(sched.id, period))
  await check('scheduleQuery.expectedHours', () => new PostgresScheduleQuery().expectedHours(sched.id, period))
}
if (first) {
  await check('contractQuery.findApplicable (daterange)', () => new PostgresContractQuery().findApplicableContract(first.id, period).then((c) => c ? `contract ${c.id}` : 'none (no contracts seeded)'))
  await check('contractQuery.findByEmployee (JOIN)', () => new PostgresContractQuery().findByEmployee(first.id).then((r) => `${r.length} rows`))
}

console.log('\nATTENDANCE')
const stats = new PostgresAttendanceStats()
if (first) {
  await check('stats.workedHours', () => stats.workedHours(first.id, period))
  await check('stats.workedDays', () => stats.workedDays(first.id, period))
  await check('stats.workedDaysForMany (GROUP BY)', () => stats.workedDaysForMany([first.id], period).then((m) => JSON.stringify([...m])))
}
await check('stats.summary (FILTER aggregates)', () => stats.summary(period))
await check('stats.summary + department JOIN', () => stats.summary(period, '00000000-0000-0000-0000-000000000000'))

console.log(`\n${pass} passed, ${fail} failed\n`)
await pool().end()
process.exit(fail > 0 ? 1 : 0)
