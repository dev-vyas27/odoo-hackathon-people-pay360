import {
  authorize,
  scopeToSelf,
  Ok,
  type Actor,
  type Paged,
  type PageQuery,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { Employee } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'

export interface ListEmployeesInput {
  actor: Actor
  query: PageQuery
}

/**
 * List / search / filter employees.
 *
 * Row-level access lives here, not in `proxy.ts`: an `employee` role can list
 * "employees" but the result must be scoped to nobody but themselves, since
 * they have no employeeId to compare a single record against the way
 * `authorizeOwned` does for a get-by-id.
 */
export class ListEmployeesUseCase implements UseCase<ListEmployeesInput, Paged<Employee>> {
  constructor(private readonly repo: EmployeeRepositoryPort) {}

  async execute(input: ListEmployeesInput): Promise<Result<Paged<Employee>>> {
    const gate = authorize(input.actor, 'employee', 'read')
    if (!gate.ok) return gate

    let query = input.query
    if (scopeToSelf(input.actor.role)) {
      query = {
        ...query,
        filters: { ...(query.filters ?? {}), id: input.actor.employeeId ?? '__none__' },
      }
    }

    const page = await this.repo.findMany(query)
    return Ok(page)
  }
}
