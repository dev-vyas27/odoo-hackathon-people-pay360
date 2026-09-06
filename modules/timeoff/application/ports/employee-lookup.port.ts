/**
 * What Time Off needs to know about an employee — consumed from Dev B's
 * `people` module.
 *
 * The interface itself lives in the shared contracts file so both sides compile
 * against one declaration. What lives HERE is the fallback: a null object used
 * until `people` registers the real adapter.
 *
 * That fallback is the reason this module was never blocked. Before
 * integration, Time Off treats every employee id as "exists, name unknown";
 * after integration the same code path gets real names, and not one line of the
 * use cases changed.
 */
import { PORT_KEYS, portOr, type EmployeeLookupPort, type EmployeeSummary } from '@/modules/shared'

export type { EmployeeLookupPort, EmployeeSummary }

/**
 * Deliberately permissive: `findById` returns a placeholder rather than null.
 *
 * Returning null would make every use case fail with "employee not found" before
 * `people` exists, which would have blocked this module for the first half of
 * the project — the exact outcome the port was introduced to avoid.
 */
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
