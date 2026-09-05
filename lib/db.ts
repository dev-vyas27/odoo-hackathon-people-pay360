/**
 * PostgreSQL connection pool and the three query helpers the whole app uses.
 *
 * No ORM. Repositories write SQL, which means the query a reviewer reads in the
 * repository is the query the database actually runs — no lazy-loading
 * surprises, no generated N+1, and `EXPLAIN` works on text you can copy out of
 * the file.
 *
 * The pool is cached on globalThis because Next re-evaluates modules on every
 * edit in dev; without the cache you leak a pool per hot reload and Postgres
 * starts refusing connections about twenty minutes into a working session.
 */
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL

/**
 * `numeric`/`decimal` arrive as strings by default because they can exceed
 * JavaScript's safe integer range. Every numeric column in this schema is a
 * money or duration value well inside that range, and getting `"1200.00"`
 * where the domain expects `1200` is a bug that surfaces as `NaN` three layers
 * away. Parsed once, here, rather than at forty call sites.
 */
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value))
/** int8/bigint — only ever a COUNT(*) in this application. */
types.setTypeParser(types.builtins.INT8, (value) => Number(value))

declare global {
  var __pgPool: Pool | undefined
}

export function pool(): Pool {
  if (!global.__pgPool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.')
    }

    global.__pgPool = new Pool({
      connectionString: DATABASE_URL,
      // Hosted Postgres (Neon, Supabase, Render) terminates plaintext
      // connections; a local docker instance has no certificate to verify.
      ssl: needsSsl(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      // Fail fast in dev rather than hanging a request for the default 30s.
      connectionTimeoutMillis: 10_000,
    })

    /**
     * An idle client erroring (the database restarted, the network blipped) is
     * emitted on the pool. Without a listener, Node treats it as an unhandled
     * 'error' event and kills the process.
     */
    global.__pgPool.on('error', (reason) => {
      console.error('[db] idle client error:', reason.message)
    })
  }

  return global.__pgPool
}

function needsSsl(url: string): boolean {
  if (/sslmode=disable/.test(url)) return false
  if (/sslmode=require|neon\.tech|supabase\.|render\.com|railway\.app/.test(url)) return true
  return !/localhost|127\.0\.0\.1/.test(url)
}

/**
 * Run a parameterised query.
 *
 * Values ALWAYS travel as `$1, $2, ...` placeholders — never interpolated into
 * the SQL string. That is not a style preference; it is the entire defence
 * against SQL injection, and it holds even for values that "obviously" came
 * from our own code, because today's internal value is tomorrow's query
 * parameter.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params as unknown[])
  return result.rows
}

/** The single-row case. Returns null rather than throwing on an empty result. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/**
 * Run several statements atomically.
 *
 * This is why approving a leave request is now genuinely safe: the allocation deduction
 * and the status change either both land or neither does. Pass the client
 * through to every statement in the unit of work — a query issued against the
 * pool instead of the client is NOT in the transaction.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (reason) {
    await client.query('ROLLBACK').catch(() => {
      // The rollback itself can fail if the connection died. The original
      // error is the interesting one, so it is what gets rethrown.
    })
    throw reason
  } finally {
    client.release()
  }
}

/** Used by /api/health to separate "app is down" from "database is unreachable". */
export async function ping(): Promise<boolean> {
  const row = await queryOne<{ ok: number }>('SELECT 1 AS ok')
  return row?.ok === 1
}

/** Closes the pool. For scripts only — a long-lived server should never call it. */
export async function closePool(): Promise<void> {
  if (global.__pgPool) {
    await global.__pgPool.end()
    global.__pgPool = undefined
  }
}

export type { PoolClient }
