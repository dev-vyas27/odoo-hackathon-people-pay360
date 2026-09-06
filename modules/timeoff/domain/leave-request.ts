


import { DomainError, Period, type LeaveStatus, type LeaveUnit } from '@/modules/shared'
import { stateOf, type LeaveRequestState } from './leave-request-state'

export interface LeaveRequestProps {
  id: string
  employeeId: string
  timeOffTypeId: string
  period: Period
  unit: LeaveUnit
  
  duration: number
  reason?: string | null
  status: LeaveStatus
  
  allocationId?: string | null
  


  decidedByEmployeeId?: string | null
  decidedAt?: Date | null
}

export interface LeaveRequestView {
  id: string
  employeeId: string
  timeOffTypeId: string
  start: string
  end: string
  unit: LeaveUnit
  duration: number
  reason: string | null
  status: LeaveStatus
  allocationId: string | null
  decidedAt: string | null
}

export class LeaveRequest {
  private constructor(private props: LeaveRequestProps) {}

  static from(props: LeaveRequestProps): LeaveRequest {
    if (props.duration <= 0) {
      throw DomainError.validation(
        'LEAVE_DURATION_INVALID',
        'A leave request must be longer than zero',
      )
    }
    return new LeaveRequest(props)
  }

  


  static defaultDuration(
    period: Period,
    unit: LeaveUnit,
    explicit?: number,
    workingDays?: number,
  ): number {
    if (explicit !== undefined && explicit > 0) return explicit
    if (unit === 'day') {
      if (workingDays === undefined) return period.days
      if (workingDays <= 0) {
        throw DomainError.validation(
          'LEAVE_NO_WORKING_DAYS',
          'That period contains no working days for this employee',
        )
      }
      return workingDays
    }
    throw DomainError.validation(
      'LEAVE_DURATION_REQUIRED',
      'Hour-based leave needs an explicit number of hours',
    )
  }

  get id(): string {
    return this.props.id
  }
  get employeeId(): string {
    return this.props.employeeId
  }
  get timeOffTypeId(): string {
    return this.props.timeOffTypeId
  }
  get period(): Period {
    return this.props.period
  }
  get unit(): LeaveUnit {
    return this.props.unit
  }
  get duration(): number {
    return this.props.duration
  }
  get status(): LeaveStatus {
    return this.props.status
  }
  get allocationId(): string | null {
    return this.props.allocationId ?? null
  }

  private get state(): LeaveRequestState {
    return stateOf(this.props.status)
  }

  get isEditable(): boolean {
    return this.state.isEditable
  }
  get consumesBalance(): boolean {
    return this.state.consumesBalance
  }

  
  overlaps(other: { period: Period; id: string }): boolean {
    return other.id !== this.props.id && this.props.period.overlaps(other.period)
  }

  submit(): void {
    this.props = { ...this.props, status: this.state.submit().name }
  }

  


  approve(decidedByEmployeeId: string | null, allocationId: string | null): void {
    this.props = {
      ...this.props,
      status: this.state.approve().name,
      allocationId,
      decidedByEmployeeId,
      decidedAt: new Date(),
    }
  }

  refuse(decidedByEmployeeId: string): void {
    this.props = {
      ...this.props,
      status: this.state.refuse().name,
      decidedByEmployeeId,
      decidedAt: new Date(),
    }
  }

  
  releaseAllocation(): void {
    this.props = { ...this.props, allocationId: null }
  }

  toProps(): LeaveRequestProps {
    return { ...this.props }
  }

  toView(): LeaveRequestView {
    return {
      id: this.props.id,
      employeeId: this.props.employeeId,
      timeOffTypeId: this.props.timeOffTypeId,
      start: this.props.period.start.toISOString(),
      end: this.props.period.end.toISOString(),
      unit: this.props.unit,
      duration: this.props.duration,
      reason: this.props.reason ?? null,
      status: this.props.status,
      allocationId: this.props.allocationId ?? null,
      decidedAt: this.props.decidedAt ? this.props.decidedAt.toISOString() : null,
    }
  }
}
