/**
 * Connectivity probe. Run: npx tsx scripts/db-check.mts
 * Confirms the URI works and reports the failure kind when it does not,
 * because "auth failed" and "IP not allowlisted" need very different fixes.
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'

// Match Next's precedence: .env.local wins over .env
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI missing. Copy .env.example to .env.local first.')
  process.exit(1)
}

// Never print credentials: strip user:pass before logging.
const redacted = uri.replace(/\/\/[^@]*@/, '//')
console.log('target:', redacted)

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  const admin = mongoose.connection.db!.admin()
  const { version } = await admin.serverInfo()
  const cols = await mongoose.connection.db!.listCollections().toArray()
  console.log('CONNECTED  mongodb', version)
  console.log('collections:', cols.length ? cols.map((c) => c.name).join(', ') : '(empty database)')
  await mongoose.disconnect()
  process.exit(0)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('FAILED:', msg)
  if (/authentication failed|bad auth/i.test(msg)) console.error('-> wrong username/password')
  else if (/ETIMEOUT|querySrv|ENOTFOUND/i.test(msg)) console.error('-> DNS/SRV lookup failed; check network')
  else if (/not whitelisted|IP address/i.test(msg)) console.error('-> Atlas Network Access must allow 0.0.0.0/0')
  else console.error('-> unrecognised; likely Atlas Network Access (IP allowlist)')
  process.exit(1)
}
