/**
 * Postgres implementation of the shared EmployeeStatsPort.
 *
 * Headcount and roster-health queries for the dashboard (spec A7/B9). Moved
 * here from `lib/interim-stats.ts`, which had to read these tables directly
 * because nobody had registered the real port yet — the SQL is unchanged from
 * that scaffolding, only its ownership.
 *
 * "An administrator is not a member of staff" is applied via NOT_AN_ADMIN so a
 * headcount here can never disagree with the employee list, which applies the
 * same constant.
 */
import { query } from '@/lib/db'
import type { EmployeeStatsPort, EmployeeType } from '@/modules/shared'
import { NOT_AN_ADMIN } from './people.tables'

export class PostgresEmployeeStats implements EmployeeStatsPort {
  async headcount(filter?: { departmentId?: string; employeeType?: string }): Promise<number> {
    const rows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM employees
        WHERE is_active = true
          AND ${NOT_AN_ADMIN}
          AND ($1::uuid IS NULL OR department_id = $1)
          AND ($2::text IS NULL OR employee_type = $2)`,
      [filter?.departmentId ?? null, filter?.employeeType ?? null],
    )
    return rows[0]?.count ?? 0
  }

  async headcountByDepartment(filter?: {
    departmentId?: string
    employeeType?: string
  }): Promise<Array<{ departmentId: string; departmentName: string; count: number }>> {
    /**
     * LEFT JOIN from departments, not from employees: a department with nobody
     * in it still belongs on the breakdown and still belongs in the filter
     * dropdown. Joining the other way would make it vanish.
     */
    const rows = await query<{ department_id: string; department_name: string; count: number }>(
      `SELECT d.id            AS department_id,
              d.name          AS department_name,
              COUNT(e.id)::int AS count
         FROM departments d
         LEFT JOIN employees e
                ON e.department_id = d.id
               AND e.is_active = true
               AND e.${NOT_AN_ADMIN}
               AND ($1::text IS NULL OR e.employee_type = $1)
        WHERE d.is_active = true
        GROUP BY d.id, d.name
        ORDER BY d.name ASC`,
      [filter?.employeeType ?? null],
    )
    return rows.map((r) => ({
      departmentId: r.department_id,
      departmentName: r.department_name,
      count: r.count,
    }))
  }

  async headcountByEmployeeType(): Promise<Array<{ employeeType: EmployeeType; count: number }>> {
    const rows = await query<{ employee_type: EmployeeType; count: number }>(
      `SELECT employee_type, COUNT(*)::int AS count
         FROM employees
        WHERE is_active = true
          AND ${NOT_AN_ADMIN}
        GROUP BY employee_type
        ORDER BY count DESC`,
    )
    return rows.map((r) => ({ employeeType: r.employee_type, count: r.count }))
  }

  async missingBankDetails(): Promise<Array<{ employeeId: string; name: string }>> {
    /**
     * Spec B9's "missing required information" alert. Dev C's payrun validation
     * reads the same column before finalising.
     *
     * Administrators are excluded: the alert exists to catch someone who cannot
     * be PAID, and an operator account was never going to be. Left in, it
     * reported a problem nobody could fix — there is no bank account to add for
     * a login.
     */
    const rows = await query<{ id: string; name: string }>(
      `SELECT id, name
         FROM employees
        WHERE is_active = true
          AND ${NOT_AN_ADMIN}
          AND (bank_account IS NULL OR btrim(bank_account) = '')
        ORDER BY name ASC`,
    )
    return rows.map((r) => ({ employeeId: r.id, name: r.name }))
  }
}
