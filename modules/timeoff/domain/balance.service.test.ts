/**
 * The four rules that must not break, per docs/plans/DEV-A-platform.md:
 *   1. balance consumption
 *   2. over-draw rejection
 *   3. refuse-after-approve restores the balance
 *   4. the allocation validity window excludes out-of-range requests
 *
 * No database, no mocks of frameworks — just the aggregates. That is the payoff
 * of keeping domain/ framework-free.
 */
import { describe, expect, it } from 'vitest'
import { DomainError, Period } from '@/modules/shared'
import { Allocation } from './allocation'
import { LeaveRequest } from './leave-request'
import { TimeOffType } from './time-off-type'
import {
  assertNoOverlap,
  buildBalanceTotals,
  buildBalances,
  eligibleAllocations,
  selectAllocation,
} from './balance.service'

const EMP = 'employee-1'
const PAID = 'type-paid'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function paidType() {
  return TimeOffType.from({
    id: PAID,
    name: 'Paid Time Off',
    code: 'PL',
    unit: 'day',
    requiresAllocation: true,
    autoApprove: false,
    isPaid: true,
    isActive: true,
  })
}

function allocation(overrides: Partial<Parameters<typeof Allocation.from>[0]> = {}) {
  return Allocation.from({
    id: 'alloc-1',
    employeeId: EMP,
    timeOffTypeId: PAID,
    unit: 'day',
    allocated: 12,
    taken: 0,
    validity: Period.of(day('2026-01-01'), day('2026-12-31')),
    status: 'approved',
    ...overrides,
  })
}

function request(overrides: Partial<Parameters<typeof LeaveRequest.from>[0]> = {}) {
  const period = overrides.period ?? Period.of(day('2026-03-02'), day('2026-03-06'))
  return LeaveRequest.from({
    id: 'req-1',
    employeeId: EMP,
    timeOffTypeId: PAID,
    unit: 'day',
    duration: period.days,
    status: 'to_approve',
    ...overrides,
    // After the spread so a caller who passes `period` gets the duration
    // default derived from it rather than from the fixture's dates.
    period,
  })
}

describe('allocation consumption', () => {
  it('deducts from remaining when consumed', () => {
    const alloc = allocation()

    alloc.consume(5)

    expect(alloc.taken).toBe(5)
    expect(alloc.remaining).toBe(7)
  })

  it('rejects an over-draw and leaves the balance untouched', () => {
    const alloc = allocation({ allocated: 4 })

    expect(() => alloc.consume(5)).toThrowError(DomainError)
    expect(alloc.taken).toBe(0)
    expect(alloc.remaining).toBe(4)
  })

  it('refuses to spend an allocation that has not been approved', () => {
    const alloc = allocation({ status: 'draft' })

    expect(() => alloc.consume(1)).toThrowError(/not been approved/i)
  })

  it('restores the balance when an approval is reversed', () => {
    const alloc = allocation()

    alloc.consume(5)
    alloc.restore(5)

    expect(alloc.taken).toBe(0)
    expect(alloc.remaining).toBe(12)
  })

  it('clamps a restore at zero rather than inventing entitlement', () => {
    const alloc = allocation({ taken: 2 })

    alloc.restore(5)

    expect(alloc.taken).toBe(0)
  })

  it('keeps half-day arithmetic exact', () => {
    const alloc = allocation({ allocated: 1.5 })

    alloc.consume(0.5)
    alloc.consume(0.5)

    expect(alloc.remaining).toBe(0.5)
  })
})

describe('validity window', () => {
  it('excludes a request that starts before the allocation is valid', () => {
    const alloc = allocation({ validity: Period.of(day('2026-06-01'), day('2026-12-31')) })
    const req = request({ period: Period.of(day('2026-05-28'), day('2026-06-02')) })

    expect(eligibleAllocations([alloc], req)).toHaveLength(0)
  })

  it('excludes a request that runs past the end of the window', () => {
    const alloc = allocation({ validity: Period.of(day('2026-01-01'), day('2026-06-30')) })
    const req = request({ period: Period.of(day('2026-06-29'), day('2026-07-02')) })

    expect(eligibleAllocations([alloc], req)).toHaveLength(0)
  })

  it('accepts a request fully inside the window', () => {
    const alloc = allocation()
    const req = request()

    expect(eligibleAllocations([alloc], req)).toHaveLength(1)
  })
})

