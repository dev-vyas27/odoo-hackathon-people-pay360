


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


export function createSalaryStructureQuery(): SalaryStructureQueryPort {
  return resolve(
    'payroll-config.salary-structure-query',
    () => new SalaryStructureQueryAdapter(salaryStructureRepository(), salaryRuleRepository()),
  )
}


export function structureEmployeeCount(): StructureEmployeeCountPort {
  return resolve(
    'payroll-config.structure-employee-count',
    () => new PostgresStructureEmployeeCount(),
  )
}
