import { describe, expect, it } from 'vitest'
import { computeWorkedHours } from './worked-hours.service'

const d = (iso: string) => new Date(iso)

describe('computeWorkedHours', () => {
  it('computes a plain 8 hour shift with a 30 minute break', () => {
    const result = computeWorkedHours(d('2026-03-10T09:00:00Z'), d('2026-03-10T17:30:00Z'), 30)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(8)
  })

  it('returns an explicit error when check-out is missing, not zero', () => {
    const result = computeWorkedHours(d('2026-03-10T09:00:00Z'), null, 0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('MISSING_CHECKOUT')
  })

  it('handles a shift crossing midnight', () => {
    
    
    const result = computeWorkedHours(d('2026-03-10T22:00:00Z'), d('2026-03-10T06:00:00Z'), 0)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(8)
  })

  it('rejects a break longer than the shift', () => {
    const result = computeWorkedHours(d('2026-03-10T09:00:00Z'), d('2026-03-10T10:00:00Z'), 90)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('BREAK_EXCEEDS_SHIFT')
  })

  it('rejects a negative break', () => {
    const result = computeWorkedHours(d('2026-03-10T09:00:00Z'), d('2026-03-10T17:00:00Z'), -10)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_BREAK_MINUTES')
  })

  it('rejects a shift with zero duration', () => {
    const result = computeWorkedHours(d('2026-03-10T09:00:00Z'), d('2026-03-10T09:00:00Z'), 0)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ZERO_DURATION_SHIFT')
  })

  it('subtracts the break correctly for a fractional-hour result', () => {
    const result = computeWorkedHours(d('2026-03-10T09:00:00Z'), d('2026-03-10T12:15:00Z'), 15)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(3)
  })
})
