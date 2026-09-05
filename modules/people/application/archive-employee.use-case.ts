import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type IEventBus,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { Employee } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'

export interface ArchiveEmployeeInput {
  actor: Actor
  id: string
}

/**
 * Archiving is a soft-delete: `isActive` flips to false and `EmployeeArchived`
 * is published so other modules (schedules, dashboards) can react without
 * this module knowing who is listening.
 */
export class ArchiveEmployeeUseCase implements UseCase<ArchiveEmployeeInput, Employee> {
  constructor(
    private readonly repo: EmployeeRepositoryPort,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: ArchiveEmployeeInput): Promise<Result<Employee>> {
    const gate = authorize(input.actor, 'employee', 'delete')
    if (!gate.ok) return gate

    const existing = await this.repo.findById(input.id)
    if (!existing) {
      return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', `No employee with id ${input.id}`))
    }

    const archived = existing.archive()
    const saved = await this.repo.update(input.id, archived)
    if (!saved) {
      return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', `No employee with id ${input.id}`))
    }

    await this.eventBus.publish({
      type: 'employee.archived',
      employeeId: saved.id,
      occurredAt: new Date(),
    })

    return Ok(saved)
  }
}
