/**
 * PayrollStatsPort — aggregated payroll figures for the dashboard.
 *
 * PUBLISHED BY: payroll-processing (Dev C)
 * CONSUMED BY:  analytics (Dev A)
 *
 * Every number here is a real aggregation over stored payslips, never a
 * client-side sum of a fetched list: the dashboard must not download a thousand
 * payslips to add them up, and a hardcoded chart is worse than no chart.
 *
 * Only payslips of VALIDATED or PAID payruns are counted — draft figures are
 * working numbers, and reporting them as salary paid would be misleading.
 */
import type { Period } from '@/modules/shared'

export interface PayrollTotals {
  totalNet: number
  payslipCount: number
  averageSalary: number
}

export interface DepartmentCost {
  departmentId: string | null
  total: number
}

export interface MonthlyTotal {
  /** "YYYY-MM". */
  month: string
  total: number
}

/** The same employee paid twice in one period — an operational alert. */
export interface DuplicatePayslip {
  employeeId: string
  employeeName: string
  count: number
}

export interface PayrollStatsPort {
  totals(period: Period, departmentId?: string): Promise<PayrollTotals>
  costByDepartment(period: Period): Promise<DepartmentCost[]>
  monthlyTrend(months: number): Promise<MonthlyTotal[]>
  duplicatePayslips(period: Period): Promise<DuplicatePayslip[]>
}
