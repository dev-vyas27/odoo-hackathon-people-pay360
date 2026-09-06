/**
 * AttendanceStatsPort — the read model other modules depend on.
 *
 * Payroll's "Worked Days" and the dashboard's attendance summary both go
 * through here. See docs/plans/DEV-B-hr-operations.md, contract hour H0-H1.
 */
import type { Period } from '@/modules/shared'

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  overtimeHours: number
  missingCheckouts: number
  manualEdits: number
}

export interface AttendanceStatsPort {
  workedHours(employeeId: string, period: Period): Promise<number>
  /** Distinct days with a completed (checked-out) record — the payslip's "Worked Days". */
  workedDays(employeeId: string, period: Period): Promise<number>
  /** Same as workedDays, but for many employees in a single query — for payrun batches. */
  workedDaysForMany(employeeIds: string[], period: Period): Promise<Map<string, number>>
  summary(period: Period, departmentId?: string): Promise<AttendanceSummary>
}
