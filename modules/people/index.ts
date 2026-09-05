/**
 * Public surface of the "people" module.  ·  Owner: Dev B
 *
 * Everything other modules may use is re-exported HERE. Internals under
 * domain/, application/, infrastructure/ and interface/ are private, and the
 * ESLint boundary rule rejects imports that reach into them.
 *
 * Consumers today: timeoff (Dev A), payroll-processing (Dev C), analytics (Dev A).
 */

// --- Domain vocabulary shared across modules -------------------------------
export {
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  isEmployeeType,
  type EmployeeType,
} from './domain/employee-type'

// --- Published port (the contract other modules code against) --------------
export type {
  EmployeeLookupPort,
  EmployeeSummary,
  EligibilityFilter,
} from './application/ports/employee-lookup.port'

// --- Implementation selection ----------------------------------------------
import { StubEmployeeLookup } from './infrastructure/employee-lookup.stub'
import type { EmployeeLookupPort } from './application/ports/employee-lookup.port'

/**
 * Factory consumers call from the composition root.
 *
 * Swapping the stub for the Mongo adapter in Phase 3 changes this ONE line —
 * no consumer touches an import. That is the whole point of the port.
 */
export function createEmployeeLookup(): EmployeeLookupPort {
  return new StubEmployeeLookup()
}
