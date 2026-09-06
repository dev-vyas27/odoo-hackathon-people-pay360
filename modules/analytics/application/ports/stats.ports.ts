


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


const NO_CONTRACT_ALERTS: ContractAlertsPort = {
  async attentionItems() {
    return []
  },
}


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
