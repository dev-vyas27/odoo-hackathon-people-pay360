

import { query, queryOne } from '@/lib/db'
import type { EmployeeLookupPort, EmployeeSummary, EmployeeType } from '@/modules/shared'

interface SummaryRow {
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

const SELECT_SUMMARY = `
  SELECT e.id,
         e.name,
         e.email,
         e.department_id,
         d.name AS department_name,
         j.name AS job_position_name,
         e.employee_type,
         e.manager_id,
         e.working_schedule_id,
         e.bank_account,
         e.is_active
    FROM employees e
    LEFT JOIN departments   d ON d.id = e.department_id
    LEFT JOIN job_positions j ON j.id = e.job_position_id
`

function toSummary(row: SummaryRow): EmployeeSummary {
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

export class PostgresEmployeeLookup implements EmployeeLookupPort {
  async findById(employeeId: string): Promise<EmployeeSummary | null> {
    const row = await queryOne<SummaryRow>(`${SELECT_SUMMARY} WHERE e.id = $1`, [employeeId])
    return row ? toSummary(row) : null
  }

  
  async findManyByIds(ids: string[]): Promise<EmployeeSummary[]> {
    if (ids.length === 0) return []
    const rows = await query<SummaryRow>(`${SELECT_SUMMARY} WHERE e.id = ANY($1::uuid[])`, [ids])
    return rows.map(toSummary)
  }

  

  async findEligible(filter: {
    departmentId?: string
    employeeType?: string
    activeOn: Date
  }): Promise<EmployeeSummary[]> {
    const conditions = ['e.is_active = true']
    const values: unknown[] = []

    if (filter.departmentId) {
      values.push(filter.departmentId)
      conditions.push(`e.department_id = $${values.length}`)
    }
    if (filter.employeeType) {
      values.push(filter.employeeType)
      conditions.push(`e.employee_type = $${values.length}`)
    }

    const rows = await query<SummaryRow>(
      `${SELECT_SUMMARY} WHERE ${conditions.join(' AND ')} ORDER BY e.name ASC`,
      values,
    )
    return rows.map(toSummary)
  }
}
