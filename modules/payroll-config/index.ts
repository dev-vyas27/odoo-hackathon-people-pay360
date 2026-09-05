/**
 * Public surface of the "payroll-config" module.  ·  Owner: Dev C
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * This entry point is CLIENT-SAFE: pure domain vocabulary, the rule engine and
 * the zod schemas, with nothing that touches Postgres or `next/headers`. Forms
 * import from here. Anything that talks to a database or a request lives in
 * `@/modules/payroll-config/server` — importing that from a client component is
 * a build error rather than a 4 MB bundle.
 *
 * Consumers today: payroll-processing (Dev C) for the rule engine and the
 * resolved-structure read model; the app router for the config screens.
 */

// --- Domain vocabulary ------------------------------------------------------
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

// --- The rule engine --------------------------------------------------------
/**
 * Payroll processing runs this to turn a structure plus a wage into payslip
 * lines. A pure function, which is why the payslip factory needs no database to
 * be tested — and why it is safe to reach for anywhere.
 */
export {
  runRuleEngine,
  totalForCategory,
  type ComputedLine,
  type RuleEngineInput,
} from './domain/rule-engine'

// --- Published port ---------------------------------------------------------
export type { SalaryStructureQueryPort } from './application/ports/salary-structure-query.port'

// --- Read-model types the screens render ------------------------------------
export type { SalaryStructureListItem } from './application/list-salary-structures.use-case'
export type { SalaryStructureDetail } from './application/get-salary-structure-detail.use-case'

// --- Validation shared by the forms and the route handlers ------------------
export {
  salaryRuleFormSchema,
  salaryStructureFormSchema,
  toSalaryRuleData,
  toSalaryRuleFormValues,
  toSalaryStructureData,
  type SalaryRuleFormValues,
  type SalaryStructureFormValues,
} from './interface/schema'
