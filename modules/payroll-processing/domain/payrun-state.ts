/**
 * The payrun lifecycle, as data rather than as scattered `if` statements.
 *
 *   draft ──compute──▶ computed ──validate──▶ validated ──pay──▶ paid
 *                         ↑    │
 *                         └────┘ recompute
 *
 *   draft / computed ──cancel──▶ cancelled   (terminal)
 *
 * Once a run is validated it is history: the spec requires finalised and paid
 * runs to be preserved and read-only, so there is deliberately no edge out of
 * `validated` or `paid` except forward. Calling `markPaid()` on a draft throws
 * here, in the aggregate, rather than being caught by a controller that might
 * forget.
 *
 * The five states are exactly `payruns_status_valid` in migration 0009, so the
 * database and this file cannot disagree about what a status means.
 */
import { DomainError, PAYRUN_STATUSES, type PayrunStatus } from '@/modules/shared'

export { PAYRUN_STATUSES, type PayrunStatus }

export const PAYRUN_STATUS_LABELS: Record<PayrunStatus, string> = {
  draft: 'Draft',
  computed: 'Computed',
  validated: 'Validated',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const ALLOWED_TRANSITIONS: Record<PayrunStatus, readonly PayrunStatus[]> = {
  draft: ['computed', 'cancelled'],
  // Recomputing a computed run is legitimate: a rule was corrected and the
  // figures must be regenerated before anyone signs them off.
  computed: ['computed', 'validated', 'cancelled'],
  validated: ['paid'],
  paid: [],
  cancelled: [],
}

export function canTransition(from: PayrunStatus, to: PayrunStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: PayrunStatus, to: PayrunStatus): void {
  if (!canTransition(from, to)) {
    throw DomainError.rule(
      'PAYRUN_ILLEGAL_TRANSITION',
      `A ${PAYRUN_STATUS_LABELS[from].toLowerCase()} payrun cannot become ${PAYRUN_STATUS_LABELS[to].toLowerCase()}.`,
      { from, to },
    )
  }
}

/** Validated, paid and cancelled runs are history and must not be recomputed. */
export function isFinalised(status: PayrunStatus): boolean {
  return status === 'validated' || status === 'paid' || status === 'cancelled'
}
