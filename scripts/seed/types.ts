


import type { PoolClient } from 'pg'


export type SeedRow = Record<string, unknown> & { id: string }

export interface SeedContext {
  


  upsert(table: string, rows: SeedRow[]): Promise<number>
  


  link(table: string, columns: [string, string], pairs: Array<[string, string]>): Promise<number>
  


  sql(text: string, params?: readonly unknown[]): Promise<void>
  log(message: string): void
}

export interface SeedPart {
  
  name: string
  


  tables: string[]
  run(ctx: SeedContext): Promise<void>
}

export interface SeedCredential {
  
  role: string
  


  name: string
  email: string
  password: string
}

export interface SeedSummary {
  reset: boolean
  parts: Array<{ name: string; rows: number }>
  
  credentials: SeedCredential[]
  durationMs: number
}

export type { PoolClient }
