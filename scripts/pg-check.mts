/**
 * Postgres connectivity probe. Run: npm run db:check
 * Distinguishes auth / DNS / SSL / firewall failures, because each needs a
 * completely different fix and the raw driver error rarely makes that obvious.
 */
import { Client } from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL missing. Copy .env.example to .env.local first.')
  process.exit(1)
}
console.log('target:', url.replace(/\/\/[^@]*@/, '//'))

// Render terminates TLS with a cert this chain does not verify; the connection
// is still encrypted. rejectUnauthorized:false is required for their managed PG.
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  const { rows: [info] } = await client.query<{ version: string; db: string }>(
    'SELECT version() AS version, current_database() AS db',
  )
  console.log('CONNECTED ', info.version.split(',')[0])
  console.log('database: ', info.db)

  const { rows: tables } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  )
  console.log('tables:   ', tables.length ? tables.map((t) => t.table_name).join(', ') : '(none yet)')
  await client.end()
  process.exit(0)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('FAILED:', msg)
  if (/password authentication|role .* does not exist/i.test(msg)) console.error('-> wrong credentials or database name')
  else if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) console.error('-> hostname did not resolve; is this the EXTERNAL url?')
  else if (/ETIMEDOUT|ECONNREFUSED/i.test(msg)) console.error('-> unreachable; network/firewall, or the instance is asleep/expired')
  else if (/SSL|certificate/i.test(msg)) console.error('-> TLS problem; Render requires sslmode=require')
  process.exit(1)
}
