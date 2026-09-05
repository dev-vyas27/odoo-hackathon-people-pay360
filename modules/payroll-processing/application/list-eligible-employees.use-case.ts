/**
 * Step 2 of the payrun wizard: who may be included in this run.
 *
 * Crucially this use case only READS. Choosing a structure and a period in step
 * 1 must not create anything — the spec calls that out specifically — so the
 * wizard asks this question, holds the answer in React state, and persists
 * nothing until Create Payrun is pressed.
 */
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
      // An employee must exist on the day the period ends to be paid for it.
      activeOn: period.end,
    })

    // The contract is resolved FOR THE PERIOD, so the list already reflects who
    // can genuinely be paid rather than who merely exists.
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
