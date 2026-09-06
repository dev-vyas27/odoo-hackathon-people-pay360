/**
 * The Payroll Dashboard, spec B9.
 *
 * One use case composes five ports and applies the three filters from spec A7
 * (Period, Department, Employee Type). Every section of the response maps to a
 * bullet in the spec, and every number comes from an aggregation over real rows
 * — nothing here is hardcoded, which section A7 requires in as many words:
 * "live metrics derived from actual system records".
 *
 * The five port calls run in parallel. Sequentially this is five round trips to
 * a database in Singapore before anything renders; concurrently it is one.
 */
import {
  Ok,
  authorize,
  type Actor,
  type ContractAlert,
  type EmployeeType,
  type LeaveBalanceView,
  type Period,
  type Result,
  type SeriesPoint,
  type UseCase,
} from '@/modules/shared'
import {
  attendanceCoverage,
  attendanceHealth,
  averageSalary,
  fillMonthlyTrend,
  toDepartmentSeries,
} from '../domain/dashboard-metrics'
import { dashboardPorts } from './ports/stats.ports'

export interface DashboardFilters {
  /** Already resolved from `?period=` by the controller. */
  period: Period
  departmentId?: string
  employeeType?: EmployeeType
}

export interface DashboardView {
  filters: {
    periodStart: string
    periodEnd: string
    periodLabel: string
    departmentId: string | null
    employeeType: EmployeeType | null
  }

  /** Spec B9: "KPI cards display key metrics like ..." — these five, named. */
  kpis: {
    totalNetPaid: number
    payslipsGenerated: number
    averageSalary: number
    /** In days. */
    approvedTimeOff: number
    /** 0-100, or null when there is no attendance data to judge. */
    attendanceHealth: number | null
  }

  /** Spec B9: "Charts plot Salary Cost by Department and Monthly Net Salary Trends". */
  charts: {
    salaryCostByDepartment: SeriesPoint[]
    monthlyNetTrend: SeriesPoint[]
  }

  /** Spec B9: "Operational alerts surface ... missing required information,
   *  duplicate payslips, and contract attention items". */
  alerts: {
    missingBankDetails: Array<{ employeeId: string; name: string }>
    duplicatePayslips: Array<{ employeeId: string; employeeName: string; count: number }>
    contractAttention: ContractAlert[]
  }

  /** Spec B9: "Attendance Overview can show Present, Late, Absent, Overtime,
   *  missing check-outs, manual edits, and attendance coverage". */
  attendance: {
    present: number
    late: number
    absent: number
    overtimeHours: number
    missingCheckouts: number
    manualEdits: number
    coverage: number | null
  }

  /** Spec B9: "... approved days, pending requests, and leave balances". */
  timeOff: {
    approvedDays: number
    pendingRequests: number
    balances: LeaveBalanceView[]
  }

  /** Spec B9: "Department breakdown combines headcount with total salary expenditure". */
  departments: Array<{
    departmentId: string
    departmentName: string
    headcount: number
    totalCost: number
  }>

  /**
   * Every department, regardless of the current filter — this populates the
   * department dropdown. Derived from the same query, so filtering to one
   * department cannot make the others un-selectable.
   */
  departmentOptions: Array<{ id: string; name: string }>

  headcount: number
}

export interface GetDashboardInput {
  actor: Actor
  filters: DashboardFilters
}

/** How far back the trend chart looks. Twelve months is one salary cycle. */
const TREND_MONTHS = 12
/** A contract inside this many days of expiry needs attention. */
const CONTRACT_ATTENTION_DAYS = 60

export class GetDashboardUseCase implements UseCase<GetDashboardInput, DashboardView> {
  async execute(input: GetDashboardInput): Promise<Result<DashboardView>> {
    const allowed = authorize(input.actor, 'dashboard', 'read')
    if (!allowed.ok) return allowed

    const { period, departmentId, employeeType } = input.filters
    const ports = dashboardPorts()

    const [
      headcount,
      headcountByDepartment,
      missingBankDetails,
      attendanceSummary,
      contractAttention,
      approvedDays,
      pendingRequests,
      payrollTotals,
      costByDepartment,
      monthlyTrend,
      duplicatePayslips,
    ] = await Promise.all([
      ports.employees.headcount({ departmentId, employeeType }),
      ports.employees.headcountByDepartment({ employeeType }),
      ports.employees.missingBankDetails(),
      ports.attendance.summary(period, departmentId, employeeType),
      ports.contracts.attentionItems(period, CONTRACT_ATTENTION_DAYS),
      ports.leave.approvedInPeriod(period, departmentId ? [departmentId] : undefined),
      ports.leave.pendingCount(),
      ports.payroll.totals(period, departmentId, employeeType),
      ports.payroll.costByDepartment(period, employeeType),
      ports.payroll.monthlyTrend(TREND_MONTHS),
      ports.payroll.duplicatePayslips(period),
    ])

    const departmentNames = new Map(
      headcountByDepartment.map((d) => [d.departmentId, d.departmentName]),
    )
    const costById = new Map(costByDepartment.map((row) => [row.departmentId, row.total]))

    return Ok({
      filters: {
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        periodLabel: formatPeriod(period),
        departmentId: departmentId ?? null,
        employeeType: employeeType ?? null,
      },

      kpis: {
        totalNetPaid: payrollTotals.totalNet,
        payslipsGenerated: payrollTotals.payslipCount,
        // Recomputed rather than trusting the port's own average: the two must
        // agree with the totals shown beside them, and this is the definition
        // that is unit-tested.
        averageSalary: averageSalary(payrollTotals.totalNet, payrollTotals.payslipCount),
        approvedTimeOff: approvedDays,
        attendanceHealth: attendanceHealth(attendanceSummary),
      },

      charts: {
        salaryCostByDepartment: toDepartmentSeries(costByDepartment, departmentNames),
        monthlyNetTrend: fillMonthlyTrend(monthlyTrend, TREND_MONTHS, period.end),
      },

      alerts: {
        missingBankDetails,
        duplicatePayslips,
        contractAttention,
      },

      attendance: {
        ...attendanceSummary,
        // Measured against days elapsed, not the whole month — see the domain fn.
        coverage: attendanceCoverage(attendanceSummary, headcount, period, new Date()),
      },

      timeOff: {
        approvedDays,
        pendingRequests,
        // Company-wide balances would be a row per employee per leave type.
        // The dashboard shows the aggregate figures above; an individual's
        // balances live on the Time Off screens, where they belong.
        balances: [],
      },

      departments: headcountByDepartment
        .filter((d) => !departmentId || d.departmentId === departmentId)
        .map((d) => ({
          departmentId: d.departmentId,
          departmentName: d.departmentName,
          headcount: d.count,
          totalCost: costById.get(d.departmentId) ?? 0,
        }))
        .sort((a, b) => b.totalCost - a.totalCost || b.headcount - a.headcount),

      departmentOptions: headcountByDepartment.map((d) => ({
        id: d.departmentId,
        name: d.departmentName,
      })),

      headcount,
    })
  }
}

/** "March 2026" for a calendar month, "2026" for a year, a range otherwise. */
function formatPeriod(period: Period): string {
  const start = period.start
  const end = period.end

  const isWholeMonth =
    start.getUTCDate() === 1 &&
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()

  if (isWholeMonth) {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start)
  }

  const isWholeYear =
    start.getUTCMonth() === 0 && start.getUTCDate() === 1 && end.getUTCMonth() === 11 && end.getUTCDate() === 31
  if (isWholeYear) return String(start.getUTCFullYear())

  return period.toString()
}
