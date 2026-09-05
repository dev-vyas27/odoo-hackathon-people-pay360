/**
 * Server-side surface of "payroll-processing".  ·  Owner: Dev C
 *
 * Use cases, HTTP controllers, the composition root and the two adapters Dev A
 * consumes. Everything here touches Postgres, the event bus or the incoming
 * request, so it is server-only by construction.
 *
 * Dev A: `createPayslipQuery()` and `createPayrollStats()` are the factories to
 * call from Delivery and Analytics. Code against the port TYPES exported from
 * `@/modules/payroll-processing`, and take the implementation from here.
 */

// --- Use cases --------------------------------------------------------------
export { CreatePayrunUseCase } from './application/create-payrun.use-case'
export { ComputePayrunUseCase } from './application/compute-payrun.use-case'
export { ValidatePayrunUseCase } from './application/validate-payrun.use-case'
export { MarkPayrunPaidUseCase } from './application/mark-payrun-paid.use-case'
export { ListPayrunsUseCase } from './application/list-payruns.use-case'
export { GetPayrunDetailUseCase } from './application/get-payrun-detail.use-case'
export { GetPayslipDetailUseCase } from './application/get-payslip-detail.use-case'
export { ListEligibleEmployeesUseCase } from './application/list-eligible-employees.use-case'

// --- Projection used by the screens and by Delivery -------------------------
export { toView as toPayslipView } from './infrastructure/payslip-query.adapter'

// --- HTTP (thin wrappers the app/api route files delegate to) ---------------
export {
  listPayruns,
  createPayrun as createPayrunRoute,
  getPayrun,
  computePayrun,
  validatePayrun,
  markPayrunPaid,
  listEligibleEmployees,
} from './interface/payrun.controller'
export { getPayslip } from './interface/payslip.controller'

// --- Implementation selection ----------------------------------------------
export {
  payrunRepository,
  payslipRepository,
  employeeLookup,
  contractQuery,
  scheduleQuery,
  attendanceStats,
  structureQuery,
  createPayslipQuery,
  createPayrollStats,
} from './composition'
