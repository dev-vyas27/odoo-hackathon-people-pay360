


import { DomainError, type LeaveUnit } from '@/modules/shared'

export interface TimeOffTypeProps {
  id: string
  name: string
  
  code: string
  unit: LeaveUnit
  requiresAllocation: boolean
  
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
