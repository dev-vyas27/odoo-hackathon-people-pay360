/**
 * The login-bearing columns of `employees`, as TypeScript sees it.
 *
 * There is no `users` table since 0010 — the employee row carries `role` and
 * `password_hash`, so identity reads and writes the same table `people` owns.
 * The two modules deliberately project DIFFERENT columns of it: `people` owns
 * the HR fields and never touches the credentials, identity owns the
 * credentials and touches the HR fields only enough to create an account.
 *
 * Everything below is snake_case because that is what the database calls these;
 * everything above is camelCase. Doing the translation in exactly one place is
 * what stops `password_hash` leaking into a React component.
 *
 * If you change a column here, there is a migration to write. If there is no
 * migration, this file is lying.
 */
import type { Role } from '@/modules/shared'

/** A row as `pg` returns it. */
export interface AccountRow {
  id: string
  email: string
  name: string
  role: Role
  is_active: boolean
  created_at: Date
  updated_at: Date
  /**
   * Present only on the one query that explicitly selects it, and NULL for an
   * employee who has no login. Repositories list columns rather than using
   * SELECT *, so the hash cannot arrive somewhere it was not asked for.
   */
  password_hash?: string | null
  /** Computed by ACCOUNT_SELECTION, not a real column. */
  has_login?: boolean
}

export const ACCOUNTS_TABLE = 'employees'

/** The default projection. Note the deliberate absence of password_hash. */
/**
 * The projection every read uses.
 *
 * `has_login` is COMPUTED in SQL rather than selected: the screens need to know
 * whether somebody can sign in, and that must not require shipping their hash
 * to the application to find out.
 */
export const ACCOUNT_SELECTION =
  '"id", "email", "name", "role", "is_active", "created_at", "updated_at", (password_hash IS NOT NULL) AS has_login'

export const ACCOUNT_COLUMNS = [
  'id',
  'email',
  'name',
  'role',
  'is_active',
  'created_at',
  'updated_at',
] as const
