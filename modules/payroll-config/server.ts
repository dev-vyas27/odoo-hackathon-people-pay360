/**
 * Server-side surface of "payroll-config".  ·  Owner: Dev C
 *
 * Use cases, HTTP controllers and the composition root — everything that
 * touches Postgres or the incoming request. Imported by route handlers and
 * server components ONLY; a client component that reaches for this fails the
 * build, which is exactly the guardrail we want.
 *
 * The client-safe half (domain vocabulary, rule engine, zod schemas) lives in
 * `@/modules/payroll-config`.
 */

// --- Use cases (constructed by the route handlers) --------------------------
export { CreateSalaryRuleUseCase } from './application/create-salary-rule.use-case'
export { UpdateSalaryRuleUseCase } from './application/update-salary-rule.use-case'
export { ListSalaryRulesUseCase } from './application/list-salary-rules.use-case'
export { GetSalaryRuleUseCase } from './application/get-salary-rule.use-case'
export { ArchiveSalaryRuleUseCase } from './application/archive-salary-rule.use-case'
export { CreateSalaryStructureUseCase } from './application/create-salary-structure.use-case'
export { UpdateSalaryStructureUseCase } from './application/update-salary-structure.use-case'
export { ListSalaryStructuresUseCase } from './application/list-salary-structures.use-case'
export { GetSalaryStructureDetailUseCase } from './application/get-salary-structure-detail.use-case'
export { ArchiveSalaryStructureUseCase } from './application/archive-salary-structure.use-case'

// --- HTTP (thin wrappers the app/api route files delegate to) ---------------
export {
  listSalaryRules,
  createSalaryRule as createSalaryRuleRoute,
  getSalaryRule,
  updateSalaryRule,
  archiveSalaryRule,
} from './interface/salary-rule.controller'
export {
  listSalaryStructures,
  createSalaryStructure as createSalaryStructureRoute,
  getSalaryStructure,
  updateSalaryStructure,
  archiveSalaryStructure,
} from './interface/salary-structure.controller'

// --- Implementation selection ----------------------------------------------
export {
  salaryRuleRepository,
  salaryStructureRepository,
  createSalaryStructureQuery,
  structureEmployeeCount,
} from './composition'
