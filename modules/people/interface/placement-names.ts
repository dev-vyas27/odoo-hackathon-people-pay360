


import { query } from '@/lib/db'

export interface Placement {
  departmentName: string | null
  jobPositionName: string | null
  managerName: string | null
  workingScheduleName: string | null
}

interface NameRow {
  id: string
  name: string
}


function idsOf(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))]
}



async function namesFor(
  table: 'departments' | 'job_positions' | 'employees' | 'working_schedules',
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string>()
  


  const rows = await query<NameRow>(
    `SELECT id, name FROM "${table}" WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((row) => [row.id, row.name]))
}

export interface HasPlacement {
  departmentId?: string | null
  jobPositionId?: string | null
  managerId?: string | null
  workingScheduleId?: string | null
}



export async function resolvePlacement(
  employees: readonly HasPlacement[],
): Promise<(employee: HasPlacement) => Placement> {
  const [departments, positions, managers, schedules] = await Promise.all([
    namesFor('departments', idsOf(employees.map((e) => e.departmentId))),
    namesFor('job_positions', idsOf(employees.map((e) => e.jobPositionId))),
    namesFor('employees', idsOf(employees.map((e) => e.managerId))),
    namesFor('working_schedules', idsOf(employees.map((e) => e.workingScheduleId))),
  ])

  return (employee) => ({
    departmentName: employee.departmentId
      ? (departments.get(employee.departmentId) ?? null)
      : null,
    jobPositionName: employee.jobPositionId
      ? (positions.get(employee.jobPositionId) ?? null)
      : null,
    managerName: employee.managerId ? (managers.get(employee.managerId) ?? null) : null,
    workingScheduleName: employee.workingScheduleId
      ? (schedules.get(employee.workingScheduleId) ?? null)
      : null,
  })
}
