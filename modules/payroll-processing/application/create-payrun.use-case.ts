


import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Period,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { SalaryStructureQueryPort } from '@/modules/payroll-config'
import type { EmployeeLookupPort } from '@/modules/shared'
import { createPayrun, type Payrun } from '../domain/payrun'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'
import { attempt } from './attempt'

export interface CreatePayrunInput {
  actor: Actor
  name: string
  structureId: string
  period: Period
  employeeIds: string[]
}

export class CreatePayrunUseCase implements UseCase<CreatePayrunInput, Payrun> {
  constructor(
    private readonly payruns: PayrunRepositoryPort,
    private readonly structures: SalaryStructureQueryPort,
    private readonly employees: EmployeeLookupPort,
  ) {}

  async execute(input: CreatePayrunInput): Promise<Result<Payrun>> {
    const allowed = authorize(input.actor, 'payrun', 'create')
    if (!allowed.ok) return allowed

    const structure = await this.structures.findById(input.structureId)
    if (!structure) {
      return Err(
        DomainError.notFound('STRUCTURE_NOT_FOUND', 'That salary structure no longer exists.'),
      )
    }
    if (!structure.active) {
      return Err(
        DomainError.rule(
          'STRUCTURE_ARCHIVED',
          `"${structure.name}" is archived and cannot be used for a new payrun.`,
        ),
      )
    }
    if (!structure.rules.length) {
      return Err(
        DomainError.rule(
          'STRUCTURE_HAS_NO_RULES',
          `"${structure.name}" has no salary rules, so it would produce empty payslips.`,
        ),
      )
    }

    
    
    const found = await this.employees.findManyByIds(input.employeeIds)
    const foundIds = new Set(found.map((e) => e.id))
    const unknown = input.employeeIds.filter((id) => !foundIds.has(id))
    if (unknown.length) {
      return Err(
        DomainError.validation(
          'PAYRUN_UNKNOWN_EMPLOYEES',
          'Some selected employees no longer exist.',
          { employeeIds: unknown },
        ),
      )
    }

    const candidate = attempt(() =>
      createPayrun({
        id: 'pending',
        name: input.name,
        structureId: structure.id,
        structureName: structure.name,
        period: input.period,
        employeeIds: input.employeeIds,
      }),
    )
    if (!candidate.ok) return candidate

    return Ok(await this.payruns.create(candidate.value))
  }
}
