import { describe, expect, it } from 'vitest'
import { evaluateFormula, parseFormula, referencedCodes } from './formula.parser'

/** Evaluate against a fixed set of rule values, the way the engine would. */
function evaluate(expression: string, values: Record<string, number> = {}): number {
  return evaluateFormula(parseFormula(expression), (code) => {
    const value = values[code]
    if (value === undefined) throw new Error(`unexpected code ${code}`)
    return value
  })
}

describe('parseFormula / evaluateFormula', () => {
  it('adds and subtracts rule results', () => {
    expect(evaluate('GROSS - PF - TAX', { GROSS: 71600, PF: 6000, TAX: 4160 })).toBe(61440)
  })

  it('respects operator precedence', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14)
    expect(evaluate('(2 + 3) * 4')).toBe(20)
  })

  it('handles unary minus', () => {
    expect(evaluate('-BASIC + 100', { BASIC: 40 })).toBe(60)
    expect(evaluate('10 - -5')).toBe(15)
  })

  it('supports min and max for slab-style rules', () => {
    expect(evaluate('max(GROSS - 30000, 0)', { GROSS: 71600 })).toBe(41600)
    expect(evaluate('max(GROSS - 30000, 0)', { GROSS: 20000 })).toBe(0)
    expect(evaluate('min(BASIC * 0.12, 1800)', { BASIC: 50000 })).toBe(1800)
    expect(evaluate('min(BASIC * 0.12, 1800)', { BASIC: 10000 })).toBe(1200)
  })

  it('treats rule codes case-insensitively but normalises them to uppercase', () => {
    expect(referencedCodes(parseFormula('basic + Hra'))).toEqual(['BASIC', 'HRA'])
  })

  it('reads decimal multipliers', () => {
    expect(evaluate('BASIC * 0.4', { BASIC: 50000 })).toBe(20000)
  })

  it('collects every referenced code, deduplicated', () => {
    expect(referencedCodes(parseFormula('BASIC + BASIC + HRA')).sort()).toEqual(['BASIC', 'HRA'])
  })

  it('reports no dependencies for a pure arithmetic formula', () => {
    expect(referencedCodes(parseFormula('1 + 2'))).toEqual([])
  })
})

describe('formula safety', () => {
  it('rejects characters outside the whitelist', () => {
    // The shapes an injection attempt takes, all refused at the tokenizer.
    expect(() => parseFormula('process.exit(1)')).toThrow(/not allowed in a formula/)
    expect(() => parseFormula('BASIC; DROP')).toThrow(/not allowed in a formula/)
    expect(() => parseFormula('`${x}`')).toThrow(/not allowed in a formula/)
    expect(() => parseFormula('BASIC > 10 ? 1 : 0')).toThrow(/not allowed in a formula/)
  })

  it('rejects an unbalanced bracket', () => {
    expect(() => parseFormula('(BASIC + HRA')).toThrow(/never closed/)
  })

  it('rejects trailing input after a complete expression', () => {
    expect(() => parseFormula('BASIC HRA')).toThrow(/leftover text/)
  })

  it('rejects an empty expression', () => {
    expect(() => parseFormula('   ')).toThrow(/needs an expression/)
  })

  it('rejects a dangling operator', () => {
    expect(() => parseFormula('BASIC +')).toThrow(/ends unexpectedly/)
  })

  it('rejects min/max with a single argument', () => {
    expect(() => parseFormula('max(BASIC)')).toThrow(/at least two arguments/)
  })

  it('refuses to divide by zero', () => {
    expect(() => evaluate('BASIC / 0', { BASIC: 100 })).toThrow(/divides by zero/)
  })

  it('does not expose any host global to the expression', () => {
    // An identifier is only ever a rule code; there is no global scope to reach.
    expect(() => evaluate('globalThis', {})).toThrow(/unexpected code GLOBALTHIS/)
  })
})
