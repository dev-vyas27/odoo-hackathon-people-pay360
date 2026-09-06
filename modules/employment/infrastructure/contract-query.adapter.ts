

import { query } from '@/lib/db'
import type { ContractQueryPort, ContractSnapshot, Period } from '@/modules/shared'
import { resolveApplicableContract } from '../domain/contract-resolution'

interface SnapshotRow {
  id: string
  employee_id: string
  wage: number
  salary_structure_id: string | null
  working_schedule_id: string | null
  department_id: string | null
  job_position_name: string | null
  starts_on: Date
  ends_on: Date | null
}

const SELECT_SNAPSHOT = `
  SELECT c.id,
         c.employee_id,
         c.wage,
         c.salary_structure_id,
         c.working_schedule_id,
         e.department_id,
         j.name AS job_position_name,
         c.starts_on,
         c.ends_on
    FROM contracts c
    JOIN employees e ON e.id = c.employee_id
    LEFT JOIN job_positions j ON j.id = e.job_position_id
`

function toSnapshot(row: SnapshotRow): ContractSnapshot {
  return {
    id: row.id,
    employeeId: row.employee_id,
    
    
    wage: Number(row.wage),
    salaryStructureId: row.salary_structure_id,
    workingScheduleId: row.working_schedule_id,
    departmentId: row.department_id,
    jobPositionName: row.job_position_name,
    start: row.starts_on,
    end: row.ends_on,
  }
}

export class PostgresContractQuery implements ContractQueryPort {
  async findApplicableContract(
    employeeId: string,
    period: Period,
  ): Promise<ContractSnapshot | null> {
    
    
    
    const rows = await query<SnapshotRow>(
      `${SELECT_SNAPSHOT}
        WHERE c.employee_id = $1
          AND daterange(c.starts_on, c.ends_on, '[]') && daterange($2::date, $3::date, '[]')`,
      [employeeId, period.start, period.end],
    )

    const candidates = rows.map(toSnapshot)
    return resolveApplicableContract(candidates, period)
  }

  async findByEmployee(employeeId: string): Promise<ContractSnapshot[]> {
    const rows = await query<SnapshotRow>(
      `${SELECT_SNAPSHOT} WHERE c.employee_id = $1 ORDER BY c.starts_on DESC`,
      [employeeId],
    )
    return rows.map(toSnapshot)
  }
}
