/**
 * Postgres implementation of UserRepositoryPort.
 *
 * It does not extend BaseSqlRepository. That base exists for aggregates with a
 * uniform projection; users have exactly one query that needs `password_hash`
 * and several that must not have it, and inheriting a base whose whole premise
 * is "one column list" only to fight it would be worse than five short methods
 * of explicit SQL.
 *
 * The hash is selected in `findByEmail` and nowhere else. Every other method
 * lists USER_COLUMNS, which does not contain it.
 */
import { query, queryOne } from '@/lib/db'
import { normalizePageQuery, paged, type PageQuery, type Paged } from '@/modules/shared'
import type { UserRepositoryPort } from '../application/ports/user-repository.port'
import { User, type UserProps } from '../domain/user'
import { USER_COLUMNS, USERS_TABLE, type UserRow } from './user.table'

const SELECTION = USER_COLUMNS.map((c) => `"${c}"`).join(', ')

function toDomain(row: UserRow): User {
  return User.from({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    employeeId: row.employee_id,
    // Empty string when the projection omitted it. The login use case is the
    // only caller that reads it, and it always selects it.
    passwordHash: row.password_hash ?? '',
    isActive: row.is_active,
  })
}

export class PostgresUserRepository implements UserRepositoryPort {
  /**
   * The ONE query that reads the hash.
   *
   * `lower(email) = lower($1)` matches the functional unique index in
   * migration 0005, so the lookup uses the index rather than scanning — and
   * so that a login with Admin@x.com finds the account stored as admin@x.com.
   */
  async findByEmail(email: string): Promise<User | null> {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECTION}, "password_hash" FROM "${USERS_TABLE}"
       WHERE lower(email) = lower($1)`,
      [email],
    )
    return row ? toDomain(row) : null
  }

  async findById(id: string): Promise<User | null> {
    const row = await queryOne<UserRow>(
      `SELECT ${SELECTION} FROM "${USERS_TABLE}" WHERE id = $1`,
      [id],
    )
    return row ? toDomain(row) : null
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<User>> {
    const q = normalizePageQuery(pageQuery)

    const conditions: string[] = []
    const values: unknown[] = []

    // Only the two filters this screen actually offers. An open-ended filter
    // map on a table holding credentials is not worth the flexibility.
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
      query<UserRow>(
        `SELECT ${SELECTION} FROM "${USERS_TABLE}" ${where}
         ORDER BY "${sort}" ${direction}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${USERS_TABLE}" ${where}`,
        values,
      ),
    ])

    return paged(rows.map(toDomain), totals?.count ?? 0, q.page, q.limit)
  }

  async create(props: Omit<UserProps, 'id'>): Promise<User> {
    const row = await queryOne<UserRow>(
      `INSERT INTO "${USERS_TABLE}" (email, name, role, employee_id, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECTION}`,
      [
        props.email,
        props.name,
        props.role,
        props.employeeId,
        props.passwordHash,
        props.isActive,
      ],
    )
    // RETURNING on a successful INSERT always yields a row; a null here is a bug.
    return toDomain(row as UserRow)
  }

  /**
   * Partial update without building SQL per caller.
   *
   * COALESCE($n, column) leaves a column untouched when the parameter is null,
   * so one fixed statement serves "change the role", "reset the password" and
   * "deactivate" alike. Fixed SQL means no dynamic identifiers, which means
   * nothing to get wrong.
   */
  async update(id: string, props: Partial<Omit<UserProps, 'id'>>): Promise<User | null> {
    const row = await queryOne<UserRow>(
      `UPDATE "${USERS_TABLE}" SET
         email         = COALESCE($2, email),
         name          = COALESCE($3, name),
         role          = COALESCE($4, role),
         employee_id   = COALESCE($5, employee_id),
         password_hash = COALESCE($6, password_hash),
         is_active     = COALESCE($7, is_active)
       WHERE id = $1
       RETURNING ${SELECTION}`,
      [
        id,
        props.email ?? null,
        props.name ?? null,
        props.role ?? null,
        props.employeeId ?? null,
        props.passwordHash ?? null,
        props.isActive ?? null,
      ],
    )
    return row ? toDomain(row) : null
  }
}
