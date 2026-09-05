import dotenv from 'dotenv'
import { Client } from 'pg'
dotenv.config({ path: '.env.local' })
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows: u } = await c.query(`SELECT email, role FROM users ORDER BY role`)
console.log('users:', u.map((r: Record<string, unknown>) => `${r.email} (${r.role})`).join('\n       '))
const { rows: e } = await c.query(`SELECT name, employee_type, working_schedule_id IS NOT NULL AS has_sched FROM employees LIMIT 5`)
console.log('\nemployees:', JSON.stringify(e))
await c.end()
