/**
 * The `users` table as TypeScript sees it.
 *
 * This file is the seam between the schema (migrations/0005_identity.sql) and
 * the domain. Everything below is snake_case because that is what the database
 * calls these; everything above is camelCase. Doing the translation in exactly
 * one place is what stops `employee_id` leaking into a React component.
 *
 * If you change a column here, there is a migration to write. If there is no
 * migration, this file is lying.
 */
import type { Role } from '@/modules/shared'

/** A row as `pg` returns it. */
export interface UserRow {
  id: string
  email: string
  name: string
  role: Role
  employee_id: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
  /**
   * Present only on the one query that explicitly selects it. Repositories
   * list columns rather than using SELECT *, so the hash cannot arrive
   * somewhere it was not asked for.
   */
  password_hash?: string
}

export const USERS_TABLE = 'users'

/** The default projection. Note the deliberate absence of password_hash. */
export const USER_COLUMNS = [
  'id',
  'email',
  'name',
  'role',
  'employee_id',
  'is_active',
  'created_at',
  'updated_at',
] as const
