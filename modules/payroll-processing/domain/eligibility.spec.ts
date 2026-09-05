/**
 * Who may be included in a payrun — the Specification pattern.
 *
 * Kept as one pure predicate so the wizard's employee list and the create-payrun
 * use case ask the SAME question. If they each had their own idea of "eligible",
 * a user could select someone in step 2 and be rejected on submit, which is the
 * kind of inconsistency that erodes trust in a payroll system quickly.
 */
import type { Period } from '@/modules/shared'
import type { EmployeeSummary } from '@/modules/shared'
import type { ContractSnapshot } from '@/modules/shared'

export type IneligibilityReason = 'inactive' | 'no_contract' | 'contract_outside_period'

export interface EligibilityVerdict {
  readonly eligible: boolean
  readonly reason: IneligibilityReason | null
  readonly message: string | null
}

const ELIGIBLE: EligibilityVerdict = { eligible: true, reason: null, message: null }

export function checkEligibility(
  employee: EmployeeSummary,
  contract: ContractSnapshot | null,
  period: Period,
): EligibilityVerdict {
  if (!employee.isActive) {
    return {
      eligible: false,
      reason: 'inactive',
      message: `${employee.name} is archived and cannot be paid.`,
    }
  }

  if (!contract) {
    return {
      eligible: false,
      reason: 'no_contract',
      message: `${employee.name} has no contract covering ${period.toString()}.`,
    }
  }

  // Defence in depth: ContractQueryPort is supposed to have resolved this
  // already, but a payslip computed from a contract that does not cover the
  // period would be wrong in a way nobody notices until an audit.
  if (!coversPeriod(contract, period)) {
    return {
      eligible: false,
      reason: 'contract_outside_period',
      message: `${employee.name}'s contract does not overlap ${period.toString()}.`,
    }
  }

  return ELIGIBLE
}

export function coversPeriod(contract: ContractSnapshot, period: Period): boolean {
  const startsBeforeEnd = contract.start.getTime() <= period.end.getTime()
  const endsAfterStart = contract.end === null || contract.end.getTime() >= period.start.getTime()
  return startsBeforeEnd && endsAfterStart
}
