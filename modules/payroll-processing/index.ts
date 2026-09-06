/**
 * Public surface of the "payroll-processing" module.  ·  Owner: Dev C
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * This entry point is CLIENT-SAFE: aggregates, published port TYPES and zod
 * schemas only. The adapters that implement those ports, along with the use
 * cases and controllers, live in `@/modules/payroll-processing/server`.
 *
 * Consumers today: delivery (Dev A) via PayslipQueryPort, analytics (Dev A) via
 * PayrollStatsPort, and the app router for the payroll screens.
 */

// --- Published ports (Dev A codes against these) ----------------------------
export type {
  PayslipQueryPort,
  PayslipView,
  PayslipLineView,
} from './application/ports/payslip-query.port'

export type {
  PayrollStatsPort,
  PayrollTotals,
  DepartmentCost,
  MonthlyTotal,
} from './application/ports/payroll-stats.port'

// --- Domain vocabulary ------------------------------------------------------
export {
  PAYRUN_STATUSES,
  PAYRUN_STATUS_LABELS,
  canTransition,
  isFinalised,
  type PayrunStatus,
} from './domain/payrun-state'

export {
  linesInSequence,
  totalsOf,
  type Payslip,
  type PayslipStatus,
  type PayslipTotals,
} from './domain/payslip'

export type { Payrun } from './domain/payrun'

export type {
  PayrollWarning,
  WarningSeverity,
  IPayrollWarningCheck,
} from './domain/warnings/warning.port'

// --- Read-model types the screens render ------------------------------------
export type { PayrunDetail } from './application/get-payrun-detail.use-case'
export type { EligibleEmployee } from './application/list-eligible-employees.use-case'

// --- Validation shared by the wizard and the route handlers -----------------
export {
  createPayrunSchema,
  payrunScopeSchema,
  eligibleEmployeesQuerySchema,
  type CreatePayrunValues,
  type PayrunScopeValues,
} from './interface/schema'

export { toPayrunView, type PayrunView } from './interface/views'
