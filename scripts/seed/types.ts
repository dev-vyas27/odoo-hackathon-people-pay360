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
   * Rows for a join table with a composite primary key and no `id`.
   *
   * `payrun_employees` and `salary_structure_rules` are both of this shape, and
   * both used to be filled one INSERT at a time inside the transaction. At five
   * payruns across a full workforce that is hundreds of round trips for data
   * that fits in one statement.
   */
  link(table: string, columns: [string, string], pairs: Array<[string, string]>): Promise<number>
  /**
   * Escape hatch for anything the helpers above cannot express. Always
   * parameterised; never build SQL by concatenating values into the string.
   */
  sql(text: string, params?: readonly unknown[]): Promise<void>
  log(message: string): void
}

export interface SeedPart {
  /** Shown in the run summary. */
  name: string
  /**
   * Tables this part owns, PARENTS FIRST — the order you would create them in.
   *
   * `--reset` empties them in reverse, which is the order you must delete them
   * in: a row cannot go while another still references it. Listing them
   * child-first looks harmless and fails with a RESTRICT violation the first
   * time somebody runs `--reset` on a populated database.
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
