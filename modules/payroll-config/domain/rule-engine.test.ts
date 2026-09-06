import { describe, expect, it } from 'vitest'
import { Money } from '@/modules/shared'
import { createSalaryRule, type SalaryRule } from './salary-rule'
import { runRuleEngine, totalForCategory } from './rule-engine'
import type { ComputationConfig } from './computation/computation.strategy'


function rule(
  code: string,
  category: SalaryRule['category'],
  sequence: number,
  computation: ComputationConfig,
): { rule: SalaryRule; sequence: number } {
  return {
    rule: createSalaryRule({
      id: `rule-${code}`,
      name: code,
      code,
      category,
      sequence,
      computation,
    }),
    sequence,
  }
}



function standardStructure() {
  return [
    rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE * WORKED_RATIO' }),
    rule('HRA', 'allowance', 20, { type: 'percentage', percent: 40, ofCode: 'BASIC' }),
    rule('TA', 'allowance', 30, { type: 'fixed', amount: 1600 }),
    rule('GROSS', 'gross', 40, { type: 'formula', expression: 'BASIC + HRA + TA' }),
    rule('PF', 'deduction', 50, { type: 'percentage', percent: 12, ofCode: 'BASIC' }),
    rule('TAX', 'deduction', 60, { type: 'formula', expression: 'max(GROSS - 30000, 0) * 0.1' }),
    rule('NET', 'net', 70, { type: 'formula', expression: 'GROSS - PF - TAX' }),
  ]
}

