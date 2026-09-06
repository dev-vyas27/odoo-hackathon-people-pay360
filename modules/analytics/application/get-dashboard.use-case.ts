


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

  
  kpis: {
    totalNetPaid: number
    payslipsGenerated: number
    averageSalary: number
    
    approvedTimeOff: number
    
    attendanceHealth: number | null
  }

  
  charts: {
    salaryCostByDepartment: SeriesPoint[]
    monthlyNetTrend: SeriesPoint[]
  }

  

  alerts: {
    missingBankDetails: Array<{ employeeId: string; name: string }>
    duplicatePayslips: Array<{ employeeId: string; employeeName: string; count: number }>
    contractAttention: ContractAlert[]
  }

  

  attendance: {
    present: number
    late: number
    absent: number
    overtimeHours: number
    missingCheckouts: number
    manualEdits: number
    coverage: number | null
  }

  
  timeOff: {
    approvedDays: number
    pendingRequests: number
    balances: LeaveBalanceView[]
  }

  
  departments: Array<{
    departmentId: string
    departmentName: string
    headcount: number
    totalCost: number
  }>

  


  departmentOptions: Array<{ id: string; name: string }>

  headcount: number
}

export interface GetDashboardInput {
  actor: Actor
  filters: DashboardFilters
}


const TREND_MONTHS = 12

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
      balances,
    ] = await Promise.all([
      ports.employees.headcount({ departmentId, employeeType }),
      ports.employees.headcountByDepartment({ employeeType }),
      ports.employees.missingBankDetails(),
      ports.attendance.summary(period, departmentId, employeeType),
      ports.contracts.attentionItems(period, CONTRACT_ATTENTION_DAYS),
      ports.leave.approvedInPeriod(period, { departmentId, employeeType }),
      ports.leave.pendingCount({ departmentId, employeeType }),
      ports.payroll.totals(period, departmentId, employeeType),
      ports.payroll.costByDepartment(period, departmentId, employeeType),
      ports.payroll.monthlyTrend(TREND_MONTHS, departmentId, employeeType),
      ports.payroll.duplicatePayslips(period, departmentId, employeeType),
      
      ports.leave.balanceTotals({ departmentId, employeeType }, period.end),
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
        
        coverage: attendanceCoverage(attendanceSummary, headcount, period, new Date()),
      },

      timeOff: {
        approvedDays,
        pendingRequests,
        
        
        
        
        
        balances,
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
