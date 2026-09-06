import { describe, expect, it } from 'vitest'
import { createSalaryRule, dependenciesOf } from './salary-rule'

const base = {
  id: 'r1',
  name: 'Basic',
  code: 'BASIC',
  category: 'basic',
  sequence: 10,
  computation: { type: 'fixed', amount: 50000 } as const,
}

describe('createSalaryRule', () => {
  it('normalises the code to uppercase and trims text', () => {
    const rule = createSalaryRule({ ...base, code: ' hra ', name: '  House Rent  ' })

    expect(rule.code).toBe('HRA')
    expect(rule.name).toBe('House Rent')
    expect(rule.active).toBe(true)
  })

  it('rejects a code that is not a valid identifier', () => {
    expect(() => createSalaryRule({ ...base, code: '1BASIC' })).toThrow(/not a valid rule code/)
    expect(() => createSalaryRule({ ...base, code: 'BA SIC' })).toThrow(/not a valid rule code/)
    expect(() => createSalaryRule({ ...base, code: 'BASIC-1' })).toThrow(/not a valid rule code/)
  })

  it('refuses to let a rule claim a reserved engine code', () => {
    
    
    for (const reserved of ['WAGE', 'WORKED_RATIO', 'WORKED_DAYS']) {
      expect(() => createSalaryRule({ ...base, code: reserved })).toThrow(/reserved by the engine/)
    }
  })

  it('rejects a percentage outside 0-100, matching the column CHECK', () => {
    expect(() =>
      createSalaryRule({
        ...base,
        code: 'PF',
        computation: { type: 'percentage', percent: 120, ofCode: 'BASIC' },
      }),
    ).toThrow(/between 0 and 100/)
  })

  it('rejects an unknown category', () => {
    expect(() => createSalaryRule({ ...base, category: 'bonus' })).toThrow(/not a salary category/)
  })

  it('rejects a negative or fractional sequence', () => {
    expect(() => createSalaryRule({ ...base, sequence: -1 })).toThrow(/whole number/)
    expect(() => createSalaryRule({ ...base, sequence: 1.5 })).toThrow(/whole number/)
  })

  it('rejects a negative fixed amount', () => {
    expect(() =>
      createSalaryRule({ ...base, computation: { type: 'fixed', amount: -1 } }),
    ).toThrow(/zero or more/)
  })

  it('rejects a percentage rule with no base rule code', () => {
    expect(() =>
      createSalaryRule({ ...base, computation: { type: 'percentage', percent: 10, ofCode: '' } }),
    ).toThrow(/must name the rule code/)
  })

  it('rejects a rule that is a percentage of itself', () => {
    expect(() =>
      createSalaryRule({
        ...base,
        code: 'PF',
        computation: { type: 'percentage', percent: 12, ofCode: 'PF' },
      }),
    ).toThrow(/cannot be a percentage of itself/)
  })

  it('rejects a formula that references the rule itself', () => {
    expect(() =>
      createSalaryRule({
        ...base,
        code: 'NET',
        computation: { type: 'formula', expression: 'NET + 1' },
      }),
    ).toThrow(/cannot reference itself/)
  })

  it('rejects a malformed formula at save time, not at payrun time', () => {
    expect(() =>
      createSalaryRule({ ...base, computation: { type: 'formula', expression: 'BASIC +' } }),
    ).toThrow(/ends unexpectedly/)
  })
})

describe('dependenciesOf', () => {
  it('reports no dependencies for a fixed amount', () => {
    expect(dependenciesOf(createSalaryRule(base))).toEqual([])
  })

  it('reports the base rule of a percentage', () => {
    const rule = createSalaryRule({
      ...base,
      code: 'PF',
      computation: { type: 'percentage', percent: 12, ofCode: 'basic' },
    })

    expect(dependenciesOf(rule)).toEqual(['BASIC'])
  })

  it('reports every code a formula reads', () => {
    const rule = createSalaryRule({
      ...base,
      code: 'NET',
      computation: { type: 'formula', expression: 'GROSS - PF - TAX' },
    })

    expect(dependenciesOf(rule).sort()).toEqual(['GROSS', 'PF', 'TAX'])
  })
})