describe('runRuleEngine', () => {
  it('computes a full structure end to end', () => {
    const lines = runRuleEngine({ rules: standardStructure(), contractWage: Money.of(50000) })

    const byCode = Object.fromEntries(lines.map((l) => [l.code, l.amount.toNumber()]))

    expect(byCode.BASIC).toBe(50000)
    expect(byCode.HRA).toBe(20000) 
    expect(byCode.TA).toBe(1600)
    expect(byCode.GROSS).toBe(71600)
    expect(byCode.PF).toBe(6000) 
    expect(byCode.TAX).toBe(4160) 
    expect(byCode.NET).toBe(61440) 
  })

  it('returns lines in sequence order with their codes, so a payslip is readable', () => {
    const lines = runRuleEngine({ rules: standardStructure(), contractWage: Money.of(50000) })

    expect(lines.map((l) => l.code)).toEqual(['BASIC', 'HRA', 'TA', 'GROSS', 'PF', 'TAX', 'NET'])
    expect(lines.map((l) => l.sequence)).toEqual([10, 20, 30, 40, 50, 60, 70])
  })

  it('executes in sequence order even when the rules arrive shuffled', () => {
    const shuffled = [...standardStructure()].reverse()
    const lines = runRuleEngine({ rules: shuffled, contractWage: Money.of(50000) })

    expect(lines.map((l) => l.code)).toEqual(['BASIC', 'HRA', 'TA', 'GROSS', 'PF', 'TAX', 'NET'])
    expect(lines.at(-1)?.amount.toNumber()).toBe(61440)
  })

  it('computes a percentage of an earlier rule, not of the raw wage', () => {
    const rules = [
      rule('BASIC', 'basic', 10, { type: 'fixed', amount: 30000 }),
      rule('HRA', 'allowance', 20, { type: 'percentage', percent: 50, ofCode: 'BASIC' }),
    ]
    const lines = runRuleEngine({ rules, contractWage: Money.of(99999) })

    expect(lines[1].amount.toNumber()).toBe(15000)
  })

  it('raises when a rule references a code that has not run yet', () => {
    const rules = [
      
      rule('NET', 'net', 10, { type: 'formula', expression: 'GROSS - 100' }),
      rule('GROSS', 'gross', 20, { type: 'fixed', amount: 5000 }),
    ]

    expect(() => runRuleEngine({ rules, contractWage: Money.of(5000) })).toThrow(
      /has not been computed yet/,
    )
  })

  it('raises rather than treating an unknown code as zero', () => {
    const rules = [rule('NET', 'net', 10, { type: 'formula', expression: 'MYSTERY + 1' })]

    expect(() => runRuleEngine({ rules, contractWage: Money.of(1000) })).toThrow(
      /RULE_SEQUENCE_VIOLATION|has not been computed yet/,
    )
  })

  it('rejects two rules sharing a code', () => {
    const rules = [
      rule('BASIC', 'basic', 10, { type: 'fixed', amount: 1000 }),
      rule('BASIC', 'basic', 20, { type: 'fixed', amount: 2000 }),
    ]

    expect(() => runRuleEngine({ rules, contractWage: Money.of(1000) })).toThrow(
      /share the code "BASIC"/,
    )
  })

  it('prorates the rules that ask for it and leaves flat allowances alone', () => {
    const rules = [
      rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE * WORKED_RATIO' }),
      rule('TA', 'allowance', 20, { type: 'fixed', amount: 1600 }),
    ]

    
    const lines = runRuleEngine({
      rules,
      contractWage: Money.of(50000),
      prorationRatio: 22 / 30,
    })

    expect(lines[0].amount.toNumber()).toBe(36666.67)
    expect(lines[1].amount.toNumber()).toBe(1600)
  })

  it('keeps the proration ratio at full precision rather than rounding it to paise', () => {
    
    const rules = [rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE * WORKED_RATIO' })]

    const lines = runRuleEngine({
      rules,
      contractWage: Money.of(50000),
      prorationRatio: 22 / 30,
    })

    expect(lines[0].amount.toNumber()).toBe(36666.67)
    expect(lines[0].amount.toNumber()).not.toBe(36500)
  })

  it('clamps a proration ratio above 1 so an attendance artefact cannot overpay', () => {
    const rules = [rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE * WORKED_RATIO' })]

    const lines = runRuleEngine({ rules, contractWage: Money.of(50000), prorationRatio: 1.4 })

    expect(lines[0].amount.toNumber()).toBe(50000)
  })

  it('produces a zero basic when no days were worked', () => {
    const rules = [rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE * WORKED_RATIO' })]

    const lines = runRuleEngine({ rules, contractWage: Money.of(50000), prorationRatio: 0 })

    expect(lines[0].amount.isZero()).toBe(true)
  })

  it('keeps paise exact where a float would drift', () => {
    
    const rules = [
      rule('BASE', 'basic', 10, { type: 'fixed', amount: 1000.1 }),
      rule('CUT', 'deduction', 20, { type: 'percentage', percent: 33.33, ofCode: 'BASE' }),
    ]

    const lines = runRuleEngine({ rules, contractWage: Money.of(1000.1) })

    expect(lines[1].amount.minor).toBe(33333)
    expect(lines[1].amount.toNumber()).toBe(333.33)
  })

  it('reads the wage of the contract it was given', () => {
    const rules = [rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE' })]

    expect(runRuleEngine({ rules, contractWage: Money.of(42000) })[0].amount.toNumber()).toBe(42000)
    expect(runRuleEngine({ rules, contractWage: Money.of(88000) })[0].amount.toNumber()).toBe(88000)
  })

  it('exposes the wage to a percentage rule as the reserved code WAGE', () => {
    const rules = [rule('BASIC', 'basic', 10, { type: 'percentage', percent: 50, ofCode: 'WAGE' })]

    expect(runRuleEngine({ rules, contractWage: Money.of(60000) })[0].amount.toNumber()).toBe(30000)
  })

  it('exposes worked days to formulas', () => {
    const rules = [
      rule('ATTENDANCE_BONUS', 'allowance', 10, { type: 'formula', expression: 'WORKED_DAYS * 100' }),
    ]

    const lines = runRuleEngine({
      rules,
      contractWage: Money.of(1000),
      workedDays: 21,
    })

    expect(lines[0].amount.toNumber()).toBe(2100)
  })

  it('does not emit the reserved inputs as payslip lines of their own', () => {
    const lines = runRuleEngine({
      rules: [rule('BASIC', 'basic', 10, { type: 'formula', expression: 'WAGE' })],
      contractWage: Money.of(1000),
    })

    expect(lines.map((l) => l.code)).toEqual(['BASIC'])
  })

  it('explains that a ratio is not an amount when used as a percentage base', () => {
    const rules = [
      rule('ODD', 'allowance', 10, { type: 'percentage', percent: 10, ofCode: 'WORKED_RATIO' }),
    ]

    expect(() => runRuleEngine({ rules, contractWage: Money.of(1000) })).toThrow(
      /is a plain number, not an amount/,
    )
  })

  it('skips inactive rules without breaking the sequence', () => {
    const rules = [
      rule('BASIC', 'basic', 10, { type: 'fixed', amount: 10000 }),
      {
        rule: {
          ...rule('BONUS', 'allowance', 20, { type: 'fixed', amount: 5000 }).rule,
          active: false,
        },
        sequence: 20,
      },
      rule('NET', 'net', 30, { type: 'formula', expression: 'BASIC' }),
    ]

    const lines = runRuleEngine({ rules, contractWage: Money.of(10000) })

    expect(lines.map((l) => l.code)).toEqual(['BASIC', 'NET'])
    expect(lines[1].amount.toNumber()).toBe(10000)
  })
})

describe('totalForCategory', () => {
  it('sums every allowance line and isolates deductions from net', () => {
    const lines = runRuleEngine({ rules: standardStructure(), contractWage: Money.of(50000) })

    expect(totalForCategory(lines, 'allowance').toNumber()).toBe(21600) 
    expect(totalForCategory(lines, 'deduction').toNumber()).toBe(10160) 
    expect(totalForCategory(lines, 'net').toNumber()).toBe(61440)
  })

  it('returns zero for a category the structure does not use', () => {
    const lines = runRuleEngine({
      rules: [rule('BASIC', 'basic', 10, { type: 'fixed', amount: 100 })],
      contractWage: Money.of(100),
    })

    expect(totalForCategory(lines, 'deduction').isZero()).toBe(true)
  })
})
