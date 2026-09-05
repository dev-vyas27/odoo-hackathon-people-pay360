import dotenv from 'dotenv'
import { Client } from 'pg'
dotenv.config({ path: '.env.local' })
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const { rows } = await c.query<{ t: string; name: string; def: string }>(
  `SELECT rel.relname AS t, con.conname AS name, pg_get_constraintdef(con.oid) AS def
   FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
   JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   WHERE ns.nspname='public' AND con.contype IN ('c','u','x')
   ORDER BY rel.relname`)
for (const r of rows) console.log(`${r.t}: ${r.def.slice(0, 110)}`)
const { rows: mig } = await c.query(`SELECT * FROM schema_migrations ORDER BY 1`)
console.log('\nmigrations applied:', JSON.stringify(mig))
const { rows: counts } = await c.query(`SELECT 'employees' t, count(*) n FROM employees UNION ALL SELECT 'users', count(*) FROM users UNION ALL SELECT 'contracts', count(*) FROM contracts UNION ALL SELECT 'attendances', count(*) FROM attendances`)
console.log('row counts:', JSON.stringify(counts))
await c.end()
