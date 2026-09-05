/**
 * Postgres adapter for PayrunRepositoryPort.
 *
 * A payrun spans two tables: `payruns` and the `payrun_employees` join that
 * records exactly who the wizard selected. Both are written in one transaction,
 * because a payrun that saved without its employees would compute an empty
 * payroll and look successful.
 *
 * Reads join `salary_structures` for the name and aggregate the employee ids in
 * the same statement, so the list screen is one query rather than one per row.
 */
import { Period, type PageQuery, type Paged } from '@/modules/shared'
import { normalizePageQuery, paged } from '@/modules/shared'
import { query, queryOne, transaction } from '@/lib/db'
import type { PayrunRepositoryPort } from '../application/ports/payrun-repository.port'
import { createPayrun, type Payrun } from '../domain/payrun'
import type { PayrunStatus } from '../domain/payrun-state'
import {
  PAYRUN_EMPLOYEES_TABLE,
  PAYRUNS_TABLE,
  type PayrunReadRow,
} from './payroll.tables'

/**
 * The projection every read uses.
 *
 * `array_remove(array_agg(pe.employee_id), NULL)` yields `{}` rather than
 * `{NULL}` for a payrun with no employees, which is what a LEFT JOIN over an
 * empty join table would otherwise produce.
 */
const SELECT_PAYRUN = `
  SELECT p.id, p.name, p.salary_structure_id, p.period_start, p.period_end,
         p.status, p.created_at, p.updated_at,
         s.name AS structure_name,
         array_remove(array_agg(pe.employee_id), NULL) AS employee_ids
    FROM "${PAYRUNS_TABLE}" p
    JOIN "salary_structures" s ON s.id = p.salary_structure_id
    LEFT JOIN "${PAYRUN_EMPLOYEES_TABLE}" pe ON pe.payrun_id = p.id
`

const GROUP_BY = `GROUP BY p.id, s.name`

/** Sort columns a query string may name. A column name cannot be bound. */
const SORTABLE = new Set(['name', 'period_start', 'period_end', 'status', 'created_at'])

function toDomain(row: PayrunReadRow): Payrun {
  return createPayrun({
    id: row.id,
    name: row.name,
    structureId: row.salary_structure_id,
    structureName: row.structure_name,
    period: Period.of(row.period_start, row.period_end),
    employeeIds: row.employee_ids ?? [],
    status: row.status,
    createdAt: row.created_at,
  })
}

export class PostgresPayrunRepository implements PayrunRepositoryPort {
  async findById(id: string): Promise<Payrun | null> {
    const row = await queryOne<PayrunReadRow>(
      `${SELECT_PAYRUN} WHERE p.id = $1 ${GROUP_BY}`,
      [id],
    )
    return row ? toDomain(row) : null
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<Payrun>> {
    const q = normalizePageQuery(pageQuery)

    const conditions: string[] = []
    const values: unknown[] = []

    const status = q.filters?.status
    if (typeof status === 'string' && status !== '') {
      values.push(status)
      conditions.push(`p.status = $${values.length}`)
    }

    if (q.search) {
      values.push(`%${q.search}%`)
      conditions.push(`(p.name ILIKE $${values.length} OR s.name ILIKE $${values.length})`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sort = q.sort && SORTABLE.has(q.sort) ? q.sort : 'period_start'
    const direction = q.order === 'asc' ? 'ASC' : 'DESC'

    const [rows, totals] = await Promise.all([
      query<PayrunReadRow>(
        `${SELECT_PAYRUN} ${where} ${GROUP_BY}
         ORDER BY p."${sort}" ${direction}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${PAYRUNS_TABLE}" p
           JOIN "salary_structures" s ON s.id = p.salary_structure_id ${where}`,
        values,
      ),
    ])

    return paged(rows.map(toDomain), totals?.count ?? 0, q.page, q.limit)
  }

  async count(filters: Record<string, unknown> = {}): Promise<number> {
    const status = filters.status
    const row =
      typeof status === 'string' && status !== ''
        ? await queryOne<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM "${PAYRUNS_TABLE}" WHERE status = $1`,
            [status],
          )
        : await queryOne<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM "${PAYRUNS_TABLE}"`,
          )
    return row?.count ?? 0
  }

  async create(payrun: Payrun): Promise<Payrun> {
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO "${PAYRUNS_TABLE}" (name, salary_structure_id, period_start, period_end, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          payrun.name,
          payrun.structureId,
          payrun.period.start,
          payrun.period.end,
          payrun.status,
        ],
      )
      const newId = inserted.rows[0].id

      const employeeIds = [...payrun.employeeIds]
      if (employeeIds.length) {
        // unnest expands one array parameter into rows: a single statement
        // whatever the size of the selection.
        await client.query(
          `INSERT INTO "${PAYRUN_EMPLOYEES_TABLE}" (payrun_id, employee_id)
           SELECT $1, unnest($2::uuid[])`,
          [newId, employeeIds],
        )
      }

      return newId
    })

    // Read back through the same projection every other caller sees, so the
    // returned aggregate carries the joined structure name.
    const created = await this.findById(id)
    if (!created) {
      throw new Error(`Payrun ${id} vanished immediately after insert`)
    }
    return created
  }

  async updateStatus(id: string, status: PayrunStatus): Promise<Payrun | null> {
    const updated = await queryOne<{ id: string }>(
      `UPDATE "${PAYRUNS_TABLE}" SET status = $2 WHERE id = $1 RETURNING id`,
      [id, status],
    )
    return updated ? this.findById(id) : null
  }
}
