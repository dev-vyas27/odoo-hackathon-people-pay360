


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
  
  month: string
  total: number
}


export interface DuplicatePayslip {
  employeeId: string
  employeeName: string
  count: number
}

export interface PayrollStatsPort {
  totals(period: Period, departmentId?: string): Promise<PayrollTotals>
  costByDepartment(period: Period, departmentId?: string): Promise<DepartmentCost[]>
  monthlyTrend(months: number): Promise<MonthlyTotal[]>
  duplicatePayslips(period: Period, departmentId?: string): Promise<DuplicatePayslip[]>
}
