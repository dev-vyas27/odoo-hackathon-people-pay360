


import { DomainError, Money, type SalaryCategory } from '@/modules/shared'
import type { SalaryRule } from './salary-rule'
import type { RuleComputationContext } from './computation/computation.strategy'
import {
  isScalarCode,
  WAGE_CODE,
  WORKED_DAYS_CODE,
  WORKED_RATIO_CODE,
} from './computation/computation.strategy'
import { computeWith } from './computation/strategy.registry'

export interface ComputedLine {
  readonly code: string
  readonly name: string
  readonly category: SalaryCategory
  readonly sequence: number
  readonly amount: Money
}

export interface RuleEngineInput {
  readonly rules: ReadonlyArray<{ rule: SalaryRule; sequence: number }>
  
  readonly contractWage: Money
  
  readonly prorationRatio?: number
  
  readonly workedDays?: number
}

export function runRuleEngine(input: RuleEngineInput): ComputedLine[] {
  const ratio = normalizeRatio(input.prorationRatio ?? 1)
  const ordered = [...input.rules].sort((a, b) => a.sequence - b.sequence)

  
  
  const results = new Map<string, Money>([[WAGE_CODE, input.contractWage]])

  const scalars = new Map<string, number>([
    [WORKED_RATIO_CODE, ratio],
    [WORKED_DAYS_CODE, input.workedDays ?? 0],
  ])

  const lines: ComputedLine[] = []

  const context: RuleComputationContext = {
    contractWage: input.contractWage,
    prorationRatio: ratio,

    get(code: string): Money {
      const key = code.toUpperCase()
      const value = results.get(key)
      if (value) return value

      
      
      if (isScalarCode(key)) {
        throw DomainError.rule(
          'RULE_SCALAR_NOT_AN_AMOUNT',
          `"${key}" is a plain number, not an amount. Use it inside a formula, for example "WAGE * ${key}".`,
          { code: key },
        )
      }

      throw DomainError.rule(
        'RULE_SEQUENCE_VIOLATION',
        `Rule "${code}" has not been computed yet. A rule may only reference rules that run earlier in the sequence.`,
        { code },
      )
    },

    scalar(code: string): number | null {
      return scalars.get(code.toUpperCase()) ?? null
    },
  }

  for (const { rule, sequence } of ordered) {
    if (!rule.active) continue

    if (results.has(rule.code)) {
      throw DomainError.rule(
        'DUPLICATE_RULE_CODE',
        `Two rules in this structure share the code "${rule.code}".`,
        { code: rule.code },
      )
    }

    const amount = computeWith(rule.computation, context)
    results.set(rule.code, amount)
    lines.push({
      code: rule.code,
      name: rule.name,
      category: rule.category,
      sequence,
      amount,
    })
  }

  return lines
}


export function totalForCategory(lines: readonly ComputedLine[], category: SalaryCategory): Money {
  return Money.sum(lines.filter((l) => l.category === category).map((l) => l.amount))
}



function normalizeRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    throw DomainError.validation(
      'PRORATION_RATIO_INVALID',
      `Proration ratio is not a finite number: ${ratio}`,
    )
  }
  return Math.min(1, Math.max(0, ratio))
}
