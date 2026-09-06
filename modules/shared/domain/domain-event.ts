

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

export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>
