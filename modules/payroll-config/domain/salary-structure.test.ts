import { describe, expect, it } from 'vitest'
import { createSalaryRule, type SalaryRule } from './salary-rule'
import type { ComputationConfig } from './computation/computation.strategy'
import {
  createSalaryStructure,
  inspectStructure,
  resolveStructure,
  type ResolvedSalaryStructure,
} from './salary-structure'

function makeRule(
  code: string,
  category: SalaryRule['category'],
  sequence: number,
  computation: ComputationConfig,
): SalaryRule {
  return createSalaryRule({
    id: `rule-${code}`,
    name: code,
    code,
    category,
    sequence,
    computation,
  })
}

function resolved(rules: Array<{ rule: SalaryRule; sequence: number }>): ResolvedSalaryStructure {
  return { id: 's1', name: 'Standard', active: true, rules }
}

describe('createSalaryStructure', () => {
  it('orders included rules by sequence', () => {
    const structure = createSalaryStructure({
      id: 's1',
      name: 'Standard',
      code: 'STD',
      rules: [
        { ruleId: 'net', sequence: 70 },
        { ruleId: 'basic', sequence: 10 },
      ],
    })

    expect(structure.rules.map((r) => r.ruleId)).toEqual(['basic', 'net'])
  })

  it('rejects the same rule included twice', () => {
    expect(() =>
      createSalaryStructure({
        id: 's1',
        name: 'Standard',
      code: 'STD',
        rules: [
          { ruleId: 'basic', sequence: 10 },
          { ruleId: 'basic', sequence: 20 },
        ],
      }),
    ).toThrow(/included twice/)
  })

  it('requires a name', () => {
    expect(() => createSalaryStructure({ id: 's1', name: '   ', code: 'STD', rules: [] })).toThrow(
      /needs a name/,
    )
  })
})

describe('resolveStructure', () => {
  it('joins references to rules in sequence order', () => {
    const basic = makeRule('BASIC', 'basic', 10, { type: 'fixed', amount: 1 })
    const net = makeRule('NET', 'net', 20, { type: 'formula', expression: 'BASIC' })
    const structure = createSalaryStructure({
      id: 's1',
      name: 'Standard',
      code: 'STD',
      rules: [
        { ruleId: net.id, sequence: 20 },
        { ruleId: basic.id, sequence: 10 },
      ],
    })

    const result = resolveStructure(
      structure,
      new Map([
        [basic.id, basic],
        [net.id, net],
      ]),
    )

    expect(result.rules.map((r) => r.rule.code)).toEqual(['BASIC', 'NET'])
  })

  it('raises when a referenced rule has been deleted, rather than silently dropping a payslip line', () => {
    const structure = createSalaryStructure({
      id: 's1',
      name: 'Standard',
      code: 'STD',
      rules: [{ ruleId: 'gone', sequence: 10 }],
    })

    expect(() => resolveStructure(structure, new Map())).toThrow(/no longer exists/)
  })
})

describe('inspectStructure', () => {
  it('finds nothing wrong with a correctly ordered structure', () => {
    const issues = inspectStructure(
      resolved([
        { rule: makeRule('BASIC', 'basic', 10, { type: 'fixed', amount: 100 }), sequence: 10 },
        { rule: makeRule('HRA', 'allowance', 20, { type: 'percentage', percent: 40, ofCode: 'BASIC' }), sequence: 20 },
        { rule: makeRule('NET', 'net', 30, { type: 'formula', expression: 'BASIC + HRA' }), sequence: 30 },
      ]),
    )

    expect(issues).toEqual([])
  })

  it('flags a dependency that runs later in the sequence', () => {
    const issues = inspectStructure(
      resolved([
        { rule: makeRule('NET', 'net', 10, { type: 'formula', expression: 'GROSS' }), sequence: 10 },
        { rule: makeRule('GROSS', 'gross', 20, { type: 'fixed', amount: 5 }), sequence: 20 },
      ]),
    )

    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('DEPENDENCY_RUNS_LATER')
    expect(issues[0].message).toMatch(/runs later/)
  })

  it('flags a dependency that is not part of the structure at all', () => {
    const issues = inspectStructure(
      resolved([
        { rule: makeRule('NET', 'net', 10, { type: 'percentage', percent: 10, ofCode: 'ABSENT' }), sequence: 10 },
      ]),
    )

    expect(issues[0].code).toBe('MISSING_DEPENDENCY')
  })

  it('flags two rules sharing a code', () => {
    const duplicate = makeRule('BASIC', 'basic', 20, { type: 'fixed', amount: 2 })
    const issues = inspectStructure(
      resolved([
        { rule: makeRule('BASIC', 'basic', 10, { type: 'fixed', amount: 1 }), sequence: 10 },
        { rule: { ...duplicate, id: 'other' }, sequence: 20 },
      ]),
    )

    expect(issues[0].code).toBe('DUPLICATE_RULE_CODE')
  })
})
