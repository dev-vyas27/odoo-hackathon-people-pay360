/**
 * The allocation lifecycle, which spec A4 states plainly: allocations require
 * "approval before availability".
 *
 * That single sentence is three rules — a fresh allocation is not spendable,
 * approving makes it spendable, and refusing one that has already been spent
 * against is not allowed. Each gets a test, because each is the kind of rule
 * that quietly stops being true during a refactor.
 */
import { describe, expect, it } from 'vitest'
import { DomainError, Period } from '@/modules/shared'
import { Allocation, type AllocationProps } from './allocation'
import { TimeOffType } from './time-off-type'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function allocation(overrides: Partial<AllocationProps> = {}) {
  return Allocation.from({
    id: 'alloc-1',
    employeeId: 'employee-1',
    timeOffTypeId: 'type-paid',
    unit: 'day',
    allocated: 12,
    taken: 0,
    validity: Period.of(day('2026-01-01'), day('2026-12-31')),
    status: 'to_approve',
    ...overrides,
  })
}

describe('approval before availability', () => {
  it('is not spendable while it is awaiting approval', () => {
    const pending = allocation()

    expect(pending.isUsable).toBe(false)
    expect(() => pending.consume(1)).toThrowError(/not been approved/i)
  })

  it('becomes spendable once approved', () => {
    const pending = allocation()

    pending.approve()

    expect(pending.isUsable).toBe(true)
    expect(() => pending.consume(1)).not.toThrow()
  })

  it('treats approving twice as a no-op rather than an error', () => {
    const approved = allocation({ status: 'approved' })

    // Idempotent on purpose: a double-clicked Approve button should not 500.
    expect(() => approved.approve()).not.toThrow()
    expect(approved.status).toBe('approved')
  })

  it('will not approve one that was already refused', () => {
    const refused = allocation({ status: 'refused' })

    expect(() => refused.approve()).toThrowError(DomainError)
  })
})

describe('refusing an allocation', () => {
  it('is allowed while nothing has been taken', () => {
    const pending = allocation()

    pending.refuse()

    expect(pending.status).toBe('refused')
    expect(pending.isUsable).toBe(false)
  })

  it('is refused once leave has been approved against it', () => {
    const inUse = allocation({ status: 'approved', taken: 3 })

    // Withdrawing this would leave approved leave funded by nothing.
    expect(() => inUse.refuse()).toThrowError(/already has 3/)
    expect(inUse.status).toBe('approved')
  })
})

describe('unit agreement', () => {
  const hourly = TimeOffType.from({
    id: 'type-hourly',
    name: 'Time Off In Lieu',
    code: 'TOIL',
    unit: 'hour',
    requiresAllocation: true,
    autoApprove: false,
    isPaid: true,
    isActive: true,
  })

  it('rejects a request measured in the wrong unit', () => {
    // 3 "days" against an hour-based type would be a 24x error in the balance.
    expect(() => hourly.assertUnitMatches('day')).toThrowError(/measured in hours/)
  })

  it('accepts the matching unit', () => {
    expect(() => hourly.assertUnitMatches('hour')).not.toThrow()
  })
})

describe('approval workflow', () => {
  it('exposes whether the type skips manual approval', () => {
    const manual = TimeOffType.from({
      id: 'type-manual',
      name: 'Paid Time Off',
      code: 'PL',
      unit: 'day',
      requiresAllocation: true,
      autoApprove: false,
      isPaid: true,
      isActive: true,
    })
    const auto = TimeOffType.from({
      id: 'type-auto',
      name: 'Work From Home',
      code: 'WFH',
      unit: 'day',
      requiresAllocation: false,
      autoApprove: true,
      isPaid: true,
      isActive: true,
    })

    expect(manual.autoApprove).toBe(false)
    expect(auto.autoApprove).toBe(true)
  })
})
