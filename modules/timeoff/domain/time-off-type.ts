/**
 * TimeOffType — the configuration that decides how a leave behaves.
 *
 * Four flags carry the whole policy (spec A4: units, allocation
 * requirements, approval workflows, payroll integration):
 *   unit                day or hour, and it must match the allocation's unit
 *   requiresAllocation  false for something like unpaid leave, which has no
 *                       balance to draw down and therefore cannot overdraw
 *   autoApprove         skips the manual approval step — see below
 *   isPaid              consumed by payroll when prorating
 *
 * Modelling these as data rather than as `if (type.name === 'Sick')` means
 * adding a leave type at 2am is a database row, not a deployment.
 *
 * `autoApprove` does NOT introduce a new state into the request lifecycle
 * (`leave-request-state.ts`) — every request still walks draft -> to_approve
 * -> approved, and an illegal transition is still impossible. What it changes
 * is WHO drives the to_approve -> approved transition: the application layer
 * (`request-leave` / `submit-leave` use cases) drives it immediately, using
 * the same allocation-consuming machinery `approve-leave` uses, instead of
 * waiting for a human to click Approve. See `consumeAllocationForApproval` in
 * `application/approval.service.ts`.
 */
import { DomainError, type LeaveUnit } from '@/modules/shared'

export interface TimeOffTypeProps {
  id: string
  name: string
  /** Short display code, e.g. PL / SL / UL. Unique. */
  code: string
  unit: LeaveUnit
  requiresAllocation: boolean
  /** Skip the manual approval step: a submitted request lands as approved. */
  autoApprove: boolean
  isPaid: boolean
  isActive: boolean
}

export type TimeOffTypeView = TimeOffTypeProps

export class TimeOffType {
  private constructor(private readonly props: TimeOffTypeProps) {}

  static from(props: TimeOffTypeProps): TimeOffType {
    if (!props.name.trim()) {
      throw DomainError.validation('TIME_OFF_TYPE_NAME_REQUIRED', 'Give the leave type a name')
    }
    return new TimeOffType({ ...props, code: props.code.trim().toUpperCase() })
  }

  get id(): string {
    return this.props.id
  }
  get name(): string {
    return this.props.name
  }
  get code(): string {
    return this.props.code
  }
  get unit(): LeaveUnit {
    return this.props.unit
  }
  get requiresAllocation(): boolean {
    return this.props.requiresAllocation
  }
  get autoApprove(): boolean {
    return this.props.autoApprove
  }
  get isPaid(): boolean {
    return this.props.isPaid
  }
  get isActive(): boolean {
    return this.props.isActive
  }

  /**
   * An allocation measured in hours cannot fund a leave type measured in days.
   * Catching it here rather than at read time is what stops "3" meaning three
   * days on one screen and three hours on another.
   */
  assertUnitMatches(unit: LeaveUnit): void {
    if (unit !== this.props.unit) {
      throw DomainError.rule(
        'TIME_OFF_UNIT_MISMATCH',
        `${this.props.name} is measured in ${this.props.unit}s, not ${unit}s`,
        { expected: this.props.unit, received: unit },
      )
    }
  }

  toView(): TimeOffTypeView {
    return { ...this.props }
  }
}
