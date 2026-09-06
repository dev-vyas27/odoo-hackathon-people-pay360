


export const PORT_KEYS = {
  
  employeeLookup: 'people.employee-lookup',
  employeeStats: 'people.employee-stats',
  
  contractQuery: 'employment.contract-query',
  scheduleQuery: 'employment.schedule-query',
  contractAlerts: 'employment.contract-alerts',
  
  attendanceStats: 'attendance.attendance-stats',
  
  leaveStats: 'timeoff.leave-stats',
  
  mailer: 'delivery.mailer',
  
  payslipQuery: 'payroll-processing.payslip-query',
  payrollStats: 'payroll-processing.payroll-stats',
} as const

export type PortKey = (typeof PORT_KEYS)[keyof typeof PORT_KEYS]
