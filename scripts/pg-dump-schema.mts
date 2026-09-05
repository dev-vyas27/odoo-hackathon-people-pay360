import dotenv from 'dotenv'
import { Client } from 'pg'
dotenv.config({ path: '.env.local' })
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const only = process.argv.slice(2)
const { rows } = await c.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(
  `SELECT table_name, column_name, data_type, is_nullable, column_default
   FROM information_schema.columns WHERE table_schema='public'
   ORDER BY table_name, ordinal_position`)
const byTable = new Map<string, typeof rows>()
for (const r of rows) { if (!byTable.has(r.table_name)) byTable.set(r.table_name, []); byTable.get(r.table_name)!.push(r) }
for (const [t, cols] of byTable) {
  if (only.length && !only.includes(t)) continue
  console.log(`\n== ${t}`)
  for (const c2 of cols) {
    const def = c2.column_default ? ` default ${c2.column_default.slice(0, 30)}` : ''
    console.log(`   ${c2.column_name.padEnd(24)} ${c2.data_type}${c2.is_nullable === 'YES' ? ' NULL' : ''}${def}`)
  }
}
await c.end()
