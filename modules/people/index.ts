


import {
  providePort,
  PORT_KEYS,
  type EmployeeLookupPort,
  type EmployeeStatsPort,
} from '@/modules/shared'
import { PostgresEmployeeLookup } from './infrastructure/employee-lookup.adapter'
import { PostgresEmployeeStats } from './infrastructure/employee-stats.adapter'


export {
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  isEmployeeType,
  type EmployeeType,
} from './domain/employee-type'


export * from './interface/employee.controller'
export * from './interface/department.controller'
export * from './interface/job-position.controller'
export * from './interface/employee.schema'
export * from './interface/department.schema'
export * from './interface/job-position.schema'


export { PostgresEmployeeRepository } from './infrastructure/postgres-employee.repository'
export { PostgresDepartmentRepository } from './infrastructure/postgres-department.repository'
export { PostgresJobPositionRepository } from './infrastructure/postgres-job-position.repository'
export { PostgresEmployeeLookup } from './infrastructure/employee-lookup.adapter'
export { PostgresEmployeeStats } from './infrastructure/employee-stats.adapter'



export { NOT_AN_ADMIN } from './infrastructure/people.tables'



export function registerPeople(): void {
  providePort<EmployeeLookupPort>(PORT_KEYS.employeeLookup, () => new PostgresEmployeeLookup())
  providePort<EmployeeStatsPort>(PORT_KEYS.employeeStats, () => new PostgresEmployeeStats())
}


export function createEmployeeLookup(): EmployeeLookupPort {
  return new PostgresEmployeeLookup()
}
