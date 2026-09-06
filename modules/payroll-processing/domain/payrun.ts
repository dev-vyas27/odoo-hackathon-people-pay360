


import { DomainError, type Period } from '@/modules/shared'
import { assertTransition, isFinalised, type PayrunStatus } from './payrun-state'

export interface Payrun {
  readonly id: string
  readonly name: string
  readonly structureId: string
  
  readonly structureName: string
  readonly period: Period
  readonly status: PayrunStatus
  


  readonly employeeIds: readonly string[]
  readonly createdAt: Date
}

export interface PayrunInput {
  id: string
  name: string
  structureId: string
  structureName?: string
  period: Period
  employeeIds: string[]
  status?: PayrunStatus
  createdAt?: Date
}

export function createPayrun(input: PayrunInput): Payrun {
  const name = input.name.trim()
  if (!name) {
    throw DomainError.validation('PAYRUN_NAME_REQUIRED', 'A payrun needs a name.')
  }

  if (!input.structureId) {
    throw DomainError.validation(
      'PAYRUN_STRUCTURE_REQUIRED',
      'A payrun needs a salary structure.',
    )
  }

  if (![...new Set(input.employeeIds)].length) {
    throw DomainError.validation(
      'PAYRUN_NO_EMPLOYEES',
      'Select at least one employee to include in this payrun.',
    )
  }

  return reconstitutePayrun(input)
}



export function reconstitutePayrun(input: PayrunInput): Payrun {
  const employeeIds = [...new Set(input.employeeIds)]

  return {
    id: input.id,
    name: input.name.trim(),
    structureId: input.structureId,
    
    
    structureName: input.structureName ?? '',
    period: input.period,
    status: input.status ?? 'draft',
    employeeIds,
    createdAt: input.createdAt ?? new Date(),
  }
}

export function markComputed(payrun: Payrun): Payrun {
  assertTransition(payrun.status, 'computed')
  return { ...payrun, status: 'computed' }
}

export function markValidated(payrun: Payrun): Payrun {
  assertTransition(payrun.status, 'validated')
  return { ...payrun, status: 'validated' }
}

export function markPaid(payrun: Payrun): Payrun {
  assertTransition(payrun.status, 'paid')
  return { ...payrun, status: 'paid' }
}


export function assertEditable(payrun: Payrun): void {
  if (isFinalised(payrun.status)) {
    throw DomainError.rule(
      'PAYRUN_READ_ONLY',
      `"${payrun.name}" has been ${payrun.status} and is kept as history. It can no longer be changed.`,
      { payrunId: payrun.id, status: payrun.status },
    )
  }
}
