/**
 * AttendanceStatsPort — aggregated attendance, for modules that must not read
 * attendance records directly.
 *
 * PUBLISHED BY: attendance (Dev B)
 * CONSUMED BY:  payroll-processing (Dev C, "Worked Days" on the payslip),
 *               analytics (Dev A, the Attendance Overview cards)
 *
 * Note that everything here is an aggregate, never a list of raw records.
 * Payroll has no business iterating check-ins, and the dashboard does not want
 * 60 days of rows to count them client-side.
 */
import type { Period } from '@/modules/shared'

export interface AttendanceSummary {
  present: number
  late: number
  absent: number
  overtimeHours: number
  missingCheckouts: number
  /** Records corrected by an authorised user — surfaced as a data-quality signal. */
  manualEdits: number
}

export interface AttendanceStatsPort {
  /** Total hours actually worked in the period, breaks excluded. */
  workedHours(employeeId: string, period: Period): Promise<number>

  /** Distinct days with a completed attendance record — the payslip's "Worked Days". */
  workedDays(employeeId: string, period: Period): Promise<number>

  /** Batch form, so a 200-employee payrun does not issue 200 queries. */
  workedDaysForMany(employeeIds: string[], period: Period): Promise<Map<string, number>>

  summary(period: Period, departmentId?: string): Promise<AttendanceSummary>
}
