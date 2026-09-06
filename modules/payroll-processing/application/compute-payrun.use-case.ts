


import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { SalaryStructureQueryPort } from '@/modules/payroll-config'
import type { EmployeeLookupPort, EmployeeSummary } from '@/modules/shared'
import type { ContractQueryPort, ContractSnapshot, ScheduleQueryPort } from '@/modules/shared'
import type { AttendanceStatsPort } from '@/modules/shared'
import { assertEditable, markComputed, type Payrun } from '../domain/payrun'
import { createPayslip } from '../domain/payslip-factory'
import type { Payslip } from '../domain/payslip'
import type { PayrollWarning } from '../domain/warnings/warning.port'
import { runWarningChecks } from '../domain/warnings/warning.registry'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'
import type { PayslipRepositoryPort } from './ports/payslip-repository.port'
import { attempt } from './attempt'

export interface ComputePayrunInput {
  actor: Actor
  payrunId: string
}

export interface ComputePayrunOutput {
  payrun: Payrun
  payslips: Payslip[]
  warnings: PayrollWarning[]
  
  skipped: Array<{ employeeId: string; employeeName: string; reason: string }>
}

export class ComputePayrunUseCase implements UseCase<ComputePayrunInput, ComputePayrunOutput> {
  constructor(
    private readonly payruns: PayrunRepositoryPort,
    private readonly payslips: PayslipRepositoryPort,
    private readonly structures: SalaryStructureQueryPort,
    private readonly employees: EmployeeLookupPort,
    private readonly contracts: ContractQueryPort,
    private readonly schedules: ScheduleQueryPort,
    private readonly attendance: AttendanceStatsPort,
  ) {}

  async execute({ actor, payrunId }: ComputePayrunInput): Promise<Result<ComputePayrunOutput>> {
    const allowed = authorize(actor, 'payrun', 'update')
    if (!allowed.ok) return allowed

    const payrun = await this.payruns.findById(payrunId)
    if (!payrun) {
      return Err(DomainError.notFound('PAYRUN_NOT_FOUND', 'That payrun no longer exists.'))
    }

    const editable = attempt(() => assertEditable(payrun))
    if (!editable.ok) return editable

    const structure = await this.structures.findById(payrun.structureId)
    if (!structure) {
      return Err(
        DomainError.notFound(
          'STRUCTURE_NOT_FOUND',
          `The salary structure this payrun was created with no longer exists.`,
        ),
      )
    }

    const employees = await this.employees.findManyByIds([...payrun.employeeIds])
    const contracts = await this.resolveContracts(employees, payrun)
    const attendance = await this.resolveAttendance(employees, payrun)
    const expectedHours = await this.resolveExpectedHours(employees, contracts, payrun)

    const drafts: Payslip[] = []
    const skipped: ComputePayrunOutput['skipped'] = []

    for (const employee of employees) {
      const contract = contracts.get(employee.id)
      if (!contract) {
        skipped.push({
          employeeId: employee.id,
          employeeName: employee.name,
          reason: 'No contract covers this period',
        })
        continue
      }

      const worked = attendance.get(employee.id)

      const built = attempt(() =>
        createPayslip({
          id: 'pending',
          payrunId: payrun.id,
          payrunName: payrun.name,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeEmail: employee.email,
          departmentId: contract.departmentId ?? employee.departmentId,
          contract: { id: contract.id, wage: contract.wage },
          structure,
          period: payrun.period,
          workedDays: worked?.days ?? 0,
          


          workedUnits: worked?.hours ?? 0,
          expectedUnits: expectedHours.get(employee.id) ?? 0,
        }),
      )
      
      
      if (!built.ok) return built

      drafts.push(built.value)
    }

    const stored = await this.payslips.replaceForPayrun(payrun.id, drafts)

    const transitioned = attempt(() => markComputed(payrun))
    if (!transitioned.ok) return transitioned
    const saved = await this.payruns.updateStatus(payrun.id, transitioned.value.status)

    const elsewhere = await this.payslips.findOverlapping(
      employees.map((e) => e.id),
      payrun.period,
      payrun.id,
    )

    const warnings = runWarningChecks({
      payrunId: payrun.id,
      period: payrun.period,
      employees,
      contracts,
      payslips: stored,
      payslipsElsewhere: elsewhere,
    })

    return Ok({ payrun: saved ?? transitioned.value, payslips: stored, warnings, skipped })
  }

  private async resolveContracts(
    employees: EmployeeSummary[],
    payrun: Payrun,
  ): Promise<Map<string, ContractSnapshot | null>> {
    const entries = await Promise.all(
      employees.map(
        async (employee) =>
          [
            employee.id,
            await this.contracts.findApplicableContract(employee.id, payrun.period),
          ] as const,
      ),
    )
    return new Map(entries)
  }

  
  private async resolveAttendance(
    employees: EmployeeSummary[],
    payrun: Payrun,
  ): Promise<Map<string, { hours: number; days: number }>> {
    const entries = await Promise.all(
      employees.map(async (employee) => {
        const [hours, days] = await Promise.all([
          this.attendance.workedHours(employee.id, payrun.period),
          this.attendance.workedDays(employee.id, payrun.period),
        ])
        return [employee.id, { hours, days }] as const
      }),
    )
    return new Map(entries)
  }

  


  private async resolveExpectedHours(
    employees: EmployeeSummary[],
    contracts: ReadonlyMap<string, ContractSnapshot | null>,
    payrun: Payrun,
  ): Promise<Map<string, number>> {
    const bySchedule = new Map<string, number>()
    const result = new Map<string, number>()

    for (const employee of employees) {
      const scheduleId =
        contracts.get(employee.id)?.workingScheduleId ?? employee.workingScheduleId
      if (!scheduleId) {
        
        result.set(employee.id, 0)
        continue
      }

      if (!bySchedule.has(scheduleId)) {
        bySchedule.set(scheduleId, await this.schedules.expectedHours(scheduleId, payrun.period))
      }
      result.set(employee.id, bySchedule.get(scheduleId) ?? 0)
    }

    return result
  }
}
