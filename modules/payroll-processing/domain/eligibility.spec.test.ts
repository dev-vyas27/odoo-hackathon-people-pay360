import { describe, expect, it } from 'vitest'
import { Period } from '@/modules/shared'
import { checkEligibility, coversPeriod } from './eligibility.spec'
import { JANUARY, contract, employee } from './test-fixtures'

describe('checkEligibility', () => {
  it('accepts an active employee with a contract covering the period', () => {
    const verdict = checkEligibility(employee(), contract(), JANUARY)

    expect(verdict.eligible).toBe(true)
    expect(verdict.reason).toBeNull()
  })

  it('rejects an archived employee', () => {
    const verdict = checkEligibility(employee({ isActive: false }), contract(), JANUARY)

    expect(verdict.reason).toBe('inactive')
    expect(verdict.message).toMatch(/archived/)
  })

  it('rejects an employee with no applicable contract', () => {
    const verdict = checkEligibility(employee(), null, JANUARY)

    expect(verdict.reason).toBe('no_contract')
  })

  it('rejects a contract that does not overlap the period at all', () => {
    const expired = contract({
      start: new Date(Date.UTC(2024, 0, 1)),
      end: new Date(Date.UTC(2024, 11, 31)),
    })

    expect(checkEligibility(employee(), expired, JANUARY).reason).toBe('contract_outside_period')
  })
})

describe('coversPeriod', () => {
  it('accepts an open-ended contract that started before the period', () => {
    expect(coversPeriod(contract({ end: null }), JANUARY)).toBe(true)
  })

  it('accepts a contract ending inside the period', () => {
    expect(coversPeriod(contract({ end: new Date(Date.UTC(2026, 0, 15)) }), JANUARY)).toBe(true)
  })

  it('accepts a contract starting inside the period', () => {
    expect(coversPeriod(contract({ start: new Date(Date.UTC(2026, 0, 20)) }), JANUARY)).toBe(true)
  })

  it('rejects a contract that starts after the period ends', () => {
    expect(coversPeriod(contract({ start: new Date(Date.UTC(2026, 1, 1)) }), JANUARY)).toBe(false)
  })

  it('rejects a contract that ended before the period began', () => {
    const old = contract({
      start: new Date(Date.UTC(2025, 0, 1)),
      end: new Date(Date.UTC(2025, 11, 31)),
    })

    expect(coversPeriod(old, JANUARY)).toBe(false)
  })

  it('distinguishes two contracts of the same employee by period', () => {
    // The scenario the spec keeps returning to: an employee with an expired
    // contract AND a current one. Each period must select its own.
    const expired = contract({
      id: 'old',
      start: new Date(Date.UTC(2025, 0, 1)),
      end: new Date(Date.UTC(2025, 5, 30)),
    })
    const current = contract({ id: 'new', start: new Date(Date.UTC(2025, 6, 1)), end: null })

    expect(coversPeriod(expired, Period.month(2025, 3))).toBe(true)
    expect(coversPeriod(current, Period.month(2025, 3))).toBe(false)

    expect(coversPeriod(expired, JANUARY)).toBe(false)
    expect(coversPeriod(current, JANUARY)).toBe(true)
  })
})
