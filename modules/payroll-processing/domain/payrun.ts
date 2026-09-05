/**
 * Payrun — AGGREGATE ROOT: one batch of payslips for one structure and period.
 *
 * The aggregate owns its own lifecycle. Every transition goes through
 * `assertTransition`, so an illegal one throws here rather than being prevented
 * (or not) by whichever controller happens to be calling. Transitions return a
 * NEW payrun rather than mutating in place, matching how `Money` and `Period`
 * behave in the shared kernel.
 */
import { DomainError, type Period } from '@/modules/shared'
import { assertTransition, isFinalised, type PayrunStatus } from './payrun-state'

export interface Payrun {
  readonly id: string
  readonly name: string
  readonly structureId: string
  /** Joined from `salary_structures` on read; the table stores only the id. */
  readonly structureName: string
  readonly period: Period
  readonly status: PayrunStatus
  /**
   * Exactly the employees chosen in the wizard — never "everyone active".
   * Persisted in the `payrun_employees` join table.
   */
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

  const employeeIds = [...new Set(input.employeeIds)]
  if (!employeeIds.length) {
    throw DomainError.validation(
      'PAYRUN_NO_EMPLOYEES',
      'Select at least one employee to include in this payrun.',
    )
  }

  return {
    id: input.id,
    name,
    structureId: input.structureId,
    // Joined from salary_structures on read; empty only on a freshly built
    // aggregate that has not been persisted yet.
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

/** Guard for anything that would rewrite a finalised run's figures. */
export function assertEditable(payrun: Payrun): void {
  if (isFinalised(payrun.status)) {
    throw DomainError.rule(
      'PAYRUN_READ_ONLY',
      `"${payrun.name}" has been ${payrun.status} and is kept as history. It can no longer be changed.`,
      { payrunId: payrun.id, status: payrun.status },
    )
  }
}
