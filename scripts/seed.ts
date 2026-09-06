/**
 * `npm run seed` — CLI entry point.
 *
 *   npm run seed
 *   npm run seed -- --reset     empty the seeded tables first
 *   npm run seed -- --wipe      empty EVERY table first, then seed
 *
 * All of the actual work is in `scripts/seed/run.ts`, shared with the demo-seed
 * button on the login screen so the two can never drift apart.
 */
import { closePool } from '@/lib/db'
import { runSeed } from './seed/run'

async function main() {
  const reset = process.argv.includes('--reset')
  const wipe = process.argv.includes('--wipe')

  const mode = wipe ? ' — WIPING every table first' : reset ? ' (reset)' : ''
  console.log(`Seeding ${redact(process.env.DATABASE_URL ?? '(unset)')}${mode}\n`)

  const summary = await runSeed({ reset, wipe, onLog: (message) => console.log(message) })

  console.log(`\nDone in ${summary.durationMs}ms`)
  for (const part of summary.parts) {
    console.log(`  ${part.name.padEnd(14)} ${part.rows} rows`)
  }

  console.log('\nSign in with any of these:\n')
  const width = Math.max(...summary.credentials.map((c) => c.role.length))
  for (const cred of summary.credentials) {
    console.log(`  ${cred.role.padEnd(width)}  ${cred.email.padEnd(32)} ${cred.password}`)
  }
  console.log('\nhttp://localhost:3000/login\n')
}

/** Never print the database password. */
function redact(uri: string): string {
  return uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')
}

main()
  .catch((reason) => {
    console.error('\nSeed failed:', reason instanceof Error ? reason.message : reason)
    process.exitCode = 1
  })
  .finally(closePool)
