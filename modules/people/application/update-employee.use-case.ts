import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import type { Employee, EmployeeInput } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'

export interface UpdateEmployeeInput {
  actor: Actor
  id: string
  patch: Partial<EmployeeInput>
}

export class UpdateEmployeeUseCase implements UseCase<UpdateEmployeeInput, Employee> {
  constructor(private readonly repo: EmployeeRepositoryPort) {}

  async execute(input: UpdateEmployeeInput): Promise<Result<Employee>> {
    const gate = authorize(input.actor, 'employee', 'update')
    if (!gate.ok) return gate

    const existing = await this.repo.findById(input.id)
    if (!existing) {
      return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', `No employee with id ${input.id}`))
    }

    if (input.patch.email) {
      const owner = await this.repo.findByEmail(input.patch.email.trim().toLowerCase())
      if (owner && owner.id !== existing.id) {
        return Err(DomainError.conflict('EMPLOYEE_EMAIL_TAKEN', `Email ${input.patch.email} is already in use`))
      }
    }

    const updated = existing.update(input.patch)
    if (!updated.ok) return updated

    const saved = await this.repo.update(input.id, updated.value)
    if (!saved) {
      return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', `No employee with id ${input.id}`))
    }
    return Ok(saved)
  }
}
