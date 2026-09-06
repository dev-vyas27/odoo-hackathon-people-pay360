


import { query, queryOne, type PoolClient } from '@/lib/db'
import type { QueryResultRow } from 'pg'
import type { IRepository, PageQuery, Paged } from '../application/repository'
import { normalizePageQuery, paged } from '../application/repository'


export type SqlValue = string | number | boolean | Date | null | undefined

export abstract class BaseSqlRepository<TDomain, TRow extends QueryResultRow>
  implements IRepository<TDomain>
{
  
  protected abstract readonly table: string

  


  protected abstract readonly columns: readonly string[]

  
  protected readonly searchable: readonly string[] = []

  
  protected readonly defaultSort: string = 'created_at'

  protected abstract toDomain(row: TRow): TDomain

  

  
  protected column(name: string): string {
    if (!this.columns.includes(name)) {
      throw new Error(`Unknown column "${name}" on ${this.table}`)
    }
    return `"${name}"`
  }

  


  protected toColumnName(key: string): string {
    return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
  }

  protected get selection(): string {
    return this.columns.map((c) => `"${c}"`).join(', ')
  }

  

  


  protected buildWhere(
    q: PageQuery,
    startIndex = 1,
  ): { clause: string; values: SqlValue[]; nextIndex: number } {
    const conditions: string[] = []
    const values: SqlValue[] = []
    let index = startIndex

    for (const [key, raw] of Object.entries(q.filters ?? {})) {
      
      
      if (raw === undefined || raw === null || raw === '') continue

      const name = this.toColumnName(key)
      if (!this.columns.includes(name)) continue 

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

  
  protected buildOrderBy(q: PageQuery): string {
    const requested = q.sort ? this.toColumnName(q.sort) : null
    const column = requested && this.columns.includes(requested) ? requested : this.defaultSort
    const direction = q.order === 'asc' ? 'ASC' : 'DESC'
    return `ORDER BY "${column}" ${direction}`
  }

  

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

  


  abstract create(data: Partial<TDomain>): Promise<TDomain>
  abstract update(id: string, data: Partial<TDomain>): Promise<TDomain | null>
}
