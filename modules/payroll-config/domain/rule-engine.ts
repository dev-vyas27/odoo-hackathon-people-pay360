/**
 * The rule engine: run a structure's rules in sequence and accumulate results.
 *
 * Three properties make this correct rather than merely working:
 *
 *  1. Rules execute in `sequence` order and each may reference the results of
 *     rules that ran BEFORE it, by code. Referencing a code that has not run yet
 *     raises — it is never silently zero, because a payslip that is wrong but
 *     looks right is the worst outcome available.
 *  2. Every amount is `Money` (integer minor units) from beginning to end, so no
 *     paise is invented or lost between BASIC and NET.
 *  3. The contract wage and the worked-days ratio arrive as reserved INPUTS
 *     rather than as rules, so a structure reads the contract that applies to
 *     the period without the engine ever knowing what a contract is.
 *
 * The engine knows nothing about employees, contracts, databases or HTTP. Give
 * it rules, a wage and a proration ratio and it returns lines — which is why it
 * is tested exhaustively in milliseconds.
 */
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
  /** The wage from the contract that applies to the payroll period. */
  readonly contractWage: Money
  /** workedDays / expectedDays. 1 means a full period with no proration. */
  readonly prorationRatio?: number
  /** Days actually worked, exposed to rules as WORKED_DAYS. */
  readonly workedDays?: number
}

export function runRuleEngine(input: RuleEngineInput): ComputedLine[] {
  const ratio = normalizeRatio(input.prorationRatio ?? 1)
  const ordered = [...input.rules].sort((a, b) => a.sequence - b.sequence)

  // WAGE is an amount available from the start: a reserved input, not a
  // computed line, so it is seeded here and never emitted.
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

      // A clearer message than "not computed yet" for the one mistake this
      // makes easy: using a ratio where an amount is expected.
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

/** Sum every line in a category. Allowances usually have several; NET has one. */
export function totalForCategory(lines: readonly ComputedLine[], category: SalaryCategory): Money {
  return Money.sum(lines.filter((l) => l.category === category).map((l) => l.amount))
}

/**
 * Guard the proration ratio.
 *
 * Attendance data is real-world data: a missing check-out or a correction can
 * produce more worked time than the schedule expects. Paying 103% of a wage
 * because of a data-entry artefact is not a payroll behaviour anyone wants, so
 * the ratio is clamped to [0, 1] and overtime is handled by an explicit rule
 * instead.
 */
function normalizeRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    throw DomainError.validation(
      'PRORATION_RATIO_INVALID',
      `Proration ratio is not a finite number: ${ratio}`,
    )
  }
  return Math.min(1, Math.max(0, ratio))
}
