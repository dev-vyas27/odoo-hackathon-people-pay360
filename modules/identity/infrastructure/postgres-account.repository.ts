


import { query, queryOne } from '@/lib/db'
import { normalizePageQuery, paged, type PageQuery, type Paged } from '@/modules/shared'
import type { AccountRepositoryPort } from '../application/ports/account-repository.port'
import { Account, type AccountProps } from '../domain/account'
import { ACCOUNT_SELECTION, ACCOUNTS_TABLE, type AccountRow } from './account.table'


const SELECTION = ACCOUNT_SELECTION

function toDomain(row: AccountRow): Account {
  return Account.from({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.password_hash ?? null,
    
    
    
    hasLogin: row.has_login,
    isActive: row.is_active,
  })
}

export class PostgresAccountRepository implements AccountRepositoryPort {
  


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

  


  async create(props: Omit<AccountProps, 'id'>): Promise<Account> {
    const row = await queryOne<AccountRow>(
      `INSERT INTO "${ACCOUNTS_TABLE}" (email, name, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECTION}`,
      [props.email, props.name, props.role, props.passwordHash, props.isActive],
    )
    
    return toDomain(row as AccountRow)
  }

  


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

  


  async revokeLogin(id: string): Promise<Account | null> {
    const row = await queryOne<AccountRow>(
      `UPDATE "${ACCOUNTS_TABLE}" SET password_hash = NULL
       WHERE id = $1
       RETURNING ${SELECTION}`,
      [id],
    )
    return row ? toDomain(row) : null
  }
}
