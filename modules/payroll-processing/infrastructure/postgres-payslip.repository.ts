/**
 * Postgres adapter for PayslipRepositoryPort.
 *
 * Two things worth knowing:
 *
 * 1. Reads join `employees`, `payruns` and `salary_structures` for the names
 *    every screen shows, and pull the line items in the SAME statement as an
 *    aggregated JSON array. A payrun of 200 payslips is one round trip, not 201.
 *
 * 2. Writes are a transaction. Recompute deletes the run's payslips and inserts
 *    the new set; `payslip_lines` has ON DELETE CASCADE, so the old lines go
 *    with them. A half-written recompute would leave a payslip whose lines do
 *    not add up to its own totals, which is the one thing a payslip must never
 *    be able to do.
 */
import { Money, Period, type PayslipStatus } from '@/modules/shared'
import { query, queryOne, transaction } from '@/lib/db'
import type { ComputedLine } from '@/modules/payroll-config'
import { totalForCategory } from '@/modules/payroll-config'
import type { PayslipRepositoryPort } from '../application/ports/payslip-repository.port'
import type { Payslip } from '../domain/payslip'
import {
  PAYSLIP_LINES_TABLE,
  PAYSLIPS_TABLE,
  type PayslipLineJson,
  type PayslipReadRow,
} from './payroll.tables'

/**
 * The one projection every read shares.
 *
 * `json_agg(... ORDER BY sequence)` inside a correlated subquery keeps the
 * lines in execution order without a second query or a client-side sort — the
 * order IS the computation, so it belongs in the query that fetches it.
 */
const SELECT_PAYSLIP = `
  SELECT ps.id, ps.payrun_id, ps.employee_id, ps.contract_id,
         ps.period_start, ps.period_end, ps.worked_days,
         ps.basic, ps.gross, ps.deductions, ps.net,
         ps.status, ps.created_at, ps.updated_at,
         e.name  AS employee_name,
         e.email AS employee_email,
         e.department_id,
         pr.name AS payrun_name,
         pr.salary_structure_id,
         s.name  AS structure_name,
         COALESCE((
           SELECT json_agg(
                    json_build_object(
                      'code', l.code, 'name', l.name, 'category', l.category,
                      'sequence', l.sequence, 'amount', l.amount
                    ) ORDER BY l.sequence
                  )
             FROM "${PAYSLIP_LINES_TABLE}" l
            WHERE l.payslip_id = ps.id
         ), '[]'::json) AS lines
    FROM "${PAYSLIPS_TABLE}" ps
    JOIN "payruns" pr ON pr.id = ps.payrun_id
    JOIN "salary_structures" s ON s.id = pr.salary_structure_id
    LEFT JOIN "employees" e ON e.id = ps.employee_id
`

function toDomain(row: PayslipReadRow): Payslip {
  return {
    id: row.id,
    payrunId: row.payrun_id,
    payrunName: row.payrun_name,
    employeeId: row.employee_id,
    // LEFT JOIN: an employee row deleted out from under a historical payslip
    // must not make the payslip unreadable.
    employeeName: row.employee_name ?? 'Unknown employee',
    employeeEmail: row.employee_email ?? null,
    departmentId: row.department_id ?? null,
    contractId: row.contract_id,
    structureId: row.salary_structure_id,
    structureName: row.structure_name,
    period: Period.of(row.period_start, row.period_end),
    workedDays: Number(row.worked_days),
    lines: (row.lines ?? []).map(toLine),
    status: row.status,
  }
}

/** JSON numbers arrive as `number`; a very large numeric arrives as a string. */
function toLine(line: PayslipLineJson): ComputedLine {
  return {
    code: line.code,
    name: line.name,
    category: line.category,
    sequence: Number(line.sequence),
    amount: Money.of(Number(line.amount)),
  }
}

export class PostgresPayslipRepository implements PayslipRepositoryPort {
  async findById(id: string): Promise<Payslip | null> {
    const row = await queryOne<PayslipReadRow>(`${SELECT_PAYSLIP} WHERE ps.id = $1`, [id])
    return row ? toDomain(row) : null
  }

  async findByPayrun(payrunId: string): Promise<Payslip[]> {
    const rows = await query<PayslipReadRow>(
      `${SELECT_PAYSLIP} WHERE ps.payrun_id = $1 ORDER BY e.name ASC NULLS LAST`,
      [payrunId],
    )
    return rows.map(toDomain)
  }

  async replaceForPayrun(payrunId: string, payslips: Payslip[]): Promise<Payslip[]> {
    await transaction(async (client) => {
      // payslip_lines cascades, so this clears the previous computation whole.
      await client.query(`DELETE FROM "${PAYSLIPS_TABLE}" WHERE payrun_id = $1`, [payrunId])

      for (const payslip of payslips) {
        const lines = [...payslip.lines]

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO "${PAYSLIPS_TABLE}"
             (payrun_id, employee_id, contract_id, period_start, period_end,
              worked_days, basic, gross, deductions, net, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            payrunId,
            payslip.employeeId,
            payslip.contractId,
            payslip.period.start,
            payslip.period.end,
            payslip.workedDays,
            // Denormalised totals, derived from the very lines written below so
            // the two can never disagree.
            totalForCategory(lines, 'basic').toNumber(),
            totalForCategory(lines, 'gross').toNumber(),
            totalForCategory(lines, 'deduction').toNumber(),
            totalForCategory(lines, 'net').toNumber(),
            payslip.status,
          ],
        )

        if (!lines.length) continue

        /**
         * One multi-row INSERT per payslip rather than one per line.
         *
         * The tuples list `$1` (the payslip id) in every row rather than
         * selecting from a `(VALUES ...) AS v(...)` derived table. That is not
         * a style choice: inside a standalone VALUES subquery Postgres has no
         * target column to infer parameter types from, so every `$n` binds as
         * `text` and the insert dies with
         * `column "sequence" is of type integer but expression is of type text`.
         * Writing the VALUES directly under the INSERT gives each parameter the
         * target column's type.
         */
        const values: unknown[] = []
        const tuples = lines.map((line, index) => {
          const base = index * 5
          values.push(line.code, line.name, line.category, line.sequence, line.amount.toNumber())
          return `($1, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
        })

        await client.query(
          `INSERT INTO "${PAYSLIP_LINES_TABLE}" (payslip_id, code, name, category, sequence, amount)
           VALUES ${tuples.join(', ')}`,
          [inserted.rows[0].id, ...values],
        )
      }
    })

    // Read back through the shared projection so callers get the joined names.
    return this.findByPayrun(payrunId)
  }

  async findOverlapping(
    employeeIds: string[],
    period: Period,
    excludePayrunId: string,
  ): Promise<Payslip[]> {
    if (!employeeIds.length) return []

    // Two ranges overlap when each starts before the other ends.
    const rows = await query<PayslipReadRow>(
      `${SELECT_PAYSLIP}
        WHERE ps.employee_id = ANY($1)
          AND ps.payrun_id <> $2
          AND ps.period_start <= $4
          AND ps.period_end   >= $3`,
      [employeeIds, excludePayrunId, period.start, period.end],
    )
    return rows.map(toDomain)
  }

  async setStatusForPayrun(payrunId: string, status: PayslipStatus): Promise<void> {
    await query(`UPDATE "${PAYSLIPS_TABLE}" SET status = $2 WHERE payrun_id = $1`, [
      payrunId,
      status,
    ])
  }
}
