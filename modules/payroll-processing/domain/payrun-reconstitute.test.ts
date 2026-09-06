import { describe, expect, it } from 'vitest'
import { Period } from '@/modules/shared'
import { createPayrun, reconstitutePayrun } from './payrun'

/**
 * Creating and reading back are different operations with different rules.
 *
 * The repository used to call `createPayrun` on every read, so a create-time
 * invariant ran against rows that already existed. One payrun whose last
 * employee had been removed threw on load and took the whole payrun LIST with
 * it — every other run became unreadable because of one unusual row.
 */
const base = {
  id: 'run-1',
  name: 'June 2026',
  structureId: 'str-1',
  period: Period.month(2026, 6),
  employeeIds: [] as string[],
}

describe('payrun: create rules vs read rules', () => {
  it('refuses to CREATE a payrun with nobody in it', () => {
    expect(() => createPayrun(base)).toThrow(/at least one employee/i)
  })

  it('still READS BACK a payrun with nobody in it', () => {
    const payrun = reconstitutePayrun(base)
    expect(payrun.employeeIds).toEqual([])
    expect(payrun.name).toBe('June 2026')
  })

  it('deduplicates employee ids on both paths', () => {
    const input = { ...base, employeeIds: ['emp-1', 'emp-1', 'emp-2'] }
    expect(createPayrun(input).employeeIds).toEqual(['emp-1', 'emp-2'])
    expect(reconstitutePayrun(input).employeeIds).toEqual(['emp-1', 'emp-2'])
  })

  it('trims the name on both paths', () => {
    const input = { ...base, name: '  June 2026  ', employeeIds: ['emp-1'] }
    expect(createPayrun(input).name).toBe('June 2026')
    expect(reconstitutePayrun(input).name).toBe('June 2026')
  })
})
