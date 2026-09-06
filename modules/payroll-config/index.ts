




export {
  SALARY_CATEGORIES,
  SALARY_CATEGORY_LABELS,
  isSalaryCategory,
  type SalaryCategory,
} from './domain/salary-category'

export {
  COMPUTATION_TYPES,
  COMPUTATION_TYPE_LABELS,
  RESERVED_CODES,
  WAGE_CODE,
  WORKED_DAYS_CODE,
  WORKED_RATIO_CODE,
  isReservedCode,
  type ComputationConfig,
  type ComputationType,
} from './domain/computation/computation.strategy'

export {
  RULE_CODE_PATTERN,
  createSalaryRule,
  dependenciesOf,
  type SalaryRule,
  type SalaryRuleInput,
} from './domain/salary-rule'

export {
  STRUCTURE_CODE_PATTERN,
  createSalaryStructure,
  inspectStructure,
  resolveStructure,
  type ResolvedSalaryStructure,
  type SalaryStructure,
  type SalaryStructureInput,
  type StructureIssue,
  type StructureRuleRef,
} from './domain/salary-structure'



export {
  runRuleEngine,
  totalForCategory,
  type ComputedLine,
  type RuleEngineInput,
} from './domain/rule-engine'


export type { SalaryStructureQueryPort } from './application/ports/salary-structure-query.port'


export type { SalaryStructureListItem } from './application/list-salary-structures.use-case'
export type { SalaryStructureDetail } from './application/get-salary-structure-detail.use-case'


export {
  salaryRuleFormSchema,
  salaryStructureFormSchema,
  toSalaryRuleData,
  toSalaryRuleFormValues,
  toSalaryStructureData,
  type SalaryRuleFormValues,
  type SalaryStructureFormValues,
} from './interface/schema'
