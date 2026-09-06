import { authorizeOwned, DomainError, Err, Ok, type Actor, type Result, type UseCase } from '@/modules/shared'
import type { Employee } from '../domain/employee'
import type { EmployeeRepositoryPort } from './ports/employee-repository.port'

export interface EmployeeSmartButtonCounts {
  contracts: number
  attendance: number
  timeOff: number
  allocations: number
}

export interface EmployeeDetail {
  employee: Employee
  counts: EmployeeSmartButtonCounts
}

export interface GetEmployeeDetailInput {
  actor: Actor
  id: string
}

export class GetEmployeeDetailUseCase implements UseCase<GetEmployeeDetailInput, EmployeeDetail> {
  constructor(private readonly repo: EmployeeRepositoryPort) {}

  async execute(input: GetEmployeeDetailInput): Promise<Result<EmployeeDetail>> {
    const employee = await this.repo.findById(input.id)
    if (!employee) {
      return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', `No employee with id ${input.id}`))
    }

    const gate = authorizeOwned(input.actor, 'employee', 'read', employee.id)
    if (!gate.ok) return gate

    return Ok({
      employee,
      counts: { contracts: 0, attendance: 0, timeOff: 0, allocations: 0 },
    })
  }
}
