/**
 * Public surface of the "employment" module.  ·  Owner: Dev B
 *
 * Contracts and Working Schedules. Internals are private; the ESLint boundary
 * rule enforces it.
 *
 * The cross-module port TYPES (ContractSnapshot, ContractQueryPort,
 * ScheduleSnapshot, ScheduleQueryPort) now live in modules/shared/contracts/dto.ts.
 * Consumers import them from '@/modules/shared' and obtain the implementation
 * through the container.
 */
import {
  providePort,
  PORT_KEYS,
  type ContractQueryPort,
  type ScheduleQueryPort,
} from '@/modules/shared'
import { PostgresContractQuery } from './infrastructure/contract-query.adapter'
import { PostgresScheduleQuery } from './infrastructure/schedule-query.adapter'

// --- Domain, for callers that legitimately need the rules ------------------
export { resolveApplicableContract, contractsOverlap } from './domain/contract-resolution'
export {
  computeWeeklyHours,
  expectedDays,
  expectedHours,
  type ScheduleDayPattern,
  type Weekday,
} from './domain/weekly-hours.service'
export type { Contract } from './domain/contract'
export type { WorkingSchedule } from './domain/working-schedule'

// --- Interface layer, for the route handlers in app/api -------------------
export * from './interface/contract.controller'
export * from './interface/schedule.controller'
export * from './interface/contract.schema'
export * from './interface/schedule.schema'

// --- Persistence, for scripts/seed and the composition root ---------------
export { PostgresContractRepository } from './infrastructure/postgres-contract.repository'
export { PostgresScheduleRepository } from './infrastructure/postgres-schedule.repository'
export { PostgresContractQuery } from './infrastructure/contract-query.adapter'
export { PostgresScheduleQuery } from './infrastructure/schedule-query.adapter'

/** Publish this module's cross-module ports. */
export function registerEmployment(): void {
  providePort<ContractQueryPort>(PORT_KEYS.contractQuery, () => new PostgresContractQuery())
  providePort<ScheduleQueryPort>(PORT_KEYS.scheduleQuery, () => new PostgresScheduleQuery())
}

export function createContractQuery(): ContractQueryPort {
  return new PostgresContractQuery()
}

export function createScheduleQuery(): ScheduleQueryPort {
  return new PostgresScheduleQuery()
}
