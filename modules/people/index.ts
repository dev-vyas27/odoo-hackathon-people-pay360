/**
 * Public surface of the "people" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * Owner: see docs/plans/ — do not add exports for another team's module.
 */
export type { EmployeeLookupPort, EmployeeSummary } from './application/ports/employee-lookup.port'
export { createEmployeeLookup } from './infrastructure/employee-lookup.adapter'
export { EMPLOYEE_TYPES, isEmployeeType, type EmployeeType } from './domain/employee-type'

// --- HTTP-facing surface consumed by app/api/** route handlers only. ---
export {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  type CreateEmployeeBody,
  type UpdateEmployeeBody,
  type EmployeeQuery,
} from './interface/employee.schema'
export {
  createEmployee,
  updateEmployee,
  listEmployees,
  archiveEmployee,
  getEmployeeDetail,
} from './interface/employee.controller'

export {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentQuerySchema,
  type CreateDepartmentBody,
  type UpdateDepartmentBody,
} from './interface/department.schema'
export {
  createDepartment,
  updateDepartment,
  listDepartments,
  getDepartment,
  deleteDepartment,
} from './interface/department.controller'

export {
  createJobPositionSchema,
  updateJobPositionSchema,
  jobPositionQuerySchema,
  type CreateJobPositionBody,
  type UpdateJobPositionBody,
} from './interface/job-position.schema'
export {
  createJobPosition,
  updateJobPosition,
  listJobPositions,
  getJobPosition,
  deleteJobPosition,
} from './interface/job-position.controller'
