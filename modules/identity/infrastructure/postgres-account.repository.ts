/**
 * Postgres implementation of AccountRepositoryPort, over `employees`.
 *
 * It does not extend BaseSqlRepository. That base exists for aggregates with a
 * uniform projection; accounts have exactly one query that needs
 * `password_hash` and several that must not have it, and inheriting a base
 * whose whole premise is "one column list" only to fight it would be worse than
 * a few short methods of explicit SQL.
 *
 * The hash is selected in `findByEmail` and nowhere else. Every other method
 * lists ACCOUNT_COLUMNS, which does not contain it.
 */
import { query, queryOne } from '@/lib/db'
import { normalizePageQuery, paged, type PageQuery, type Paged } from '@/modules/shared'
import type { AccountRepositoryPort } from '../application/ports/account-repository.port'
import { Account, type AccountProps } from '../domain/account'
import { ACCOUNT_COLUMNS, ACCOUNTS_TABLE, type AccountRow } from './account.table'

const SELECTION = ACCOUNT_COLUMNS.map((c) => `"${c}"`).join(', ')

function toDomain(row: AccountRow): Account {
  return Account.from({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    // `undefined` means the projection omitted it; `null` means this employee
    // genuinely has no login. Both read as "cannot sign in", which is correct —
    // only findByEmail selects it, and that is the only caller that may care.
    passwordHash: row.password_hash ?? null,
    isActive: row.is_active,
  })
}

export class PostgresAccountRepository implements AccountRepositoryPort {
  /**
   * The ONE query that reads the hash.
   *
   * `lower(email) = lower($1)` matches the functional unique index added in
   * migration 0010, so the lookup uses the index rather than scanning — and so
   * that a login with Admin@x.com finds the employee stored as admin@x.com.
   */
  async findByEmail(email: string): Promise<Account | null> {
    const row = await queryOne<AccountRow>(
      `SELECT ${SELECTION}, "password_hash" FROM "${ACCOUNTS_TABLE}"
       WHERE lower(email) = lower($1)`,
      [email],
    )
    return row ? toDomain(row) : null
  }

  async findById(id: string): Promise<Account | null> {
    const row = await queryOne<AccountRow>(
      `SELECT ${SELECTION} FROM "${ACCOUNTS_TABLE}" WHERE id = $1`,
      [id],
    )
    return row ? toDomain(row) : null
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<Account>> {
    const q = normalizePageQuery(pageQuery)

    const conditions: string[] = []
    const values: unknown[] = []

    // Only the filters this screen actually offers. An open-ended filter map on
    // a projection that includes credentials is not worth the flexibility.
    const role = q.filters?.role
    if (typeof role === 'string' && role !== '') {
      values.push(role)
      conditions.push(`role = $${values.length}`)
    }

    const isActive = q.filters?.isActive
    if (isActive === 'true' || isActive === 'false' || typeof isActive === 'boolean') {
      values.push(isActive === true || isActive === 'true')
      conditions.push(`is_active = $${values.length}`)
    }

    /**
     * `hasLogin=true` lists the employees who can actually sign in. Without it
     * this screen would show every employee, most of whom are HR records with
     * no account — which is precisely the distinction the merged table has to
     * keep legible.
     */
    const hasLogin = q.filters?.hasLogin
    if (hasLogin === 'true' || hasLogin === true) {
      conditions.push(`password_hash IS NOT NULL`)
    } else if (hasLogin === 'false' || hasLogin === false) {
      conditions.push(`password_hash IS NULL`)
    }

    if (q.search) {
      values.push(`%${q.search}%`)
      conditions.push(`(name ILIKE $${values.length} OR email ILIKE $${values.length})`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    // Sort column comes from a query string, so it is chosen from a fixed set
    // rather than interpolated — a column name cannot be a bind parameter.
    const sortable = new Set(['name', 'email', 'role', 'created_at'])
    const sort = q.sort && sortable.has(q.sort) ? q.sort : 'created_at'
    const direction = q.order === 'asc' ? 'ASC' : 'DESC'

    const [rows, totals] = await Promise.all([
      query<AccountRow>(
        `SELECT ${SELECTION} FROM "${ACCOUNTS_TABLE}" ${where}
         ORDER BY "${sort}" ${direction}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${ACCOUNTS_TABLE}" ${where}`,
        values,
      ),
    ])

    return paged(rows.map(toDomain), totals?.count ?? 0, q.page, q.limit)
  }

  /**
   * Create the employee AND its credentials.
   *
   * `employee_type` is not identity's to decide, so it takes the column
   * default. An account created here is a person who needs to sign in; the HR
   * details are filled in on the employee form afterwards.
   */
  async create(props: Omit<AccountProps, 'id'>): Promise<Account> {
    const row = await queryOne<AccountRow>(
      `INSERT INTO "${ACCOUNTS_TABLE}" (email, name, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECTION}`,
      [props.email, props.name, props.role, props.passwordHash, props.isActive],
    )
    // RETURNING on a successful INSERT always yields a row; a null here is a bug.
    return toDomain(row as AccountRow)
  }

  /**
   * Partial update without building SQL per caller.
   *
   * COALESCE($n, column) leaves a column untouched when the parameter is null,
   * so one fixed statement serves "change the role", "reset the password" and
   * "deactivate" alike. Fixed SQL means no dynamic identifiers, which means
   * nothing to get wrong.
   *
   * The consequence worth knowing: this cannot REVOKE a login by setting the
   * hash back to NULL, because null means "leave alone" here. Revoking is
   * `isActive: false`, which the domain checks on every sign-in.
   */
  async update(id: string, props: Partial<Omit<AccountProps, 'id'>>): Promise<Account | null> {
    const row = await queryOne<AccountRow>(
      `UPDATE "${ACCOUNTS_TABLE}" SET
         email         = COALESCE($2, email),
         name          = COALESCE($3, name),
         role          = COALESCE($4, role),
         password_hash = COALESCE($5, password_hash),
         is_active     = COALESCE($6, is_active)
       WHERE id = $1
       RETURNING ${SELECTION}`,
      [
        id,
        props.email ?? null,
        props.name ?? null,
        props.role ?? null,
        props.passwordHash ?? null,
        props.isActive ?? null,
      ],
    )
    return row ? toDomain(row) : null
  }
}
