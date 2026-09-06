


import { transaction } from '@/lib/db'
import { peopleSeed } from './parts/people.seed'
import { payrollConfigSeed } from './parts/payroll-config.seed'
import { payrollProcessingSeed } from './parts/payroll-processing.seed'
import { employmentSeed } from './parts/employment.seed'
import { DEMO_CREDENTIALS, identitySeed } from './parts/identity.seed'
import { attendanceSeed } from './parts/attendance.seed'
import { timeoffSeed } from './parts/timeoff.seed'
import type { PoolClient, SeedContext, SeedPart, SeedRow, SeedSummary } from './types'



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
  
  reset?: boolean
  


  wipe?: boolean
  onLog?: (message: string) => void
}


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



async function upsertRows(
  client: PoolClient,
  table: string,
  rows: SeedRow[],
): Promise<number> {
  if (rows.length === 0) return 0

  assertIdentifier(table, 'table')

  
  
  
  const columns = Object.keys(rows[0]).map((c) => assertIdentifier(c, 'column'))

  


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
