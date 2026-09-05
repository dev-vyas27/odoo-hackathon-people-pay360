import { authorize, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import { Employee, type EmployeeInput } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'

export interface CreateEmployeeInput extends EmployeeInput {
  actor: Actor
}

export class CreateEmployeeUseCase implements UseCase<CreateEmployeeInput, Employee> {
  constructor(private readonly repo: EmployeeRepositoryPort) {}

  async execute(input: CreateEmployeeInput): Promise<Result<Employee>> {
    const gate = authorize(input.actor, 'employee', 'create')
    if (!gate.ok) return gate

    const draft = Employee.create(input)
    if (!draft.ok) return draft

    const existing = await this.repo.findByEmail(draft.value.email)
    if (existing) {
      return Err(
        DomainError.conflict('EMPLOYEE_EMAIL_TAKEN', `An employee with email ${draft.value.email} already exists`),
      )
    }

    const created = await this.repo.create(draft.value)
    return Ok(created)
  }
}