describe('selectAllocation', () => {
  it('prefers the allocation that expires soonest', () => {
    const expiring = allocation({
      id: 'expires-first',
      validity: Period.of(day('2026-01-01'), day('2026-06-30')),
    })
    const later = allocation({
      id: 'expires-later',
      validity: Period.of(day('2026-01-01'), day('2026-12-31')),
    })
    const req = request({ period: Period.of(day('2026-03-02'), day('2026-03-04')) })

    // Deliberately passed later-first, so a stable sort is not what makes this pass.
    expect(selectAllocation([later, expiring], req).id).toBe('expires-first')
  })

  it('skips an exhausted allocation and uses the next one that fits', () => {
    const empty = allocation({
      id: 'empty',
      allocated: 1,
      taken: 1,
      validity: Period.of(day('2026-01-01'), day('2026-06-30')),
    })
    const full = allocation({ id: 'full' })
    const req = request({ period: Period.of(day('2026-03-02'), day('2026-03-06')) })

    expect(selectAllocation([empty, full], req).id).toBe('full')
  })

  it('reports the shortfall when nothing can cover the request', () => {
    const alloc = allocation({ allocated: 2 })
    const req = request({ period: Period.of(day('2026-03-02'), day('2026-03-06')) })

    expect(() => selectAllocation([alloc], req)).toThrowError(/Insufficient balance: 2 remaining/)
  })

  it('reports a missing allocation distinctly from an empty one', () => {
    const req = request()

    expect(() => selectAllocation([], req)).toThrowError(/No approved allocation/)
  })
})

describe('buildBalances', () => {
  it('separates taken from pending so remaining answers "how much more may I book"', () => {
    const alloc = allocation({ allocated: 12, taken: 4 })
    const pending = request({ id: 'pending', duration: 3, status: 'to_approve' })
    const refused = request({ id: 'refused', duration: 5, status: 'refused' })

    const [balance] = buildBalances([paidType()], [alloc], [pending, refused], day('2026-03-01'))

    expect(balance).toMatchObject({ allocated: 12, taken: 4, pending: 3, remaining: 5 })
  })

  it('ignores allocations that are not valid on the reference date', () => {
    const lastYear = allocation({ validity: Period.of(day('2025-01-01'), day('2025-12-31')) })

    const [balance] = buildBalances([paidType()], [lastYear], [], day('2026-03-01'))

    expect(balance.allocated).toBe(0)
    expect(balance.remaining).toBe(0)
  })
})

describe('buildBalanceTotals', () => {
  it('merges pre-aggregated allocation and pending totals into the balance view', () => {
    const [balance] = buildBalanceTotals(
      [paidType()],
      [{ timeOffTypeId: PAID, allocated: 120, taken: 45 }],
      [{ timeOffTypeId: PAID, pending: 10 }],
    )

    // Same formula as buildBalances: remaining answers "how much more may the
    // filtered population book", so pending is subtracted alongside taken.
    expect(balance).toMatchObject({
      timeOffTypeId: PAID,
      allocated: 120,
      taken: 45,
      pending: 10,
      remaining: 65,
    })
  })

  it('reports zero rather than throwing for a type nobody has an allocation against', () => {
    const [balance] = buildBalanceTotals([paidType()], [], [])

    expect(balance).toMatchObject({ allocated: 0, taken: 0, pending: 0, remaining: 0 })
  })

  it('keeps each leave type isolated from the others', () => {
    const other = TimeOffType.from({
      id: 'type-sick',
      name: 'Sick Leave',
      code: 'SL',
      unit: 'day',
      requiresAllocation: true,
      autoApprove: true,
      isPaid: true,
      isActive: true,
    })

    const balances = buildBalanceTotals(
      [paidType(), other],
      [
        { timeOffTypeId: PAID, allocated: 12, taken: 4 },
        { timeOffTypeId: 'type-sick', allocated: 6, taken: 6 },
      ],
      [{ timeOffTypeId: PAID, pending: 2 }],
    )

    expect(balances).toEqual([
      { timeOffTypeId: PAID, timeOffTypeName: 'Paid Time Off', unit: 'day', allocated: 12, taken: 4, pending: 2, remaining: 6 },
      { timeOffTypeId: 'type-sick', timeOffTypeName: 'Sick Leave', unit: 'day', allocated: 6, taken: 6, pending: 0, remaining: 0 },
    ])
  })
})

describe('assertNoOverlap', () => {
  it('rejects a request colliding with an approved one', () => {
    const existing = request({ id: 'existing', status: 'approved' })
    const incoming = request({
      id: 'incoming',
      period: Period.of(day('2026-03-05'), day('2026-03-09')),
    })

    expect(() => assertNoOverlap(incoming, [existing])).toThrowError(/overlap/i)
  })

  it('allows dates that were previously refused', () => {
    const existing = request({ id: 'existing', status: 'refused' })
    const incoming = request({ id: 'incoming' })

    expect(() => assertNoOverlap(incoming, [existing])).not.toThrow()
  })

  it('does not consider a request to overlap itself', () => {
    const self = request({ id: 'req-1', status: 'to_approve' })

    expect(() => assertNoOverlap(self, [self])).not.toThrow()
  })
})
