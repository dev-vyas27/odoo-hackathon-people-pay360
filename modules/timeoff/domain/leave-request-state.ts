/**
 * The leave request lifecycle, as the State pattern.
 *
 * draft --submit--> to_approve --approve--> approved
 *                              --refuse---> refused
 *                                approved --refuse--> refused   (with a restore)
 *
 * Why a class per state rather than a switch: every transition rule is stated
 * once, in the state it belongs to, and an illegal transition is impossible to
 * express rather than merely discouraged. Adding a `cancelled` state later means
 * adding a class, not auditing every `if (status === ...)` in the codebase.
 *
 * The states are stateless singletons — they describe transitions, they do not
 * hold request data — so allocating them costs nothing.
 */
import { DomainError, type LeaveStatus } from '@/modules/shared'

export interface LeaveRequestState {
  readonly name: LeaveStatus
  /** Editing is only meaningful before anyone has looked at it. */
  readonly isEditable: boolean
  /** Whether this state has consumed allocation balance. */
  readonly consumesBalance: boolean
  submit(): LeaveRequestState
  approve(): LeaveRequestState
  refuse(): LeaveRequestState
}

function illegal(from: LeaveStatus, action: string): never {
  throw DomainError.rule(
    'LEAVE_ILLEGAL_TRANSITION',
    `A ${from.replace(/_/g, ' ')} request cannot be ${action}`,
    { from, action },
  )
}

const DraftState: LeaveRequestState = {
  name: 'draft',
  isEditable: true,
  consumesBalance: false,
  submit: () => ToApproveState,
  approve: () => illegal('draft', 'approved before it is submitted'),
  refuse: () => illegal('draft', 'refused before it is submitted'),
}

const ToApproveState: LeaveRequestState = {
  name: 'to_approve',
  isEditable: false,
  consumesBalance: false,
  submit: () => illegal('to_approve', 'submitted twice'),
  approve: () => ApprovedState,
  refuse: () => RefusedState,
}

const ApprovedState: LeaveRequestState = {
  name: 'approved',
  isEditable: false,
  consumesBalance: true,
  submit: () => illegal('approved', 'submitted again'),
  approve: () => illegal('approved', 'approved twice'),
  // Deliberately allowed: an approval is reversed by refusing it, and the
  // approve use case's balance deduction is undone by the refuse use case.
  refuse: () => RefusedState,
}

const RefusedState: LeaveRequestState = {
  name: 'refused',
  isEditable: false,
  consumesBalance: false,
  submit: () => illegal('refused', 'resubmitted — raise a new request instead'),
  approve: () => illegal('refused', 'approved after being refused'),
  refuse: () => illegal('refused', 'refused twice'),
}

const BY_NAME: Record<LeaveStatus, LeaveRequestState> = {
  draft: DraftState,
  to_approve: ToApproveState,
  approved: ApprovedState,
  refused: RefusedState,
}

export function stateOf(status: LeaveStatus): LeaveRequestState {
  const state = BY_NAME[status]
  if (!state) {
    throw DomainError.validation('LEAVE_UNKNOWN_STATUS', `Unknown leave status: ${status}`)
  }
  return state
}
