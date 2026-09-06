


import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL



types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value))

types.setTypeParser(types.builtins.INT8, (value) => Number(value))



types.setTypeParser(types.builtins.DATE, (value) => new Date(`${value}T00:00:00.000Z`))

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
      
      
      ssl: needsSsl(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      
      connectionTimeoutMillis: 10_000,
    })

    


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



export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await pool().query<T>(text, params as unknown[])
  return result.rows
}


export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}



export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (reason) {
    await client.query('ROLLBACK').catch(() => {
      
      
    })
    throw reason
  } finally {
    client.release()
  }
}


export async function ping(): Promise<boolean> {
  const row = await queryOne<{ ok: number }>('SELECT 1 AS ok')
  return row?.ok === 1
}


export async function closePool(): Promise<void> {
  if (global.__pgPool) {
    await global.__pgPool.end()
    global.__pgPool = undefined
  }
}

export type { PoolClient }
