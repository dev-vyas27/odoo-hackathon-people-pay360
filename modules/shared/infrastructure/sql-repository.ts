/**
 * BaseSqlRepository — Template Method for the boring 80% of persistence.
 *
 * Subclasses declare a table, its columns and a `toDomain` mapper; they inherit
 * paging, search, filtering, sorting and CRUD. Anything genuinely specific to
 * an aggregate ("find the contract covering this period") is written as real
 * SQL on the subclass rather than by making this class cleverer.
 *
 * Repositories return DOMAIN objects, never rows. Leaking a row leaks column
 * names and nullability into the application layer.
 *
 * ── On SQL injection ────────────────────────────────────────────────────────
 * Values are always `$1, $2, ...` placeholders — the driver never sees
 * interpolated user input.
 *
 * Identifiers are the part people get wrong, because a column name CANNOT be a
 * bind parameter. `?sort=name; DROP TABLE users --` arrives from the query
 * string and would go straight into an ORDER BY clause. So every identifier
 * this class emits is checked against the subclass's declared column list and
 * quoted. An unrecognised sort column falls back to the default rather than
 * throwing, because a bad URL should not be a 500.
 */
import { query, queryOne, type PoolClient } from '@/lib/db'
import type { QueryResultRow } from 'pg'
import type { IRepository, PageQuery, Paged } from '../application/repository'
import { normalizePageQuery, paged } from '../application/repository'

/** Anything a query can bind. */
export type SqlValue = string | number | boolean | Date | null | undefined

