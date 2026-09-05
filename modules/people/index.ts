/**
 * Public surface of the "people" module.  ·  Owner: Dev B
 *
 * Everything other modules may use is re-exported HERE. Internals under
 * domain/, application/, infrastructure/ and interface/ are private, and the
 * ESLint boundary rule rejects imports that reach into them.
 *
 * The cross-module port types (EmployeeSummary, EmployeeLookupPort) now live in
 * modules/shared/contracts/dto.ts — consumers import them from '@/modules/shared'
 * and get the implementation through the container, not from here.
 */
import { providePort, PORT_KEYS, type EmployeeLookupPort } from '@/modules/shared'
import { PostgresEmployeeLookup } from './infrastructure/employee-lookup.adapter'

// --- Domain vocabulary shared across modules -------------------------------
export {
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  isEmployeeType,
  type EmployeeType,
} from './domain/employee-type'

// --- Interface layer, for the route handlers in app/api ---------------------
export * from './interface/employee.controller'
export * from './interface/department.controller'
export * from './interface/job-position.controller'
export * from './interface/employee.schema'
export * from './interface/department.schema'
export * from './interface/job-position.schema'

// --- Persistence, for scripts/seed and the composition root -----------------
export { PostgresEmployeeRepository } from './infrastructure/postgres-employee.repository'
export { PostgresDepartmentRepository } from './infrastructure/postgres-department.repository'
export { PostgresJobPositionRepository } from './infrastructure/postgres-job-position.repository'
export { PostgresEmployeeLookup } from './infrastructure/employee-lookup.adapter'

/**
 * Publish our implementation of EmployeeLookupPort.
 *
 * Consumers (Time Off, Payroll, Analytics) call
 * `getPort(PORT_KEYS.employeeLookup)` and never import this module's classes,
 * so swapping the implementation touches this one line.
 */
export function registerPeople(): void {
  providePort<EmployeeLookupPort>(PORT_KEYS.employeeLookup, () => new PostgresEmployeeLookup())
}

/** Direct construction, for callers that are inside the composition root. */
export function createEmployeeLookup(): EmployeeLookupPort {
  return new PostgresEmployeeLookup()
}
