/**
 * Public surface of the "employment" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * Owner: see docs/plans/ — do not add exports for another team's module.
 */

// --- Ports consumed by other modules (Payroll, mainly) ---------------------
export type { ContractQueryPort, ContractSnapshot } from './application/ports/contract-query.port'
export type { ScheduleQueryPort, ScheduleSnapshot } from './application/ports/schedule-query.port'

import { ContractQueryAdapter } from './infrastructure/contract-query.adapter'
import { ScheduleQueryAdapter } from './infrastructure/schedule-query.adapter'
import type { ContractQueryPort } from './application/ports/contract-query.port'
import type { ScheduleQueryPort } from './application/ports/schedule-query.port'

/** Real, Mongo-backed ContractQueryPort. THE method payroll is built on. */
export function createContractQuery(): ContractQueryPort {
  return new ContractQueryAdapter()
}

/** Real, Mongo-backed ScheduleQueryPort. Drives payroll proration. */
export function createScheduleQuery(): ScheduleQueryPort {
  return new ScheduleQueryAdapter()
}

// --- Domain types used at other layers within this app (routes, forms) -----
export type { Contract } from './domain/contract'
export type { WorkingSchedule } from './domain/working-schedule'
export type { ScheduleDayPattern, Weekday } from './domain/weekly-hours.service'

// --- Route-facing schemas (shared by client forms and server validation) ---
export {
  createContractSchema,
  updateContractSchema,
  type CreateContractBody,
  type UpdateContractBody,
} from './interface/contract.schema'
export {
  createScheduleSchema,
  updateScheduleSchema,
  type CreateScheduleBody,
  type UpdateScheduleBody,
} from './interface/schedule.schema'

// --- Controllers: the thin seam app/api route handlers call into -----------
export {
  listContracts,
  getContract,
  createContract,
  updateContract,
  deleteContract,
} from './interface/contract.controller'
export {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from './interface/schedule.controller'
