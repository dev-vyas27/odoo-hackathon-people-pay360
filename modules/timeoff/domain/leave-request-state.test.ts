/**
 * The lifecycle. These tests exist because "illegal transitions throw" is a
 * claim, and a claim without a test is a hope.
 */
import { describe, expect, it } from 'vitest'
import { DomainError, Period } from '@/modules/shared'
import { LeaveRequest } from './leave-request'
import { stateOf } from './leave-request-state'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const period = Period.of(day('2026-03-02'), day('2026-03-06'))

function draft() {
  return LeaveRequest.from({
    id: 'req-1',
    employeeId: 'employee-1',
    timeOffTypeId: 'type-1',
    period,
    unit: 'day',
    duration: 5,
    status: 'draft',
  })
}

describe('leave request lifecycle', () => {
  it('walks draft -> to_approve -> approved', () => {
    const request = draft()

    request.submit()
    expect(request.status).toBe('to_approve')

    request.approve('manager-1', 'alloc-1')
    expect(request.status).toBe('approved')
    expect(request.allocationId).toBe('alloc-1')
  })

  it('refuses to approve a request nobody has submitted', () => {
    expect(() => draft().approve('manager-1', null)).toThrowError(DomainError)
  })

  it('allows an approved request to be refused, which is how an approval is undone', () => {
    const request = draft()
    request.submit()
    request.approve('manager-1', 'alloc-1')

    request.refuse('manager-1')

    expect(request.status).toBe('refused')
  })

  it('reaches approved with no human decider, for a type that auto-approves', () => {
    // The application layer calls exactly this — submit() then approve(null, ...)
    // — when the request's Time Off Type is configured to skip manual review.
    // The transition is the SAME to_approve -> approved edge a human triggers;
    // only who decided differs.
    const request = draft()
    request.submit()

    request.approve(null, 'alloc-1')

    expect(request.status).toBe('approved')
    expect(request.allocationId).toBe('alloc-1')
    expect(request.toProps().decidedByEmployeeId).toBeNull()
  })

  it('will not resurrect a refused request', () => {
    const request = draft()
    request.submit()
    request.refuse('manager-1')

    expect(() => request.approve('manager-1', null)).toThrowError(/refused/i)
    expect(() => request.submit()).toThrowError(/refused/i)
  })

  it('marks only draft requests editable', () => {
    expect(stateOf('draft').isEditable).toBe(true)
    expect(stateOf('to_approve').isEditable).toBe(false)
    expect(stateOf('approved').isEditable).toBe(false)
  })

  it('knows that only the approved state has consumed balance', () => {
    expect(stateOf('approved').consumesBalance).toBe(true)
    expect(stateOf('to_approve').consumesBalance).toBe(false)
    expect(stateOf('refused').consumesBalance).toBe(false)
  })
})

describe('duration defaulting', () => {
  it('counts inclusive calendar days when the employee has no schedule', () => {
    expect(LeaveRequest.defaultDuration(period, 'day')).toBe(5)
    expect(LeaveRequest.defaultDuration(Period.of(day('2026-03-02'), day('2026-03-02')), 'day')).toBe(1)
  })

  it('lets an explicit value express a half day', () => {
    expect(LeaveRequest.defaultDuration(period, 'day', 0.5)).toBe(0.5)
  })

  it('insists on an explicit duration for hour-unit leave', () => {
    expect(() => LeaveRequest.defaultDuration(period, 'hour')).toThrowError(/explicit number of hours/)
  })

  /**
   * The reported bug: twelve calendar days across a weekend is ten working
   * days, and billing the employee for the Saturday and Sunday silently
   * overdraws their balance.
   *
   * The weekday arithmetic itself belongs to the schedule (and is tested in
   * `weekly-hours.service.test.ts`); what these assert is that the count wins
   * over the calendar span once it is known.
   */
  it('bills the working-day count rather than the calendar span', () => {
    // Mon 2 Mar -> Fri 13 Mar 2026 inclusive: 12 calendar days, one weekend.
    const fortnight = Period.of(day('2026-03-02'), day('2026-03-13'))

    expect(fortnight.days).toBe(12)
    expect(LeaveRequest.defaultDuration(fortnight, 'day', undefined, 10)).toBe(10)
  })

  it('still lets an explicit half day win over the working-day count', () => {
    expect(LeaveRequest.defaultDuration(period, 'day', 0.5, 5)).toBe(0.5)
  })

  it('refuses leave that falls entirely on non-working days', () => {
    const weekend = Period.of(day('2026-03-07'), day('2026-03-08'))
    expect(() => LeaveRequest.defaultDuration(weekend, 'day', undefined, 0)).toThrowError(
      /no working days/i,
    )
  })
})
