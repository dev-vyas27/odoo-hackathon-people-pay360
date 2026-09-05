/**
 * The seed runner. ONE implementation, two entry points:
 *
 *   scripts/seed.ts            `npm run seed` on the command line
 *   app/api/demo/seed/route.ts the "Load demo data" button on the login screen
 *
 * Sharing the implementation is the point. A button that seeds slightly
 * different data from the CLI is a bug that only shows up on stage.
 *
 * The whole run is ONE transaction. Either the demo database is fully seeded or
 * it is untouched — there is no half-seeded state where users exist but the
 * leave they reference does not. This is the thing Mongo could not give us
 * without a replica set.
 */
import { transaction } from '@/lib/db'
import { peopleSeed } from './parts/people.seed'
import { DEMO_CREDENTIALS, identitySeed } from './parts/identity.seed'
import { timeoffSeed } from './parts/timeoff.seed'
import type { PoolClient, SeedContext, SeedPart, SeedRow, SeedSummary } from './types'

/**
 * The registry. Add your part with ONE line.
 *
 * Order matters here in a way it did not under Mongo: foreign keys are real
 * now, so a part must run after the tables it references. Identity before
 * timeoff, people before both.
 *
 * Dev B: `peopleSeed` is a placeholder standing in for your module — replace
 *        it, and add `employmentSeed` and `attendanceSeed`.
 * Dev C:  add `payrollConfigSeed` and `payrollProcessingSeed`.
 */
const PARTS: SeedPart[] = [peopleSeed, identitySeed, timeoffSeed]

export interface RunSeedOptions {
  /** Empty each part's tables first. Destructive — see the callers. */
  reset?: boolean
  onLog?: (message: string) => void
}

/** Postgres identifiers we generate: letters, digits and underscores only. */
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/

function assertIdentifier(name: string, kind: string): string {
  if (!IDENTIFIER.test(name)) {
    throw new Error(`Unsafe ${kind} name in seed data: ${name}`)
  }
  return name
}

export async function runSeed(options: RunSeedOptions = {}): Promise<SeedSummary> {
  const startedAt = Date.now()
  const reset = options.reset ?? false

  const parts = await transaction(async (client) => {
    if (reset) {
      /**
       * Reverse order, because a table cannot be emptied while another still
       * references its rows. CASCADE would be shorter but would silently reach
       * into tables this seed does not own.
       */
      const tables = PARTS.flatMap((part) => part.tables).reverse()
      for (const table of tables) {
        await client.query(`DELETE FROM "${assertIdentifier(table, 'table')}"`)
        options.onLog?.(`cleared ${table}`)
      }
    }

    const results: SeedSummary['parts'] = []

    for (const part of PARTS) {
      let rows = 0
      const ctx = createContext(client, options.onLog, (written) => {
        rows += written
      })

      options.onLog?.(`${part.name}:`)
      await part.run(ctx)
      results.push({ name: part.name, rows })
    }

    return results
  })

  return {
    reset,
    parts,
    credentials: DEMO_CREDENTIALS,
    durationMs: Date.now() - startedAt,
  }
}

function createContext(
  client: PoolClient,
  onLog: ((message: string) => void) | undefined,
  countRows: (written: number) => void,
): SeedContext {
  return {
    async upsert(table, rows) {
      const written = await upsertRows(client, table, rows)
      countRows(written)
      return written
    },
    async sql(text, params = []) {
      await client.query(text, params as unknown[])
    },
    log: (message) => onLog?.(`  ${message}`),
  }
}

/**
 * INSERT ... ON CONFLICT (id) DO UPDATE, in one round trip for the whole batch.
 *
 * Column names cannot be bind parameters, so they are validated as identifiers
 * before being quoted. The values are all parameterised. Seed data is authored
 * in this repository rather than supplied by a user, but "it is our own data"
 * is exactly the assumption that stops being true later.
 */
async function upsertRows(
  client: PoolClient,
  table: string,
  rows: SeedRow[],
): Promise<number> {
  if (rows.length === 0) return 0

  assertIdentifier(table, 'table')

  // Every row in a batch must have the same shape, otherwise the placeholder
  // grid does not line up. Taking the columns from the first row and checking
  // the rest turns a silent misalignment into a clear error.
  const columns = Object.keys(rows[0]).map((c) => assertIdentifier(c, 'column'))

  const values: unknown[] = []
  const tuples = rows.map((row, rowIndex) => {
    const keys = Object.keys(row)
    if (keys.length !== columns.length || keys.some((k, i) => k !== columns[i])) {
      throw new Error(`Row ${rowIndex} of "${table}" has different columns from row 0`)
    }
    const placeholders = columns.map((column) => {
      values.push(row[column])
      return `$${values.length}`
    })
    return `(${placeholders.join(', ')})`
  })

  // Update every column except the primary key.
  const updates = columns
    .filter((c) => c !== 'id')
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(', ')

  const sql =
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')})\n` +
    `VALUES ${tuples.join(', ')}\n` +
    (updates
      ? `ON CONFLICT (id) DO UPDATE SET ${updates}`
      : `ON CONFLICT (id) DO NOTHING`)

  const result = await client.query(sql, values)
  return result.rowCount ?? 0
}
