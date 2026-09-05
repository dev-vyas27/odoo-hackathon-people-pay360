/**
 * LeaveRequest — AGGREGATE ROOT.
 *
 * The aggregate owns its lifecycle but delegates the transition rules to
 * `leave-request-state.ts`; it owns duration and overlap logic itself because
 * those depend on its own data.
 *
 * Note what is NOT here: the balance deduction. Approving a request and
 * deducting the allocation must succeed or fail together, and an aggregate
 * cannot see another aggregate — so that pairing lives in `approve-leave.use-case`
 * where both are in hand. Putting it here would either duplicate state or
 * quietly let the two drift apart.
 */
import { DomainError, Period, type LeaveStatus, type LeaveUnit } from '@/modules/shared'
import { stateOf, type LeaveRequestState } from './leave-request-state'

export interface LeaveRequestProps {
  id: string
  employeeId: string
  timeOffTypeId: string
  period: Period
  unit: LeaveUnit
  /** In `unit`s. For day leave this defaults to the period length. */
  duration: number
  reason?: string | null
  status: LeaveStatus
  /** The allocation the approval drew from — needed to restore on refusal. */
  allocationId?: string | null
  decidedByUserId?: string | null
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

  /**
   * Day-unit requests default to the inclusive calendar length of the period,
   * so a Monday-to-Friday request is 5 and a single day is 1 rather than 0.
   * An explicit duration still wins — that is how half days are expressed.
   */
  static defaultDuration(period: Period, unit: LeaveUnit, explicit?: number): number {
    if (explicit !== undefined && explicit > 0) return explicit
    if (unit === 'day') return period.days
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

  /** Two requests from the same employee may not cover the same calendar day. */
  overlaps(other: { period: Period; id: string }): boolean {
    return other.id !== this.props.id && this.props.period.overlaps(other.period)
  }

  submit(): void {
    this.props = { ...this.props, status: this.state.submit().name }
  }

  approve(decidedByUserId: string, allocationId: string | null): void {
    this.props = {
      ...this.props,
      status: this.state.approve().name,
      allocationId,
      decidedByUserId,
      decidedAt: new Date(),
    }
  }

  refuse(decidedByUserId: string): void {
    this.props = {
      ...this.props,
      status: this.state.refuse().name,
      decidedByUserId,
      decidedAt: new Date(),
    }
  }

  /** Clears the allocation link once the balance has actually been restored. */
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
