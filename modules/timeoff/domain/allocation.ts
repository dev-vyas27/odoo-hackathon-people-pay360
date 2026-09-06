


import { DomainError, Period, type LeaveUnit } from '@/modules/shared'

export const ALLOCATION_STATUSES = ['draft', 'to_approve', 'approved', 'refused'] as const
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number]

export interface AllocationProps {
  id: string
  employeeId: string
  timeOffTypeId: string
  unit: LeaveUnit
  
  allocated: number
  
  taken: number
  validity: Period
  status: AllocationStatus
  note?: string | null
}

export interface AllocationView {
  id: string
  employeeId: string
  timeOffTypeId: string
  unit: LeaveUnit
  allocated: number
  taken: number
  remaining: number
  validFrom: string
  validTo: string
  status: AllocationStatus
  note?: string | null
}

export class Allocation {
  private constructor(private props: AllocationProps) {}

  static from(props: AllocationProps): Allocation {
    if (props.allocated < 0) {
      throw DomainError.validation('ALLOCATION_NEGATIVE', 'Allocated amount cannot be negative')
    }
    if (props.taken < 0) {
      throw DomainError.validation('ALLOCATION_TAKEN_NEGATIVE', 'Taken amount cannot be negative')
    }
    return new Allocation(props)
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
  get unit(): LeaveUnit {
    return this.props.unit
  }
  get allocated(): number {
    return this.props.allocated
  }
  get taken(): number {
    return this.props.taken
  }
  get validity(): Period {
    return this.props.validity
  }
  get status(): AllocationStatus {
    return this.props.status
  }

  get remaining(): number {
    return round2(this.props.allocated - this.props.taken)
  }

  
  get isUsable(): boolean {
    return this.props.status === 'approved'
  }

  


  covers(period: Period): boolean {
    return this.props.validity.contains(period.start) && this.props.validity.contains(period.end)
  }

  canAbsorb(amount: number): boolean {
    return this.remaining >= amount
  }

  consume(amount: number): void {
    if (amount <= 0) {
      throw DomainError.validation('ALLOCATION_BAD_AMOUNT', 'Amount to consume must be positive')
    }
    if (!this.isUsable) {
      throw DomainError.rule(
        'ALLOCATION_NOT_APPROVED',
        'This allocation has not been approved and cannot be used',
      )
    }
    if (!this.canAbsorb(amount)) {
      throw DomainError.rule(
        'ALLOCATION_INSUFFICIENT',
        `Insufficient balance: ${this.remaining} ${this.props.unit}(s) remaining, ${amount} requested`,
        { remaining: this.remaining, requested: amount, unit: this.props.unit },
      )
    }
    this.props = { ...this.props, taken: round2(this.props.taken + amount) }
  }

  
  restore(amount: number): void {
    if (amount <= 0) {
      throw DomainError.validation('ALLOCATION_BAD_AMOUNT', 'Amount to restore must be positive')
    }
    
    
    this.props = { ...this.props, taken: round2(Math.max(0, this.props.taken - amount)) }
  }

  approve(): void {
    if (this.props.status === 'approved') return
    if (this.props.status === 'refused') {
      throw DomainError.rule('ALLOCATION_REFUSED', 'A refused allocation cannot be approved')
    }
    this.props = { ...this.props, status: 'approved' }
  }

  refuse(): void {
    if (this.props.taken > 0) {
      throw DomainError.rule(
        'ALLOCATION_IN_USE',
        `This allocation already has ${this.props.taken} ${this.props.unit}(s) taken against it`,
      )
    }
    this.props = { ...this.props, status: 'refused' }
  }

  toProps(): AllocationProps {
    return { ...this.props }
  }

  toView(): AllocationView {
    return {
      id: this.props.id,
      employeeId: this.props.employeeId,
      timeOffTypeId: this.props.timeOffTypeId,
      unit: this.props.unit,
      allocated: this.props.allocated,
      taken: this.props.taken,
      remaining: this.remaining,
      validFrom: this.props.validity.start.toISOString(),
      validTo: this.props.validity.end.toISOString(),
      status: this.props.status,
      note: this.props.note ?? null,
    }
  }
}



function round2(n: number): number {
  return Math.round(n * 100) / 100
}
