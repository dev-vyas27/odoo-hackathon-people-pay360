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
import { payrollConfigSeed } from './parts/payroll-config.seed'
import { payrollProcessingSeed } from './parts/payroll-processing.seed'
import { employmentSeed } from './parts/employment.seed'
import { DEMO_CREDENTIALS, identitySeed } from './parts/identity.seed'
import { attendanceSeed } from './parts/attendance.seed'
import { timeoffSeed } from './parts/timeoff.seed'
import type { PoolClient, SeedContext, SeedPart, SeedRow, SeedSummary } from './types'

/**
 * The registry. Add your part with ONE line.
 *
 * Order matters here in a way it did not under Mongo: foreign keys are real
 * now, so a part must run after the tables it references. Identity before
 * timeoff, people before both.
 *
 * Everything except `identitySeed` and `timeoffSeed` is a placeholder written
 * by Dev A so the dashboard has real rows to aggregate. Dev B and Dev C should
 * replace theirs wholesale, keeping the ids from `SEED`.
 *
 * Order is foreign-key order, and it is not negotiable:
 *   employees      before everything that references a person
 *   payroll-config before contracts   (a contract names a salary structure)
 *   contracts      before payslips    (a payslip records the contract it used)
 */
const PARTS: SeedPart[] = [
  peopleSeed,
  payrollConfigSeed,
  employmentSeed,
  identitySeed,
  attendanceSeed,
  timeoffSeed,
  payrollProcessingSeed,
]

export interface RunSeedOptions {
  /** Empty each part's tables first. Destructive — see the callers. */
  reset?: boolean
  /**
   * Empty EVERY table in the schema first, not just the seeded ones.
   *
   * Strictly more destructive than `reset`, and deliberately a separate flag
   * rather than a stronger default: the demo button on the login screen must
   * never be one misclick away from deleting an administrator's own work.
   */
  wipe?: boolean
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
  const wipe = options.wipe ?? false
  const reset = options.reset ?? false

  const parts = await transaction(async (client) => {
    if (wipe) {
      /**
       * Everything, including tables this seed does not own.
       *
       * `--reset` empties only the seeded tables, which leaves anything created
       * by hand or by a test run behind — password setup tokens, employees an
       * administrator added, a payrun somebody built during a rehearsal. For a
       * genuinely clean database the table list has to come from the catalogue
       * rather than from the seed's own idea of what exists.
       *
       * `schema_migrations` is excluded: wiping it would make the runner replay
       * every migration against a schema that already has them.
       *
       * TRUNCATE ... CASCADE rather than DELETE — it ignores foreign-key order,
       * so no dependency graph has to be maintained here, and it does not have
       * to walk every row.
       */
      const { rows } = await client.query<{ name: string }>(
        `SELECT tablename AS name
           FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
          ORDER BY tablename`,
      )
      const names = rows.map((row) => `"${assertIdentifier(row.name, 'table')}"`)
      if (names.length > 0) {
        await client.query(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`)
      }
      options.onLog?.(`wiped ${names.length} tables`)
    } else if (reset) {
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
    reset: reset || wipe,
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
    async link(table, columns, pairs) {
      const written = await linkRows(client, table, columns, pairs)
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

  /**
   * Postgres accepts at most 65535 bind parameters in one statement.
   *
   * At nine columns that is 7281 rows, and the attendance part alone writes
   * more than that — the failure is a flat `bind message has N parameter
   * formats but M parameters`, which says nothing about the real cause. So the
   * batch is split by parameter budget rather than by a guessed row count,
   * because the safe row count depends entirely on how wide the table is.
   */
  const perChunk = Math.max(1, Math.floor(60000 / columns.length))
  if (rows.length > perChunk) {
    let written = 0
    for (let i = 0; i < rows.length; i += perChunk) {
      written += await upsertRows(client, table, rows.slice(i, i + perChunk))
    }
    return written
  }

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

/**
 * INSERT ... ON CONFLICT DO NOTHING for a two-column join table.
 *
 * Same parameter budget as `upsertRows`, and the same reason for it: two
 * columns means the ceiling is high, but a payrun covering a full workforce
 * across five months still clears it comfortably enough to matter.
 */
async function linkRows(
  client: PoolClient,
  table: string,
  columns: [string, string],
  pairs: Array<[string, string]>,
): Promise<number> {
  if (pairs.length === 0) return 0

  assertIdentifier(table, 'table')
  const [left, right] = columns.map((c) => assertIdentifier(c, 'column'))

  const perChunk = 20000
  if (pairs.length > perChunk) {
    let written = 0
    for (let i = 0; i < pairs.length; i += perChunk) {
      written += await linkRows(client, table, columns, pairs.slice(i, i + perChunk))
    }
    return written
  }

  const values: unknown[] = []
  const tuples = pairs.map(([a, b]) => {
    values.push(a, b)
    return `($${values.length - 1}, $${values.length})`
  })

  const result = await client.query(
    `INSERT INTO "${table}" ("${left}", "${right}")
     VALUES ${tuples.join(', ')}
     ON CONFLICT DO NOTHING`,
    values,
  )
  return result.rowCount ?? 0
}
