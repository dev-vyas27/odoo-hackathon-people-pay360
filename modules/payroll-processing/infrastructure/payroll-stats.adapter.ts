/**
 * PayrollStatsPort implementation — real aggregations for the dashboard.
 *
 * Everything is summed inside Postgres rather than in Node: the dashboard must
 * not download a thousand payslips to add them up. These are the queries the
 * KPI cards and charts run, and they are readable as SQL precisely because
 * there is no ORM in between.
 *
 * Only VALIDATED and PAID payslips count. Draft and computed figures are
 * working numbers, and reporting them as "salary paid" would overstate every
 * card on the dashboard.
 *
 * Amounts are `numeric` and come back as JS numbers (see the type parser in
 * lib/db.ts), already at two decimal places.
 */
import type { Period } from '@/modules/shared'
import { query, queryOne } from '@/lib/db'
import type {
  DepartmentCost,
  DuplicatePayslip,
  MonthlyTotal,
  PayrollStatsPort,
  PayrollTotals,
} from '../application/ports/payroll-stats.port'
import { PAYSLIPS_TABLE } from './payroll.tables'

/** The statuses that represent money actually committed. */
const COUNTED = `ps.status IN ('validated', 'paid')`

/** Payslip overlaps the period: each range starts before the other ends. */
const OVERLAPS = `ps.period_start <= $2 AND ps.period_end >= $1`

export class PayrollStatsAdapter implements PayrollStatsPort {
  async totals(period: Period, departmentId?: string, employeeType?: string): Promise<PayrollTotals> {
    const values: unknown[] = [period.start, period.end]
    let filters = ''

    // `employees` is joined INNER, not LEFT: `e.id` is the payslip's own FK and
    // unique, so this can only drop a payslip whose employee record vanished —
    // never duplicate a row.
    const needsEmployeeJoin = Boolean(departmentId || employeeType)

    if (departmentId) {
      values.push(departmentId)
      filters += ` AND e.department_id = $${values.length}`
    }
    if (employeeType) {
      values.push(employeeType)
      filters += ` AND e.employee_type = $${values.length}`
    }

    const row = await queryOne<{ total_net: number; payslip_count: number }>(
      `SELECT COALESCE(SUM(ps.net), 0) AS total_net,
              COUNT(*)::int            AS payslip_count
         FROM "${PAYSLIPS_TABLE}" ps
         ${needsEmployeeJoin ? 'JOIN "employees" e ON e.id = ps.employee_id' : ''}
        WHERE ${COUNTED} AND ${OVERLAPS}
              ${filters}`,
      values,
    )

    const count = row?.payslip_count ?? 0
    if (!count) return { totalNet: 0, payslipCount: 0, averageSalary: 0 }

    const totalNet = Number(row?.total_net ?? 0)
    return {
      totalNet,
      payslipCount: count,
      // Rounded to paise so the card never renders 41666.666666666664.
      averageSalary: Math.round((totalNet / count) * 100) / 100,
    }
  }

  async costByDepartment(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<DepartmentCost[]> {
    const values: unknown[] = [period.start, period.end]
    let filter = ''
    // Filtering a BREAKDOWN by department to one department is not a
    // contradiction: it is the honest way to answer "what did Engineering
    // cost", which collapses the chart to a single bar rather than leaving it
    // showing every other department's spend too.
    if (departmentId) {
      values.push(departmentId)
      filter += ` AND e.department_id = $${values.length}`
    }
    if (employeeType) {
      values.push(employeeType)
      filter += ` AND e.employee_type = $${values.length}`
    }

    const rows = await query<{ department_id: string | null; total: number }>(
      `SELECT e.department_id, COALESCE(SUM(ps.net), 0) AS total
         FROM "${PAYSLIPS_TABLE}" ps
         LEFT JOIN "employees" e ON e.id = ps.employee_id
        WHERE ${COUNTED} AND ${OVERLAPS}
        ${filter}
        GROUP BY e.department_id
        ORDER BY total DESC`,
      values,
    )

    return rows.map((row) => ({
      departmentId: row.department_id,
      total: Number(row.total),
    }))
  }

  async monthlyTrend(
    months: number,
    departmentId?: string,
    employeeType?: string,
  ): Promise<MonthlyTotal[]> {
    const span = Math.max(1, Math.trunc(months))
    const values: unknown[] = [span - 1]
    // One join covers both filters; adding it twice would duplicate every row.
    const join =
      departmentId || employeeType ? 'JOIN "employees" e ON e.id = ps.employee_id' : ''
    const conditions: string[] = []
    if (departmentId) {
      values.push(departmentId)
      conditions.push(`AND e.department_id = $${values.length}`)
    }
    if (employeeType) {
      values.push(employeeType)
      conditions.push(`AND e.employee_type = $${values.length}`)
    }
    const filter = conditions.join('\n          ')

    /**
     * Grouped by the payslip's OWN month, not by when it was computed: a
     * January run finalised in February belongs to January.
     *
     * date_trunc gives a real month boundary rather than string slicing, and
     * the window is expressed in SQL so the server's clock — not the client's —
     * decides what "the last six months" means.
     */
    const rows = await query<{ month: string; total: number }>(
      `SELECT to_char(date_trunc('month', ps.period_start), 'YYYY-MM') AS month,
              COALESCE(SUM(ps.net), 0) AS total
         FROM "${PAYSLIPS_TABLE}" ps
         ${join}
        WHERE ${COUNTED}
          AND ps.period_start >= date_trunc('month', CURRENT_DATE) - make_interval(months => $1)
          ${filter}
        GROUP BY date_trunc('month', ps.period_start)
        ORDER BY date_trunc('month', ps.period_start) ASC`,
      values,
    )

    return rows.map((row) => ({ month: row.month, total: Number(row.total) }))
  }

  async duplicatePayslips(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<DuplicatePayslip[]> {
    /**
     * The same employee paid twice for an overlapping period, across ANY runs.
     *
     * The database already forbids two payslips for one employee in one payrun
     * (`payslips_one_per_employee_per_run`), so anything this finds came from
     * two different runs covering the same month — exactly the operational
     * alert the dashboard wants, and the case a UNIQUE constraint cannot catch.
     */
    const values: unknown[] = [period.start, period.end]
    let filter = ''
    if (departmentId) {
      values.push(departmentId)
      filter += ` AND e.department_id = $${values.length}`
    }
    if (employeeType) {
      values.push(employeeType)
      filter += ` AND e.employee_type = $${values.length}`
    }

    const rows = await query<{ employee_id: string; employee_name: string; count: number }>(
      `SELECT ps.employee_id,
              COALESCE(e.name, 'Unknown employee') AS employee_name,
              COUNT(*)::int AS count
         FROM "${PAYSLIPS_TABLE}" ps
         LEFT JOIN "employees" e ON e.id = ps.employee_id
        WHERE ps.status <> 'cancelled' AND ${OVERLAPS}
        ${filter}
        GROUP BY ps.employee_id, e.name
       HAVING COUNT(*) > 1
        ORDER BY count DESC`,
      values,
    )

    return rows.map((row) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      count: row.count,
    }))
  }
}
