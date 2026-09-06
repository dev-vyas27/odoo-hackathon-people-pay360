/**
 * This module's composition root.
 *
 * The only file that names concrete adapters. Use cases receive ports through
 * their constructors, so a test can hand them a Map-backed fake and nothing else
 * in the module has an opinion about Postgres.
 *
 * Repositories are cached on the shared container: Next's dev server
 * re-evaluates modules on every edit, and rebuilding them each time would leak
 * an object graph per reload. The Postgres pool itself is cached separately in
 * lib/db.ts for the same reason.
 */
import { resolve } from '@/modules/shared/container'
import type { SalaryRuleRepositoryPort } from './application/ports/salary-rule-repository.port'
import type { SalaryStructureRepositoryPort } from './application/ports/salary-structure-repository.port'
import type { SalaryStructureQueryPort } from './application/ports/salary-structure-query.port'
import type { StructureEmployeeCountPort } from './application/ports/structure-employee-count.port'
import { PostgresSalaryRuleRepository } from './infrastructure/postgres-salary-rule.repository'
import { PostgresSalaryStructureRepository } from './infrastructure/postgres-salary-structure.repository'
import { SalaryStructureQueryAdapter } from './infrastructure/salary-structure-query.adapter'
import { PostgresStructureEmployeeCount } from './infrastructure/structure-employee-count.adapter'

export function salaryRuleRepository(): SalaryRuleRepositoryPort {
  return resolve('payroll-config.salary-rule-repository', () => new PostgresSalaryRuleRepository())
}

export function salaryStructureRepository(): SalaryStructureRepositoryPort {
  return resolve(
    'payroll-config.salary-structure-repository',
    () => new PostgresSalaryStructureRepository(),
  )
}

/** Published to payroll-processing: structures with their rules resolved. */
export function createSalaryStructureQuery(): SalaryStructureQueryPort {
  return resolve(
    'payroll-config.salary-structure-query',
    () => new SalaryStructureQueryAdapter(salaryStructureRepository(), salaryRuleRepository()),
  )
}

/** How many employees each structure currently has attached, for the Structures screens. */
export function structureEmployeeCount(): StructureEmployeeCountPort {
  return resolve(
    'payroll-config.structure-employee-count',
    () => new PostgresStructureEmployeeCount(),
  )
}
