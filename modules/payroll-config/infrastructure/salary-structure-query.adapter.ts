/**
 * The read model payroll processing computes from.
 *
 * One query for the structure, one batched query for its rules — never one query
 * per rule, because this runs once per payrun and a 200-employee run has no
 * patience for N+1.
 */
import type { SalaryStructureQueryPort } from '../application/ports/salary-structure-query.port'
import type { SalaryRuleRepositoryPort } from '../application/ports/salary-rule-repository.port'
import type { SalaryStructureRepositoryPort } from '../application/ports/salary-structure-repository.port'
import { resolveStructure, type ResolvedSalaryStructure } from '../domain/salary-structure'

export class SalaryStructureQueryAdapter implements SalaryStructureQueryPort {
  constructor(
    private readonly structures: SalaryStructureRepositoryPort,
    private readonly rules: SalaryRuleRepositoryPort,
  ) {}

  async findById(structureId: string): Promise<ResolvedSalaryStructure | null> {
    const structure = await this.structures.findById(structureId)
    if (!structure) return null

    const rules = await this.rules.findManyByIds(structure.rules.map((r) => r.ruleId))
    // resolveStructure throws when a reference dangles — a broken configuration
    // must not quietly produce a payslip that is missing a line.
    return resolveStructure(structure, new Map(rules.map((r) => [r.id, r])))
  }
}
