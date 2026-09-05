/**
 * Public surface of the "employment" module.  ·  Owner: Dev B
 *
 * Holds Contracts and Working Schedules. Internals are private; the ESLint
 * boundary rule enforces it.
 *
 * Consumers today: payroll-processing (Dev C), attendance (Dev B), analytics (Dev A).
 */

// --- Published ports --------------------------------------------------------
export type {
  ContractQueryPort,
  ContractSnapshot,
} from './application/ports/contract-query.port'

export type {
  ScheduleQueryPort,
  ScheduleSnapshot,
  ScheduleDay,
  Weekday,
} from './application/ports/schedule-query.port'

// --- Implementation selection ----------------------------------------------
import { StubContractQuery, StubScheduleQuery } from './infrastructure/contract-query.stub'
import type { ContractQueryPort } from './application/ports/contract-query.port'
import type { ScheduleQueryPort } from './application/ports/schedule-query.port'

export function createContractQuery(): ContractQueryPort {
  return new StubContractQuery()
}

export function createScheduleQuery(): ScheduleQueryPort {
  return new StubScheduleQuery()
}
