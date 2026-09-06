


import type { Period } from '../domain/period'
import type { Role } from './permissions'





export interface CurrentUser {
  employeeId: string
  role: Role
  email: string
  name: string
}


export interface ListEnvelope<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}


export interface SeriesPoint {
  label: string
  value: number
}



export const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number]

export interface EmployeeSummary {
  id: string
  name: string
  email: string
  departmentId: string | null
  departmentName: string | null
  jobPositionName: string | null
  employeeType: EmployeeType
  managerId: string | null
  workingScheduleId: string | null
  
  bankAccount: string | null
  isActive: boolean
}

export interface EmployeeLookupPort {
  findById(employeeId: string): Promise<EmployeeSummary | null>
  findManyByIds(ids: string[]): Promise<EmployeeSummary[]>
  findEligible(filter: {
    departmentId?: string
    employeeType?: string
    activeOn: Date
  }): Promise<EmployeeSummary[]>
}



export interface StatsFilter {
  departmentId?: string
  employeeType?: string
}

export interface EmployeeStatsPort {
  headcount(filter?: StatsFilter): Promise<number>
  headcountByDepartment(
    filter?: StatsFilter,
  ): Promise<Array<{ departmentId: string; departmentName: string; count: number }>>
  headcountByEmployeeType(): Promise<Array<{ employeeType: EmployeeType; count: number }>>
  
  missingBankDetails(): Promise<Array<{ employeeId: string; name: string }>>
}

export interface ContractSnapshot {
  id: string
  employeeId: string
  
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  
  end: Date | null
}

export interface ContractQueryPort {
  
  findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null>
  findByEmployee(employeeId: string): Promise<ContractSnapshot[]>
}

export interface ScheduleSnapshot {
  id: string
  name: string
  weeklyHours: number
  days: Array<{ day: 0 | 1 | 2 | 3 | 4 | 5 | 6; start: string; end: string; breakMinutes: number }>
}

export interface ScheduleQueryPort {
  findById(id: string): Promise<ScheduleSnapshot | null>
  expectedHours(scheduleId: string, period: Period): Promise<number>
  


  expectedDays(scheduleId: string, period: Period): Promise<number>
}



export interface ContractAlert {
  contractId: string
  employeeId: string
  employeeName: string
  
  issue: string
  kind: 'expiring' | 'expired' | 'missing' | 'draft'
  endsOn: Date | null
}

export interface ContractAlertsPort {
  
  attentionItems(period: Period, withinDays: number): Promise<ContractAlert[]>
}

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
  workedDays(employeeId: string, period: Period): Promise<number>
  


  summary(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<AttendanceSummary>
}



export interface EmailAttachment {
  filename: string
  content: Uint8Array
  contentType: string
}

export interface EmailMessage {
  to: string
  subject: string
  
  text: string
  html?: string
  


  attachments?: EmailAttachment[]
}

export interface EmailResult {
  to: string
  sent: boolean
  
  error?: string
}

export interface MailerPort {
  send(message: EmailMessage): Promise<EmailResult>
}



export const LEAVE_UNITS = ['day', 'hour'] as const
export type LeaveUnit = (typeof LEAVE_UNITS)[number]

export const LEAVE_STATUSES = ['draft', 'to_approve', 'approved', 'refused'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

export interface LeaveBalanceView {
  timeOffTypeId: string
  timeOffTypeName: string
  unit: LeaveUnit
  allocated: number
  taken: number
  pending: number
  remaining: number
}

export interface LeaveStatsPort {
  
  approvedInPeriod(period: Period, filter?: StatsFilter): Promise<number>
  
  pendingCount(filter?: StatsFilter): Promise<number>
  


  balanceTotals(filter: StatsFilter, on: Date): Promise<LeaveBalanceView[]>
}



export const SALARY_CATEGORIES = ['basic', 'allowance', 'gross', 'deduction', 'net'] as const
export type SalaryCategory = (typeof SALARY_CATEGORIES)[number]

export const PAYSLIP_STATUSES = ['draft', 'computed', 'validated', 'paid', 'cancelled'] as const
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number]

export const PAYRUN_STATUSES = ['draft', 'computed', 'validated', 'paid', 'cancelled'] as const
export type PayrunStatus = (typeof PAYRUN_STATUSES)[number]

export interface PayslipLineView {
  code: string
  name: string
  category: SalaryCategory
  sequence: number
  amount: number
}

export interface PayslipView {
  id: string
  employeeId: string
  employeeName: string
  
  employeeEmail?: string | null
  payrunId: string
  payrunName: string
  periodStart: Date
  periodEnd: Date
  structureName: string
  workedDays: number
  lines: PayslipLineView[]
  basic: number
  gross: number
  deductions: number
  net: number
  status: PayslipStatus
}

export interface PayslipQueryPort {
  findById(payslipId: string): Promise<PayslipView | null>
  findByPayrun(payrunId: string): Promise<PayslipView[]>
}

export interface PayrollTotals {
  totalNet: number
  payslipCount: number
  averageSalary: number
}

export interface PayrollStatsPort {
  
  totals(period: Period, departmentId?: string, employeeType?: string): Promise<PayrollTotals>
  costByDepartment(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<Array<{ departmentId: string; total: number }>>
  monthlyTrend(
    months: number,
    departmentId?: string,
    employeeType?: string,
  ): Promise<Array<{ month: string; total: number }>>
  
  duplicatePayslips(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<Array<{ employeeId: string; employeeName: string; count: number }>>
}
