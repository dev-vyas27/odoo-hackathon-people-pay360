/**
 * Everything the dashboard consumes, and what it does when nobody has provided
 * it yet.
 *
 * Spec B9: the dashboard "aggregates live data across Employees, Contracts,
 * Payroll, Attendance, and Time Off modules". Analytics owns none of those. It
 * imports none of them either — every figure arrives through a port resolved by
 * key at call time, so this module compiles and renders whether or not Dev B and
 * Dev C have shipped.
 *
 * The fallbacks return EMPTY, never fake. Spec A7 requires "live metrics derived
 * from actual system records", and a plausible-looking invented number is worse
 * than a zero: a zero is obviously missing data, a fake is a lie that survives
 * to the demo. The screen renders "No data yet" from these, which is honest.
 */
import {
  PORT_KEYS,
  portOr,
  type AttendanceStatsPort,
  type ContractAlertsPort,
  type EmployeeStatsPort,
  type LeaveStatsPort,
  type PayrollStatsPort,
} from '@/modules/shared'

export type {
  AttendanceStatsPort,
  ContractAlertsPort,
  EmployeeStatsPort,
  LeaveStatsPort,
  PayrollStatsPort,
}

/** Dev B — modules/people */
const NO_EMPLOYEE_STATS: EmployeeStatsPort = {
  async headcount() {
    return 0
  },
  async headcountByDepartment() {
    return []
  },
  async headcountByEmployeeType() {
    return []
  },
  async missingBankDetails() {
    return []
  },
}

/** Dev B — modules/attendance */
const NO_ATTENDANCE_STATS: AttendanceStatsPort = {
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

/** Dev B — modules/employment */
const NO_CONTRACT_ALERTS: ContractAlertsPort = {
  async attentionItems() {
    return []
  },
}

/** Dev A — modules/timeoff. Registered from day one; the fallback is insurance. */
const NO_LEAVE_STATS: LeaveStatsPort = {
  async approvedInPeriod() {
    return 0
  },
  async pendingCount() {
    return 0
  },
  async balanceTotals() {
    return []
  },
}

/** Dev C — modules/payroll-processing */
const NO_PAYROLL_STATS: PayrollStatsPort = {
  async totals() {
    return { totalNet: 0, payslipCount: 0, averageSalary: 0 }
  },
  async costByDepartment() {
    return []
  },
  async monthlyTrend() {
    return []
  },
  async duplicatePayslips() {
    return []
  },
}

/**
 * Resolved per call rather than cached, so a port registered after this module
 * was first imported starts being used immediately.
 */
export function dashboardPorts() {
  return {
    employees: portOr<EmployeeStatsPort>(PORT_KEYS.employeeStats, NO_EMPLOYEE_STATS),
    attendance: portOr<AttendanceStatsPort>(PORT_KEYS.attendanceStats, NO_ATTENDANCE_STATS),
    contracts: portOr<ContractAlertsPort>(PORT_KEYS.contractAlerts, NO_CONTRACT_ALERTS),
    leave: portOr<LeaveStatsPort>(PORT_KEYS.leaveStats, NO_LEAVE_STATS),
    payroll: portOr<PayrollStatsPort>(PORT_KEYS.payrollStats, NO_PAYROLL_STATS),
  }
}

export type DashboardPorts = ReturnType<typeof dashboardPorts>
