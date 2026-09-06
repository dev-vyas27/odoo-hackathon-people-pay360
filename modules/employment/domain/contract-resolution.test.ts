import { describe, expect, it } from 'vitest'
import { Period } from '@/modules/shared'
import { contractsOverlap, resolveApplicableContract, type ContractRange } from './contract-resolution'

interface FakeContract extends ContractRange {
  id: string
}

function contract(id: string, start: string, end: string | null): FakeContract {
  return { id, start: new Date(start), end: end ? new Date(end) : null }
}

describe('resolveApplicableContract', () => {
  it('returns null when the employee has no contract at all', () => {
    const period = Period.month(2026, 3)
    expect(resolveApplicableContract([], period)).toBeNull()
  })

  it('resolves a single contract that fully covers the period', () => {
    const period = Period.month(2026, 3)
    const c = contract('c1', '2026-01-01', '2026-12-31')
    expect(resolveApplicableContract([c], period)).toBe(c)
  })

  it('returns null when the only contract does not overlap the period', () => {
    const period = Period.month(2026, 3)
    const c = contract('c1', '2026-04-01', '2026-12-31')
    expect(resolveApplicableContract([c], period)).toBeNull()
  })

  it('prefers the contract covering the period end when two overlap', () => {
    // Employee promoted mid-March: old contract ends the 15th, new one starts the 16th.
    const period = Period.month(2026, 3)
    const old = contract('old', '2025-01-01', '2026-03-15')
    const current = contract('current', '2026-03-16', null)
    const result = resolveApplicableContract([old, current], period)
    expect(result?.id).toBe('current')
  })

  it('returns null when an expired contract and a not-yet-started one both miss the period', () => {
    const period = Period.month(2026, 3)
    const expired = contract('expired', '2025-01-01', '2026-02-28')
    const notYetStarted = contract('future', '2026-04-01', null)
    const result = resolveApplicableContract([expired, notYetStarted], period)
    expect(result).toBeNull()
  })

  it('resolves an open-ended (null end) contract as covering every later period', () => {
    const period = Period.month(2026, 6)
    const c = contract('open', '2025-06-01', null)
    expect(resolveApplicableContract([c], period)?.id).toBe('open')
  })

  it('handles a contract starting mid-period', () => {
    const period = Period.month(2026, 3) // 2026-03-01..2026-03-31
    const c = contract('mid', '2026-03-20', null)
    const result = resolveApplicableContract([c], period)
    expect(result?.id).toBe('mid')
  })

  it('when several overlap but none covers the end, ties break on the latest start', () => {
    const period = Period.month(2026, 3)
    // Both contracts overlap the period but end before period end (03-31);
    // neither "covers the end" -- fall back to latest start.
    const earlier = contract('earlier', '2026-01-01', '2026-03-10')
    const later = contract('later', '2026-03-05', '2026-03-12')
    const result = resolveApplicableContract([earlier, later], period)
    expect(result?.id).toBe('later')
  })

  it('prefers the contract covering the end over one with a later start that does not', () => {
    const period = Period.month(2026, 3)
    const coversEnd = contract('covers-end', '2026-02-01', null)
    const laterButExpires = contract('expires-early', '2026-03-05', '2026-03-10')
    const result = resolveApplicableContract([coversEnd, laterButExpires], period)
    expect(result?.id).toBe('covers-end')
  })
})

describe('contractsOverlap', () => {
  it('detects overlap between two closed ranges', () => {
    expect(
      contractsOverlap(
        { start: new Date('2026-01-01'), end: new Date('2026-06-30') },
        { start: new Date('2026-06-01'), end: new Date('2026-12-31') },
      ),
    ).toBe(true)
  })

  it('detects no overlap between adjacent, non-touching ranges', () => {
    expect(
      contractsOverlap(
        { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        { start: new Date('2026-02-01'), end: new Date('2026-12-31') },
      ),
    ).toBe(false)
  })

  it('treats a null end as open-ended, overlapping anything that starts before forever', () => {
    expect(
      contractsOverlap(
        { start: new Date('2026-01-01'), end: null },
        { start: new Date('2030-01-01'), end: new Date('2031-01-01') },
      ),
    ).toBe(true)
  })

  it('two open-ended ranges always overlap once both have started', () => {
    expect(
      contractsOverlap(
        { start: new Date('2026-01-01'), end: null },
        { start: new Date('2027-01-01'), end: null },
      ),
    ).toBe(true)
  })
})
