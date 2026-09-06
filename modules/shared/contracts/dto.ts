/**
 * Cross-module DTOs — the output of the H0 contract hour.
 *
 * A DTO belongs here when it CROSSES a module boundary. Anything used by only
 * one module stays inside that module. Keeping the crossing shapes in one file
 * means a change to them is visible to everyone in one diff, and it means each
 * module's port file can `import type` the shape rather than re-declaring it.
 *
 * The file is deliberately split into owner-labelled sections. Each developer
 * edits only their own section, so three people can extend it in parallel and
 * git merges the regions independently instead of fighting over one blob.
 *
 * Rule: types only. No classes, no runtime logic, no imports from outside
 * `@/modules/shared` — otherwise this becomes a dependency magnet.
 */
import type { Period } from '../domain/period'
import type { Role } from './permissions'

// ---------------------------------------------------------------------------
// Common — owner: Dev A
// ---------------------------------------------------------------------------

/**
 * The authenticated person as every layer above the domain sees it.
 *
 * One id, not two. `users` and `employees` were separate tables until 0010, so
 * this carried both a `userId` and a nullable `employeeId` and every consumer
 * had to know which one to use — and handle the null. The employee row is now
 * the identity, so `employeeId` is the only id there is and it is always
 * present.
 */
export interface CurrentUser {
  employeeId: string
  role: Role
  email: string
  name: string
}

/** Envelope every list endpoint returns. Mirrors `Paged<T>` from the kernel. */
export interface ListEnvelope<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

/** A single named quantity for charts and KPI tiles. */
export interface SeriesPoint {
  label: string
  value: number
}

// ---------------------------------------------------------------------------
// People / Employment / Attendance — owner: Dev B
//
// Consumed by Time Off (Dev A), the dashboard (Dev A) and payroll computation
// (Dev C). Dev B's port files should import these shapes from here rather than
// re-declaring them, so a field rename is one edit instead of four.
// ---------------------------------------------------------------------------

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
  /** Dev C needs this for the missing-bank-details pre-finalisation warning. */
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

/**
 * The narrowing spec A7 asks for: "Flexible filtering by Period and Department
 * ... Employee Type filters enable focused analysis."
 *
 * Every dashboard aggregate takes this, so a filter set on screen reaches all
 * of them rather than only the ones that happened to have a parameter for it.
 */
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
  /** Employees with no bank account on file — an operational alert on the dashboard. */
  missingBankDetails(): Promise<Array<{ employeeId: string; name: string }>>
}

export interface ContractSnapshot {
  id: string
  employeeId: string
  /** Major units. Convert with `Money.of()` at the domain boundary. */
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  /** null = open ended. */
  end: Date | null
}

export interface ContractQueryPort {
  /** The contract that applies to a PAYROLL PERIOD, not "the current one". */
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
  /**
   * Calendar days in `period` this schedule actually works.
   *
   * Payroll's proration denominator, and Time Off's leave duration: a leave
   * request must not bill the days the employee was never rostered for.
   */
  expectedDays(scheduleId: string, period: Period): Promise<number>
}

/**
 * A contract needing a human's attention — spec B9's "contract attention items".
 * Owned by Dev B (`employment`), consumed by the dashboard.
 */
export interface ContractAlert {
  contractId: string
  employeeId: string
  employeeName: string
  /** Why it needs attention, already worded for display. */
  issue: string
  kind: 'expiring' | 'expired' | 'missing' | 'draft'
  endsOn: Date | null
}

export interface ContractAlertsPort {
  /** Contracts expiring within `withinDays`, plus employees with none at all. */
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
  /**
   * `employeeType` is a THIRD positional parameter rather than part of a filter
   * object, deliberately: an existing two-parameter implementation still
   * satisfies this interface, so adding it broke nobody. Implementations that
   * ignore it simply do not honour the employee-type filter yet.
   */
  summary(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<AttendanceSummary>
}

/**
 * Outbound email — owner: Dev A (`delivery`).
 *
 * Consumed by identity for invitations, and later by payslip distribution.
 * Behind a port so `nodemailer` is imported in exactly one file and so a test
 * can assert on what would have been sent without an SMTP server.
 */
export interface EmailAttachment {
  filename: string
  content: Uint8Array
  contentType: string
}

export interface EmailMessage {
  to: string
  subject: string
  /** Plain text is required; HTML is the enhancement, not the other way round. */
  text: string
  html?: string
  /**
   * Files travelling WITH the message.
   *
   * A payslip is emailed as an attachment rather than only as a link because a
   * signed download URL expires — seven days at the very most — and an email
   * that outlives its own link is worse than no email. The archived copy in S3
   * is the system of record; the attachment is what the person actually opens.
   */
  attachments?: EmailAttachment[]
}

export interface EmailResult {
  to: string
  sent: boolean
  /** Present when `sent` is false. Never contains credentials. */
  error?: string
}

export interface MailerPort {
  send(message: EmailMessage): Promise<EmailResult>
}

// ---------------------------------------------------------------------------
// Time Off — owner: Dev A
// ---------------------------------------------------------------------------

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
  /** Duration approved inside the period, narrowed by the dashboard filters. */
  approvedInPeriod(period: Period, filter?: StatsFilter): Promise<number>
  /** Requests awaiting a decision, narrowed by the dashboard filters. */
  pendingCount(filter?: StatsFilter): Promise<number>
  /**
   * Leave balances aggregated across the employee population matched by
   * `filter`, one row per leave type that requires an allocation.
   *
   * This is what the org-wide Payroll Dashboard needs (spec B9's "leave
   * balances" alongside Period/Department/Employee Type filtering) — an
   * individual's own balance is a different question, answered by `timeoff`'s
   * own `GetBalanceUseCase`, not this port.
   */
  balanceTotals(filter: StatsFilter, on: Date): Promise<LeaveBalanceView[]>
}

// ---------------------------------------------------------------------------
// Payroll — owner: Dev C
//
// Consumed by Dev A: `PayslipQueryPort` for PDF and bulk email,
// `PayrollStatsPort` for the dashboard.
// ---------------------------------------------------------------------------

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
  /** Needed by bulk email. Null when the employee record has no address. */
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
  /** See the note on AttendanceStatsPort.summary about the third parameter. */
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
  /** Same employee paid twice inside one period — an operational alert. */
  duplicatePayslips(
    period: Period,
    departmentId?: string,
    employeeType?: string,
  ): Promise<Array<{ employeeId: string; employeeName: string; count: number }>>
}
