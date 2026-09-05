/**
 * The seed plug-in contract.
 *
 * Three people seed one database. The merge-conflict-free way to do that is a
 * registry: each owner writes `parts/<module>.seed.ts` exporting a `SeedPart`,
 * and adds ONE line to the `PARTS` array in `run.ts`. Three adjacent lines in
 * an array merge cleanly; three people editing one 300-line seed function does
 * not.
 */
import type { PoolClient } from 'pg'

/** A row keyed by COLUMN name (snake_case), carrying the fixed id from ids.ts. */
export type SeedRow = Record<string, unknown> & { id: string }

export interface SeedContext {
  /**
   * INSERT ... ON CONFLICT (id) DO UPDATE.
   *
   * This is what makes the whole seed idempotent: because ids come from
   * `seedId()` they are stable across runs, so seeding twice updates the same
   * rows instead of duplicating them or failing on the primary key.
   */
  upsert(table: string, rows: SeedRow[]): Promise<number>
  /**
   * Escape hatch for anything an upsert cannot express — a join table with a
   * composite key, say. Always parameterised; never build SQL by concatenating
   * values into the string.
   */
  sql(text: string, params?: readonly unknown[]): Promise<void>
  log(message: string): void
}

export interface SeedPart {
  /** Shown in the run summary. */
  name: string
  /**
   * Tables this part owns, in dependency order. `--reset` truncates exactly
   * these, so one part can be re-seeded from scratch without touching anybody
   * else's data.
   */
  tables: string[]
  run(ctx: SeedContext): Promise<void>
}

export interface SeedCredential {
  role: string
  email: string
  password: string
}

export interface SeedSummary {
  reset: boolean
  parts: Array<{ name: string; rows: number }>
  /** Printed by the CLI and shown by the demo panel on the login screen. */
  credentials: SeedCredential[]
  durationMs: number
}

export type { PoolClient }
