import { describe, expect, it } from 'vitest'
import { Period } from './period'

describe('Period', () => {
  it('builds a calendar month with the correct last day', () => {
    const feb = Period.month(2024, 2) // leap year
    expect(feb.end.toISOString().slice(0, 10)).toBe('2024-02-29')
    expect(feb.days).toBe(29)
  })

  it('counts a single day as one, not zero', () => {
    const d = new Date('2026-03-10')
    expect(Period.of(d, d).days).toBe(1)
  })

  it('detects overlap at the boundary day', () => {
    const a = Period.of(new Date('2026-01-01'), new Date('2026-01-31'))
    const b = Period.of(new Date('2026-01-31'), new Date('2026-02-15'))
    expect(a.overlaps(b)).toBe(true)
  })

  it('reports no overlap for adjacent, non-touching ranges', () => {
    const a = Period.of(new Date('2026-01-01'), new Date('2026-01-30'))
    const b = Period.of(new Date('2026-01-31'), new Date('2026-02-15'))
    expect(a.overlaps(b)).toBe(false)
  })

  it('intersects a contract with a payroll period', () => {
    const contract = Period.of(new Date('2026-01-15'), new Date('2026-12-31'))
    const payroll = Period.month(2026, 1)
    const shared = contract.intersection(payroll)
    expect(shared?.toString()).toBe('2026-01-15..2026-01-31')
    expect(shared?.days).toBe(17)
  })

  it('rejects an end date before the start', () => {
    expect(() => Period.of(new Date('2026-02-01'), new Date('2026-01-01'))).toThrow()
  })
})
