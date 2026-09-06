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

    if (input.patch.managerId) {
      const cycle = await this.wouldCycle(input.id, input.patch.managerId)
      if (cycle) return cycle
    }

    const updated = existing.update(input.patch)
    if (!updated.ok) return updated

    const saved = await this.repo.update(input.id, updated.value)
    if (!saved) {
      return Err(DomainError.notFound('EMPLOYEE_NOT_FOUND', `No employee with id ${input.id}`))
    }
    return Ok(saved)
  }

  /**
   * Refuse a manager that would close a loop in the reporting line.
   *
   * The employee form already hides anyone who reports to this person, but that
   * is a convenience — the API is reachable without it, and a cycle in the
   * reporting line is not a cosmetic problem: every walk up the chain (an
   * approval route, an org chart, a "who signs this off" lookup) runs forever.
   * The database's `employees_not_own_manager` CHECK catches the one-node case
   * and nothing longer, because a longer cycle cannot be expressed as a row
   * constraint.
   *
   * Walks UP from the proposed manager. Reaching `id` means the proposed
   * manager already reports to the employee being edited, at some depth.
   * `visited` bounds the walk against data that is already circular.
   */
  private async wouldCycle(id: string, managerId: string): Promise<Result<Employee> | null> {
    if (managerId === id) {
      return Err(
        DomainError.rule('EMPLOYEE_SELF_MANAGED', 'An employee cannot be their own manager.'),
      )
    }

    const visited = new Set<string>([id])
    let current: string | null = managerId

    while (current && !visited.has(current)) {
      visited.add(current)
      const next: Employee | null = await this.repo.findById(current)
      current = next?.managerId ?? null

      if (current === id) {
        return Err(
          DomainError.rule(
            'EMPLOYEE_MANAGER_CYCLE',
            'That person reports to this employee, so they cannot also manage them.',
            { employeeId: id, managerId },
          ),
        )
      }
    }

    return null
  }
}
