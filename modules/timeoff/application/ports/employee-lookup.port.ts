


import { PORT_KEYS, portOr, type EmployeeLookupPort, type EmployeeSummary } from '@/modules/shared'

export type { EmployeeLookupPort, EmployeeSummary }



export const UNRESOLVED_EMPLOYEE_LOOKUP: EmployeeLookupPort = {
  async findById(employeeId) {
    return placeholder(employeeId)
  },
  async findManyByIds(ids) {
    return ids.map(placeholder)
  },
  async findEligible() {
    return []
  },
}

function placeholder(id: string): EmployeeSummary {
  return {
    id,
    name: `Employee ${id.slice(-6)}`,
    email: '',
    departmentId: null,
    departmentName: null,
    jobPositionName: null,
    employeeType: 'full_time',
    managerId: null,
    workingScheduleId: null,
    bankAccount: null,
    isActive: true,
  }
}

export function employeeLookup(): EmployeeLookupPort {
  return portOr(PORT_KEYS.employeeLookup, UNRESOLVED_EMPLOYEE_LOOKUP)
}
