/**
 * Domain events — the one-way seam between modules.
 *
 * When Time Off approves a request it does NOT call Attendance or Payroll. It
 * publishes LeaveRequestApproved and forgets. Subscribers react. This is how a
 * module gains behaviour in another context without either side importing the
 * other (Observer + Dependency Inversion).
 *
 * The union below is the single registry of everything that crosses a module
 * boundary. Adding a member here is a deliberate, reviewable act.
 */
export interface DomainEventBase {
  readonly occurredAt: Date
}

export interface EmployeeArchived extends DomainEventBase {
  readonly type: 'employee.archived'
  readonly employeeId: string
}

export interface ContractActivated extends DomainEventBase {
  readonly type: 'contract.activated'
  readonly contractId: string
  readonly employeeId: string
}

export interface LeaveRequestApproved extends DomainEventBase {
  readonly type: 'leave_request.approved'
  readonly requestId: string
  readonly employeeId: string
  readonly timeOffTypeId: string
  readonly duration: number
  readonly unit: 'day' | 'hour'
}

export interface LeaveRequestRefused extends DomainEventBase {
  readonly type: 'leave_request.refused'
  readonly requestId: string
  readonly employeeId: string
}

export interface PayrunValidated extends DomainEventBase {
  readonly type: 'payrun.validated'
  readonly payrunId: string
  readonly payslipIds: string[]
}

export interface PayrunPaid extends DomainEventBase {
  readonly type: 'payrun.paid'
  readonly payrunId: string
}

export type DomainEvent =
  | EmployeeArchived
  | ContractActivated
  | LeaveRequestApproved
  | LeaveRequestRefused
  | PayrunValidated
  | PayrunPaid

export type DomainEventType = DomainEvent['type']

/** Narrow a handler to exactly the event it subscribes to. */
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>
