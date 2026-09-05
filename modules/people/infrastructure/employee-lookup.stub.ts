/**
 * Temporary stub for EmployeeLookupPort.
 *
 * Exists so Dev A (Time Off) and Dev C (Payroll) can wire the container and
 * compile against the real interface before the Mongo adapter is written. It is
 * replaced by `employee-lookup.adapter.ts` in Phase 3 (H10-H14) and this file is
 * then deleted.
 *
 * Every method throws a message that names the owner and the port, because
 * "Cannot read properties of undefined" at 3am tells nobody anything.
 */
import type {
  EmployeeLookupPort,
  EmployeeSummary,
} from '../application/ports/employee-lookup.port'

function pending(method: string): never {
  throw new Error(
    `EmployeeLookupPort.${method}() is not implemented yet (owner: Dev B, people module). ` +
      `Expected in Phase 3. If you need it sooner, ask rather than working around it.`,
  )
}

export class StubEmployeeLookup implements EmployeeLookupPort {
  async findById(): Promise<EmployeeSummary | null> {
    return pending('findById')
  }

  async findManyByIds(): Promise<EmployeeSummary[]> {
    return pending('findManyByIds')
  }

  async findEligible(): Promise<EmployeeSummary[]> {
    return pending('findEligible')
  }
}
