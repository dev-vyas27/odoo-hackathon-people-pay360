/**
 * Port registry keys — how three people wire ten modules without importing
 * each other's code.
 *
 * The problem: `analytics` needs employee counts from `people`, and `delivery`
 * needs payslips from `payroll-processing`. A direct import means Dev A cannot
 * typecheck until Dev B has written the module, and it means every integration
 * is a merge conflict in a file all three of us edit.
 *
 * The fix: the consumer asks the container for a port BY KEY and gets either the
 * real implementation or a null object (see `usePort` in container.ts). The
 * provider registers itself from its own module. Neither side imports the other,
 * so the dashboard renders zeros before integration and real numbers after,
 * without a single line changing in the consumer.
 *
 * This file is append-only: add your key, never renumber or reorder.
 */
export const PORT_KEYS = {
  /** Dev B — modules/people */
  employeeLookup: 'people.employee-lookup',
  employeeStats: 'people.employee-stats',
  /** Dev B — modules/employment */
  contractQuery: 'employment.contract-query',
  scheduleQuery: 'employment.schedule-query',
  contractAlerts: 'employment.contract-alerts',
  /** Dev B — modules/attendance */
  attendanceStats: 'attendance.attendance-stats',
  /** Dev A — modules/timeoff */
  leaveStats: 'timeoff.leave-stats',
  /** Dev C — modules/payroll-processing */
  payslipQuery: 'payroll-processing.payslip-query',
  payrollStats: 'payroll-processing.payroll-stats',
} as const

export type PortKey = (typeof PORT_KEYS)[keyof typeof PORT_KEYS]
