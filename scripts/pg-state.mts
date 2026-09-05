import dotenv from 'dotenv'
import { Client } from 'pg'
dotenv.config({ path: '.env.local' })
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows: mig } = await c.query(`SELECT filename, applied_at FROM schema_migrations ORDER BY filename`)
console.log('MIGRATIONS:'); mig.forEach((m: Record<string, unknown>) => console.log('  ', m.filename))
const tables = ['users','employees','departments','job_positions','working_schedules','contracts','attendances','salary_structures','salary_rules','payruns','payslips','timeoff_types','timeoff_allocations','timeoff_requests']
console.log('\nROW COUNTS:')
for (const t of tables) {
  const { rows } = await c.query(`SELECT count(*)::int AS n FROM ${t}`)
  console.log(`   ${t.padEnd(22)} ${rows[0].n}`)
}
await c.end()
