/**
 * The migration runner. No library — it is about eighty lines of logic and a
 * dependency here would be a dependency in the deployment story too.
 *
 *   npm run migrate            apply everything pending
 *   npm run migrate -- --status  show what is applied and what is not
 *
 * Three properties that matter:
 *
 *   1. Each file runs inside its own transaction. A migration that fails
 *      halfway leaves the database exactly as it was, rather than half-migrated
 *      with no record of it — which is the state that takes an afternoon to
 *      untangle.
 *   2. Applied files are checksummed. Editing a migration that has already run
 *      is refused, because at that point the schema in the database and the SQL
 *      in the repository disagree and nothing will tell you which is right.
 *   3. An advisory lock means two processes starting at once (a deploy and a
 *      developer, say) cannot both apply the same migration.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { closePool, pool, query } from '@/lib/db'

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations')

/** Any positive integer; it only has to be the same in every process. */
const LOCK_ID = 987_654_321

interface AppliedMigration {
  filename: string
  checksum: string
  applied_at: Date
}

async function ensureMigrationsTable(): Promise<void> {
  // Created by the runner rather than by 0001, because 0001 cannot record that
  // it ran into a table that does not exist yet.
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function readMigrationFiles(): Promise<Array<{ filename: string; sql: string }>> {
  const names = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    // Zero-padded numeric prefixes, so lexicographic order IS execution order.
    .sort()

  return Promise.all(
    names.map(async (filename) => ({
      filename,
      sql: await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8'),
    })),
  )
}

const checksum = (sql: string) =>
  // Newlines are normalised first: a file checked out on Windows must not read
  // as modified against one applied from a Linux CI runner.
  createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16)

async function status(): Promise<void> {
  await ensureMigrationsTable()

  const files = await readMigrationFiles()
  const applied = new Map(
    (await query<AppliedMigration>('SELECT * FROM schema_migrations')).map((row) => [
      row.filename,
      row,
    ]),
  )

  console.log('')
  for (const file of files) {
    const record = applied.get(file.filename)
    if (!record) {
      console.log(`  pending   ${file.filename}`)
    } else if (record.checksum !== checksum(file.sql)) {
      console.log(`  CHANGED   ${file.filename}  <- applied, but the file has been edited`)
    } else {
      console.log(`  applied   ${file.filename}  ${record.applied_at.toISOString().slice(0, 19)}`)
    }
  }
  console.log('')
}

async function migrate(): Promise<void> {
  await ensureMigrationsTable()

  const client = await pool().connect()
  try {
    // Blocks until any other migrating process finishes.
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID])

    const files = await readMigrationFiles()
    const applied = new Map(
      (
        await client.query<AppliedMigration>('SELECT * FROM schema_migrations')
      ).rows.map((row) => [row.filename, row]),
    )

    let count = 0

    for (const file of files) {
      const hash = checksum(file.sql)
      const record = applied.get(file.filename)

      if (record) {
        if (record.checksum !== hash) {
          throw new Error(
            `${file.filename} has already been applied but its contents have changed.\n` +
              `Migrations are immutable once applied — add a new numbered file instead of editing this one.\n` +
              `(If this is a throwaway development database, drop it and migrate again.)`,
          )
        }
        continue
      }

      process.stdout.write(`  applying ${file.filename} ... `)

      try {
        await client.query('BEGIN')
        await client.query(file.sql)
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [file.filename, hash],
        )
        await client.query('COMMIT')
        console.log('ok')
        count += 1
      } catch (reason) {
        await client.query('ROLLBACK')
        console.log('failed')
        throw reason
      }
    }

    console.log(count === 0 ? '\n  Already up to date.\n' : `\n  Applied ${count} migration(s).\n`)
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {})
    client.release()
  }
}

async function main() {
  console.log(`Database: ${redact(process.env.DATABASE_URL ?? '(unset)')}`)
  if (process.argv.includes('--status')) await status()
  else await migrate()
}

/** Never print the database password. */
function redact(url: string): string {
  return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')
}

main()
  .catch((reason) => {
    console.error('\nMigration failed:', reason instanceof Error ? reason.message : reason)
    process.exitCode = 1
  })
  .finally(closePool)
