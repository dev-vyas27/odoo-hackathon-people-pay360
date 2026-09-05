import { describe, expect, it } from 'vitest'
import { EMPLOYEE_TYPES, EMPLOYEE_TYPE_LABELS, isEmployeeType } from './employee-type'

describe('EmployeeType', () => {
  it('accepts every declared type', () => {
    for (const t of EMPLOYEE_TYPES) {
      expect(isEmployeeType(t)).toBe(true)
    }
  })

  it('rejects values arriving from a query string', () => {
    // Dashboard filters come in as untrusted strings; the guard is what stops a
    // typo silently becoming an empty result set that looks like real data.
    expect(isEmployeeType('fulltime')).toBe(false)
    expect(isEmployeeType('FULL_TIME')).toBe(false)
    expect(isEmployeeType('')).toBe(false)
  })

  it('labels every type, so no filter renders blank', () => {
    for (const t of EMPLOYEE_TYPES) {
      expect(EMPLOYEE_TYPE_LABELS[t]).toBeTruthy()
    }
  })
})
