


import {
  authorize,
  Ok,
  type Actor,
  type Period,
  type Result,
  type UseCase,
} from '@/modules/shared'
import type { EmployeeLookupPort, EmployeeSummary, EmployeeType } from '@/modules/shared'
import type { ContractQueryPort, ContractSnapshot } from '@/modules/shared'
import { checkEligibility, type IneligibilityReason } from '../domain/eligibility.spec'

export interface ListEligibleEmployeesInput {
  actor: Actor
  period: Period
  departmentId?: string
  employeeType?: EmployeeType
}

export interface EligibleEmployee {
  employee: EmployeeSummary
  contract: ContractSnapshot | null
  eligible: boolean
  reason: IneligibilityReason | null
  message: string | null
}

export class ListEligibleEmployeesUseCase
  implements UseCase<ListEligibleEmployeesInput, EligibleEmployee[]>
{
  constructor(
    private readonly employees: EmployeeLookupPort,
    private readonly contracts: ContractQueryPort,
  ) {}

  async execute({
    actor,
    period,
    departmentId,
    employeeType,
  }: ListEligibleEmployeesInput): Promise<Result<EligibleEmployee[]>> {
    const allowed = authorize(actor, 'payrun', 'create')
    if (!allowed.ok) return allowed

    const candidates = await this.employees.findEligible({
      departmentId,
      employeeType,
      
      activeOn: period.end,
    })

    
    
    const rows = await Promise.all(
      candidates.map(async (employee) => {
        const contract = await this.contracts.findApplicableContract(employee.id, period)
        const verdict = checkEligibility(employee, contract, period)
        return {
          employee,
          contract,
          eligible: verdict.eligible,
          reason: verdict.reason,
          message: verdict.message,
        }
      }),
    )

    return Ok(rows)
  }
}
