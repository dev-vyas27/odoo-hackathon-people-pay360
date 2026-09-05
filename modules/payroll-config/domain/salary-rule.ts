/**
 * SalaryRule — one line of a payslip, and how its amount is derived.
 *
 * A rule is reusable across structures: "PF at 12% of BASIC" is written once and
 * included wherever it applies. The `code` is the rule's address — other rules
 * reference it in percentages and formulas — so it is uppercase, unique and
 * validated rather than free text. `salary_rules.code` carries the matching
 * UNIQUE constraint.
 */
import { DomainError } from '@/modules/shared'
import type { SalaryCategory } from './salary-category'
import { isSalaryCategory } from './salary-category'
import type { ComputationConfig } from './computation/computation.strategy'
import { isReservedCode, RESERVED_CODES } from './computation/computation.strategy'
import { parseFormula, referencedCodes } from './computation/formula.parser'

/** Uppercase, starts with a letter: BASIC, HRA, PF, SPECIAL_ALLOWANCE. */
export const RULE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

export interface SalaryRule {
  readonly id: string
  readonly name: string
  readonly code: string
  readonly category: SalaryCategory
  /** Default execution order; a structure may override it per structure. */
  readonly sequence: number
  readonly computation: ComputationConfig
  readonly active: boolean
}

export interface SalaryRuleInput {
  id: string
  name: string
  code: string
  category: string
  sequence: number
  computation: ComputationConfig
  active?: boolean
}

/**
 * The single place a SalaryRule becomes valid.
 *
 * Both the API and the repository build rules through here, so a rule that
 * exists is a rule whose invariants hold — no "mostly validated" objects
 * floating around the application layer.
 */
export function createSalaryRule(input: SalaryRuleInput): SalaryRule {
  const name = input.name.trim()
  if (!name) {
    throw DomainError.validation('RULE_NAME_REQUIRED', 'A salary rule needs a name.')
  }

  const code = input.code.trim().toUpperCase()
  if (!RULE_CODE_PATTERN.test(code)) {
    throw DomainError.validation(
      'RULE_CODE_INVALID',
      `"${input.code}" is not a valid rule code. Use uppercase letters, digits and underscores, starting with a letter — for example BASIC or HRA.`,
      { code: input.code },
    )
  }

  if (isReservedCode(code)) {
    throw DomainError.validation(
      'RULE_CODE_RESERVED',
      `"${code}" is reserved by the engine (${RESERVED_CODES.join(', ')}) and cannot be used as a rule code.`,
      { code },
    )
  }

  if (!isSalaryCategory(input.category)) {
    throw DomainError.validation(
      'RULE_CATEGORY_INVALID',
      `"${input.category}" is not a salary category.`,
      { category: input.category },
    )
  }

  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw DomainError.validation(
      'RULE_SEQUENCE_INVALID',
      'Sequence must be a whole number of 0 or more.',
      { sequence: input.sequence },
    )
  }

  validateComputation(code, input.computation)

  return {
    id: input.id,
    name,
    code,
    category: input.category,
    sequence: input.sequence,
    computation: input.computation,
    active: input.active ?? true,
  }
}

/**
 * Structural validation of the computation config.
 *
 * Catches at save time what would otherwise surface halfway through a payrun:
 * a malformed formula, a percentage of nothing, a rule referencing itself.
 * Mirrors the `salary_rules_parameters_present` CHECK, so the database never
 * has to be the one to say no.
 */
export function validateComputation(code: string, computation: ComputationConfig): void {
  switch (computation.type) {
    case 'fixed': {
      if (!Number.isFinite(computation.amount) || computation.amount < 0) {
        throw DomainError.validation(
          'RULE_AMOUNT_INVALID',
          'A fixed amount must be zero or more.',
          { amount: computation.amount },
        )
      }
      return
    }

    case 'percentage': {
      if (!Number.isFinite(computation.percent)) {
        throw DomainError.validation('RULE_PERCENT_INVALID', 'Enter a percentage.', {
          percent: computation.percent,
        })
      }
      // Matches salary_rules_percentage_range.
      if (computation.percent < 0 || computation.percent > 100) {
        throw DomainError.validation(
          'RULE_PERCENT_RANGE',
          'A percentage must be between 0 and 100.',
          { percent: computation.percent },
        )
      }
      const base = computation.ofCode.trim().toUpperCase()
      if (!RULE_CODE_PATTERN.test(base)) {
        throw DomainError.validation(
          'RULE_PERCENT_BASE_INVALID',
          'A percentage rule must name the rule code it is a percentage of.',
          { ofCode: computation.ofCode },
        )
      }
      if (base === code) {
        throw DomainError.validation(
          'RULE_SELF_REFERENCE',
          `"${code}" cannot be a percentage of itself.`,
          { code },
        )
      }
      return
    }

    case 'formula': {
      // Throws a precise, user-facing DomainError when the syntax is wrong.
      const ast = parseFormula(computation.expression)
      if (referencedCodes(ast).includes(code)) {
        throw DomainError.validation(
          'RULE_SELF_REFERENCE',
          `"${code}" cannot reference itself in its own formula.`,
          { code },
        )
      }
      return
    }
  }
}

/**
 * Every rule code this rule depends on. Drives sequence validation.
 *
 * Reserved codes are excluded: they are engine inputs available from the start,
 * not rules that have to run first.
 */
export function dependenciesOf(rule: SalaryRule): string[] {
  switch (rule.computation.type) {
    case 'fixed':
      return []
    case 'percentage':
      return [rule.computation.ofCode.trim().toUpperCase()].filter((c) => !isReservedCode(c))
    case 'formula':
      return referencedCodes(parseFormula(rule.computation.expression)).filter(
        (c) => !isReservedCode(c),
      )
  }
}
