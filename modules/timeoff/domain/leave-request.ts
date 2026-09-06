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
  /**
   * Who decided it. `null` on an auto-approved request: the type's approval
   * workflow decided, not a person, and there is nobody to record here — see
   * `approve()`.
   */
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

  /**
   * Day-unit requests bill the days the employee's schedule actually works.
   *
   * Ten calendar days across two weekends is eight working days. Counting the
   * calendar span instead overdraws the employee's balance for days they were
   * never going to work, and the error compounds: the same inflated number is
   * what gets consumed from the allocation and reported to payroll.
   *
   * `workingDays` is resolved from the employee's working schedule by the
   * caller, which is the only layer with port access. It is deliberately NOT a
   * "skip Saturday and Sunday" rule — a compressed Mon-Thu schedule does not
   * work Friday either, and a hardcoded weekend would bill it.
   *
   * Undefined means "no schedule to measure against", not "zero": the employee
   * has no defined pattern, so the inclusive calendar span is the only honest
   * answer left. An explicit duration still wins over both — that is how half
   * days are expressed.
   */
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

  /** Two requests from the same employee may not cover the same calendar day. */
  overlaps(other: { period: Period; id: string }): boolean {
    return other.id !== this.props.id && this.props.period.overlaps(other.period)
  }

  submit(): void {
    this.props = { ...this.props, status: this.state.submit().name }
  }

  /**
   * `decidedByEmployeeId` is `null` for a type configured to auto-approve:
   * the request still walks to_approve -> approved through this same method
   * (see `leave-request-state.ts`), but the approval was driven by the
   * type's policy at submission time rather than by a person clicking
   * Approve, so there is no human decider to record.
   */
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
