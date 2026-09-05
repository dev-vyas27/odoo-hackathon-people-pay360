import { describe, expect, it } from 'vitest'
import {
  assertEditable,
  createPayrun,
  markComputed,
  markPaid,
  markValidated,
  type Payrun,
} from './payrun'
import { canTransition, isFinalised, PAYRUN_STATUSES, type PayrunStatus } from './payrun-state'
import { JANUARY } from './test-fixtures'

function payrun(status: PayrunStatus = 'draft'): Payrun {
  return createPayrun({
    id: 'run-1',
    name: 'January 2026',
    structureId: 'structure-1',
    structureName: 'Standard Monthly',
    period: JANUARY,
    employeeIds: ['emp-1', 'emp-2'],
    status,
  })
}

describe('createPayrun', () => {
  it('starts in draft with the selected employees only', () => {
    const run = payrun()

    expect(run.status).toBe('draft')
    expect(run.employeeIds).toEqual(['emp-1', 'emp-2'])
  })

  it('deduplicates employee ids', () => {
    const run = createPayrun({
      id: 'run-1',
      name: 'January',
      structureId: 's1',
      structureName: 'Standard',
      period: JANUARY,
      employeeIds: ['emp-1', 'emp-1', 'emp-2'],
    })

    expect(run.employeeIds).toEqual(['emp-1', 'emp-2'])
  })

  it('refuses a payrun with no employees', () => {
    expect(() =>
      createPayrun({
        id: 'run-1',
        name: 'January',
        structureId: 's1',
        structureName: 'Standard',
        period: JANUARY,
        employeeIds: [],
      }),
    ).toThrow(/at least one employee/)
  })

  it('refuses a payrun with no name or no structure', () => {
    const base = {
      id: 'run-1',
      structureId: 's1',
      structureName: 'Standard',
      period: JANUARY,
      employeeIds: ['emp-1'],
    }

    expect(() => createPayrun({ ...base, name: '  ' })).toThrow(/needs a name/)
    expect(() => createPayrun({ ...base, name: 'January', structureId: '' })).toThrow(
      /needs a salary structure/,
    )
  })
})

describe('payrun state transitions', () => {
  it('walks the happy path draft -> computed -> validated -> paid', () => {
    const computed = markComputed(payrun('draft'))
    expect(computed.status).toBe('computed')

    const validated = markValidated(computed)
    expect(validated.status).toBe('validated')

    expect(markPaid(validated).status).toBe('paid')
  })

  it('throws when marking a draft payrun paid', () => {
    expect(() => markPaid(payrun('draft'))).toThrow(/cannot become paid/)
  })

  it('throws when validating a draft payrun', () => {
    expect(() => markValidated(payrun('draft'))).toThrow(/cannot become validated/)
  })

  it('throws when recomputing a validated or paid payrun', () => {
    expect(() => markComputed(payrun('validated'))).toThrow(/cannot become computed/)
    expect(() => markComputed(payrun('paid'))).toThrow(/cannot become computed/)
  })

  it('allows recomputing a computed payrun', () => {
    expect(markComputed(payrun('computed')).status).toBe('computed')
  })

  it('leaves a paid payrun with nowhere to go', () => {
    for (const target of PAYRUN_STATUSES) {
      expect(canTransition('paid', target)).toBe(false)
    }
  })

  it('does not mutate the payrun it transitions', () => {
    const draft = payrun('draft')
    markComputed(draft)

    expect(draft.status).toBe('draft')
  })
})

describe('assertEditable', () => {
  it('permits draft and computed runs', () => {
    expect(() => assertEditable(payrun('draft'))).not.toThrow()
    expect(() => assertEditable(payrun('computed'))).not.toThrow()
  })

  it('preserves validated and paid runs as read-only history', () => {
    expect(() => assertEditable(payrun('validated'))).toThrow(/kept as history/)
    expect(() => assertEditable(payrun('paid'))).toThrow(/kept as history/)
    expect(isFinalised('validated')).toBe(true)
    expect(isFinalised('computed')).toBe(false)
  })
})
