


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


const COUNTED = `ps.status IN ('validated', 'paid')`


const OVERLAPS = `ps.period_start <= $2 AND ps.period_end >= $1`

export class PayrollStatsAdapter implements PayrollStatsPort {
  async totals(period: Period, departmentId?: string, employeeType?: string): Promise<PayrollTotals> {
    const values: unknown[] = [period.start, period.end]
    let filters = ''

    
    
    
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
