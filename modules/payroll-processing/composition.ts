


import {
  container,
  portOr,
  providePort,
  resolve,
  PORT_KEYS,
  type AttendanceStatsPort,
  type ContractQueryPort,
  type EmployeeLookupPort,
  type IEventBus,
  type ScheduleQueryPort,
} from '@/modules/shared'
import type { SalaryStructureQueryPort } from '@/modules/payroll-config'
import { createSalaryStructureQuery } from '@/modules/payroll-config/server'
import type { PayrunRepositoryPort } from './application/ports/payrun-repository.port'
import type { PayslipRepositoryPort } from './application/ports/payslip-repository.port'
import type { PayslipQueryPort } from './application/ports/payslip-query.port'
import type { PayrollStatsPort } from './application/ports/payroll-stats.port'
import { PostgresPayrunRepository } from './infrastructure/postgres-payrun.repository'
import { PostgresPayslipRepository } from './infrastructure/postgres-payslip.repository'
import { PayslipQueryAdapter } from './infrastructure/payslip-query.adapter'
import { PayrollStatsAdapter } from './infrastructure/payroll-stats.adapter'

export function payrunRepository(): PayrunRepositoryPort {
  return resolve('payroll-processing.payrun-repository', () => new PostgresPayrunRepository())
}

export function payslipRepository(): PayslipRepositoryPort {
  return resolve('payroll-processing.payslip-repository', () => new PostgresPayslipRepository())
}

export function structureQuery(): SalaryStructureQueryPort {
  return createSalaryStructureQuery()
}



const NO_EMPLOYEES: EmployeeLookupPort = {
  async findById() {
    return null
  },
  async findManyByIds() {
    return []
  },
  async findEligible() {
    return []
  },
}

const NO_CONTRACTS: ContractQueryPort = {
  
  async findApplicableContract() {
    return null
  },
  async findByEmployee() {
    return []
  },
}

const NO_SCHEDULES: ScheduleQueryPort = {
  async findById() {
    return null
  },
  
  async expectedHours() {
    return 0
  },
  async expectedDays() {
    return 0
  },
}

const NO_ATTENDANCE: AttendanceStatsPort = {
  async workedHours() {
    return 0
  },
  async workedDays() {
    return 0
  },
  async summary() {
    return {
      present: 0,
      late: 0,
      absent: 0,
      overtimeHours: 0,
      missingCheckouts: 0,
      manualEdits: 0,
    }
  },
}

export function employeeLookup(): EmployeeLookupPort {
  return portOr(PORT_KEYS.employeeLookup, NO_EMPLOYEES)
}

export function contractQuery(): ContractQueryPort {
  return portOr(PORT_KEYS.contractQuery, NO_CONTRACTS)
}

export function scheduleQuery(): ScheduleQueryPort {
  return portOr(PORT_KEYS.scheduleQuery, NO_SCHEDULES)
}

export function attendanceStats(): AttendanceStatsPort {
  return portOr(PORT_KEYS.attendanceStats, NO_ATTENDANCE)
}

export function eventBus(): IEventBus {
  return container().eventBus
}



export function createPayslipQuery(): PayslipQueryPort {
  return resolve(
    'payroll-processing.payslip-query',
    () => new PayslipQueryAdapter(payslipRepository()),
  )
}

export function createPayrollStats(): PayrollStatsPort {
  return resolve('payroll-processing.payroll-stats', () => new PayrollStatsAdapter())
}



export function registerPayrollPorts(): void {
  providePort(PORT_KEYS.payslipQuery, createPayslipQuery)
  providePort(PORT_KEYS.payrollStats, createPayrollStats)
}
