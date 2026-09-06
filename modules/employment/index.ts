


import {
  providePort,
  PORT_KEYS,
  type ContractQueryPort,
  type ScheduleQueryPort,
  type ContractAlertsPort,
} from '@/modules/shared'
import { PostgresContractQuery } from './infrastructure/contract-query.adapter'
import { PostgresScheduleQuery } from './infrastructure/schedule-query.adapter'
import { PostgresContractAlerts } from './infrastructure/contract-alerts.adapter'


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


export * from './interface/contract.controller'
export * from './interface/schedule.controller'
export * from './interface/contract.schema'
export * from './interface/schedule.schema'


export { PostgresContractRepository } from './infrastructure/postgres-contract.repository'
export { PostgresScheduleRepository } from './infrastructure/postgres-schedule.repository'
export { PostgresContractQuery } from './infrastructure/contract-query.adapter'
export { PostgresScheduleQuery } from './infrastructure/schedule-query.adapter'


export function registerEmployment(): void {
  providePort<ContractQueryPort>(PORT_KEYS.contractQuery, () => new PostgresContractQuery())
  providePort<ScheduleQueryPort>(PORT_KEYS.scheduleQuery, () => new PostgresScheduleQuery())
  providePort<ContractAlertsPort>(PORT_KEYS.contractAlerts, () => new PostgresContractAlerts())
}

export function createContractQuery(): ContractQueryPort {
  return new PostgresContractQuery()
}

export function createScheduleQuery(): ScheduleQueryPort {
  return new PostgresScheduleQuery()
}
