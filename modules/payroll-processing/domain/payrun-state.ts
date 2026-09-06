


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


export function isFinalised(status: PayrunStatus): boolean {
  return status === 'validated' || status === 'paid' || status === 'cancelled'
}
