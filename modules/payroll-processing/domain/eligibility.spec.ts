


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