export abstract class BaseSqlRepository<TDomain, TRow extends QueryResultRow>
  implements IRepository<TDomain>
{
  /** Unquoted table name, e.g. 'timeoff_requests'. */
  protected abstract readonly table: string

  /**
   * Every column this repository may read, write, filter or sort by.
   * This list IS the allowlist — a column absent from it does not exist as far
   * as any generated SQL is concerned.
   */
  protected abstract readonly columns: readonly string[]

  /** Columns a free-text `search` matches, case-insensitively. */
  protected readonly searchable: readonly string[] = []

  /** ORDER BY when the caller does not ask for one. */
  protected readonly defaultSort: string = 'created_at'

  protected abstract toDomain(row: TRow): TDomain

  // ── identifier safety ──────────────────────────────────────────────────────

  /** Double-quote an identifier, after proving it is one of ours. */
  protected column(name: string): string {
    if (!this.columns.includes(name)) {
      throw new Error(`Unknown column "${name}" on ${this.table}`)
    }
    return `"${name}"`
  }

  /**
   * `employeeId` from a query string is `employee_id` in the table. Doing the
   * conversion here means the API speaks camelCase and the schema speaks
   * snake_case without either having to compromise.
   */
  protected toColumnName(key: string): string {
    return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  }

  protected get selection(): string {
    return this.columns.map((c) => `"${c}"`).join(', ')
  }

  // ── query building ─────────────────────────────────────────────────────────

  /**
   * Turn a PageQuery into a WHERE clause plus its bound values.
   *
   * `startIndex` exists so callers that already bound parameters (a subclass
   * adding its own condition) can continue the numbering rather than colliding
   * on $1.
   */
  protected buildWhere(
    q: PageQuery,
    startIndex = 1,
  ): { clause: string; values: SqlValue[]; nextIndex: number } {
    const conditions: string[] = []
    const values: SqlValue[] = []
    let index = startIndex

    for (const [key, raw] of Object.entries(q.filters ?? {})) {
      // A cleared <select> submits '', which must mean "no filter" rather than
      // "match the empty string" — otherwise clearing a filter hides every row.
      if (raw === undefined || raw === null || raw === '') continue

      const name = this.toColumnName(key)
      if (!this.columns.includes(name)) continue // ignore unknown filters, do not 500

      if (Array.isArray(raw)) {
        if (raw.length === 0) continue
        conditions.push(`"${name}" = ANY($${index})`)
        values.push(raw as unknown as SqlValue)
      } else {
        conditions.push(`"${name}" = $${index}`)
        values.push(raw as SqlValue)
      }
      index += 1
    }

    if (q.search && this.searchable.length > 0) {
      // ILIKE with a bound pattern: the % wildcards are part of the VALUE, so
      // a search for "50%" cannot change the shape of the query.
      const ors = this.searchable.map((name) => `"${name}" ILIKE $${index}`)
      conditions.push(`(${ors.join(' OR ')})`)
      values.push(`%${q.search}%`)
      index += 1
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      values,
      nextIndex: index,
    }
  }

  /** ORDER BY, with the requested column validated against the allowlist. */
  protected buildOrderBy(q: PageQuery): string {
    const requested = q.sort ? this.toColumnName(q.sort) : null
    const column = requested && this.columns.includes(requested) ? requested : this.defaultSort
    const direction = q.order === 'asc' ? 'ASC' : 'DESC'
    return `ORDER BY "${column}" ${direction}`
  }

  // ── IRepository ────────────────────────────────────────────────────────────

  async findById(id: string): Promise<TDomain | null> {
    const row = await queryOne<TRow>(
      `SELECT ${this.selection} FROM "${this.table}" WHERE id = $1`,
      [id],
    )
    return row ? this.toDomain(row) : null
  }

  async findMany(q: PageQuery): Promise<Paged<TDomain>> {
    const page = normalizePageQuery(q)
    const { clause, values, nextIndex } = this.buildWhere(page)

    /**
     * Two statements rather than a window function.
     *
     * `COUNT(*) OVER ()` would save a round trip but makes the planner
     * materialise the full result set to count it, which is slower than a
     * separate COUNT once the table is larger than a demo. They run in
     * parallel, so the round trip costs nothing in wall-clock terms.
     */
    const [rows, totals] = await Promise.all([
      query<TRow>(
        `SELECT ${this.selection} FROM "${this.table}" ${clause} ${this.buildOrderBy(page)}
         LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
        [...values, page.limit, (page.page - 1) * page.limit],
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${this.table}" ${clause}`,
        values,
      ),
    ])

    return paged(rows.map((r) => this.toDomain(r)), totals?.count ?? 0, page.page, page.limit)
  }

  async count(filters: Record<string, unknown> = {}): Promise<number> {
    const { clause, values } = this.buildWhere({ filters })
    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "${this.table}" ${clause}`,
      values,
    )
    return row?.count ?? 0
  }

  /**
   * INSERT from a column->value map.
   *
   * Keys are validated by `this.column()`, so a typo is an immediate error
   * rather than a column that silently never gets written.
   */
  protected async insertRow(
    values: Record<string, SqlValue>,
    client?: PoolClient,
  ): Promise<TDomain> {
    const entries = Object.entries(values).filter(([, v]) => v !== undefined)
    const names = entries.map(([k]) => this.column(k)).join(', ')
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ')

    const sql = `INSERT INTO "${this.table}" (${names}) VALUES (${placeholders})
                 RETURNING ${this.selection}`
    const params = entries.map(([, v]) => v)

    const row = client
      ? (await client.query<TRow>(sql, params)).rows[0]
      : (await query<TRow>(sql, params))[0]

    return this.toDomain(row)
  }

  /** UPDATE ... RETURNING, so one round trip both writes and reads back. */
  protected async updateRow(
    id: string,
    values: Record<string, SqlValue>,
    client?: PoolClient,
  ): Promise<TDomain | null> {
    const entries = Object.entries(values).filter(([, v]) => v !== undefined)
    if (entries.length === 0) return this.findById(id)

    const assignments = entries.map(([k], i) => `${this.column(k)} = $${i + 2}`).join(', ')

    const sql = `UPDATE "${this.table}" SET ${assignments} WHERE id = $1
                 RETURNING ${this.selection}`
    const params = [id, ...entries.map(([, v]) => v)]

    const row = client
      ? (await client.query<TRow>(sql, params)).rows[0]
      : (await query<TRow>(sql, params))[0]

    return row ? this.toDomain(row) : null
  }

  async delete(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      `DELETE FROM "${this.table}" WHERE id = $1 RETURNING id`,
      [id],
    )
    return rows.length > 0
  }

  /**
   * `create` and `update` from IRepository take a partial DOMAIN object, which
   * this class cannot map to columns without knowing the aggregate. Subclasses
   * override them and delegate to insertRow/updateRow with an explicit mapping
   * — that mapping is the one place a domain field name meets a column name,
   * and it is worth being able to point at.
   */
  abstract create(data: Partial<TDomain>): Promise<TDomain>
  abstract update(id: string, data: Partial<TDomain>): Promise<TDomain | null>
}
