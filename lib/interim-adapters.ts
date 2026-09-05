/**
 * ⚠ SCAFFOLDING — delete when Dev B's `people` module registers for real.
 *
 * Time Off needs employee names for its list views and an employee picker for
 * its forms. Both go through `EmployeeLookupPort`, which `people` owns and has
 * not published yet. The null object in
 * `modules/timeoff/application/ports/employee-lookup.port.ts` keeps the module
 * COMPILING without it, but it returns placeholder names and an empty picker,
 * which makes the screens impossible to demonstrate.
 *
 * So this reads the `employees` table directly. It is deliberately in `lib/`
 * rather than inside a module: it is not anyone's domain logic, it is a
 * temporary bridge, and putting it here means nobody mistakes it for the real
 * implementation.
 *
 * `providePort` is first-wins, and `bootstrap.ts` calls this LAST. The moment
 * Dev B calls `registerPeople()` ahead of it, their adapter takes over and this
 * one is never consulted again — no code changes anywhere else, and the only
 * cleanup is deleting this file plus one line in bootstrap.
 */
import { query } from '@/lib/db'
import {
  PORT_KEYS,
  container,
  providePort,
  type EmployeeLookupPort,
  type EmployeeSummary,
  type EmployeeType,
} from '@/modules/shared'

interface EmployeeRow {
  id: string
  name: string
  email: string
  department_id: string | null
  department_name: string | null
  job_position_name: string | null
  employee_type: EmployeeType
  manager_id: string | null
  working_schedule_id: string | null
  bank_account: string | null
  is_active: boolean
}

const SELECT = `
  SELECT e.id, e.name, e.email,
         e.department_id, d.name AS department_name,
         j.name AS job_position_name,
         e.employee_type, e.manager_id, e.working_schedule_id,
         e.bank_account, e.is_active
    FROM employees e
    LEFT JOIN departments   d ON d.id = e.department_id
    LEFT JOIN job_positions j ON j.id = e.job_position_id
`

function toSummary(row: EmployeeRow): EmployeeSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    departmentId: row.department_id,
    departmentName: row.department_name,
    jobPositionName: row.job_position_name,
    employeeType: row.employee_type,
    managerId: row.manager_id,
    workingScheduleId: row.working_schedule_id,
    bankAccount: row.bank_account,
    isActive: row.is_active,
  }
}

const interimEmployeeLookup: EmployeeLookupPort = {
  async findById(employeeId) {
    const rows = await query<EmployeeRow>(`${SELECT} WHERE e.id = $1`, [employeeId])
    return rows[0] ? toSummary(rows[0]) : null
  },

  async findManyByIds(ids) {
    if (ids.length === 0) return []
    const rows = await query<EmployeeRow>(`${SELECT} WHERE e.id = ANY($1)`, [ids])
    return rows.map(toSummary)
  },

  async findEligible(filter) {
    const rows = await query<EmployeeRow>(
      `${SELECT}
        WHERE e.is_active = true
          AND ($1::uuid IS NULL OR e.department_id = $1)
          AND ($2::text IS NULL OR e.employee_type = $2)
        ORDER BY e.name ASC`,
      [filter.departmentId ?? null, filter.employeeType ?? null],
    )
    return rows.map(toSummary)
  },
}

/** Fills any port nobody has claimed yet. Called last, so real wins over interim. */
export function registerInterimAdapters(): void {
  if (!container().ports.has(PORT_KEYS.employeeLookup)) {
    console.warn(
      '[bootstrap] using the INTERIM employee lookup — delete lib/interim-adapters.ts once modules/people registers EmployeeLookupPort',
    )
  }
  providePort<EmployeeLookupPort>(PORT_KEYS.employeeLookup, () => interimEmployeeLookup)
}
