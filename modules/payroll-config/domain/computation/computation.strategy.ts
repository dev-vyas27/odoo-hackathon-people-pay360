/**
 * The Strategy seam of the rule engine.
 *
 * A salary rule says WHAT it is (name, code, category, sequence) and carries a
 * `ComputationConfig` saying HOW its amount is derived. Each config type has one
 * strategy class. Adding a new way to compute money means adding one class and
 * one registry line — the engine itself never changes.
 *
 * The three types here are exactly the three `salary_rules.computation_type`
 * allows (migration 0003), and the parameters each one carries are exactly what
 * that table's `salary_rules_parameters_present` CHECK requires. The database
 * and this file agree by construction rather than by convention.
 *
 * ── Reserved inputs ────────────────────────────────────────────────────────
 * Two things every payslip needs are NOT rules: the wage of the contract that
 * applies to the period, and how much of the period was actually worked. They
 * are exposed as reserved codes any formula (or percentage base) can read:
 *
 *   BASIC = formula  "WAGE * WORKED_RATIO"     prorated contract wage
 *   HRA   = percentage 40% of BASIC
 *
 * That keeps period-correct contract selection and proration first-class
 * without inventing a fourth computation type the schema would reject — and it
 * makes proration VISIBLE in the rule instead of hidden behind a boolean.
 */
import type { Money } from '@/modules/shared'

/** A flat amount. `salary_rules.amount`. */
export interface FixedAmountConfig {
  readonly type: 'fixed'
  readonly amount: number
}

/**
 * A percentage OF an earlier rule, addressed by that rule's code.
 * `salary_rules.percentage` + `salary_rules.base_rule_code`.
 */
export interface PercentageConfig {
  readonly type: 'percentage'
  readonly percent: number
  readonly ofCode: string
}

/** An arithmetic expression over earlier rule codes. `salary_rules.expression`. */
export interface FormulaConfig {
  readonly type: 'formula'
  readonly expression: string
}

export type ComputationConfig = FixedAmountConfig | PercentageConfig | FormulaConfig

export type ComputationType = ComputationConfig['type']

export const COMPUTATION_TYPES = [
  'fixed',
  'percentage',
  'formula',
] as const satisfies readonly ComputationType[]

export const COMPUTATION_TYPE_LABELS: Record<ComputationType, string> = {
  fixed: 'Fixed amount',
  percentage: 'Percentage of another rule',
  formula: 'Formula',
}

/**
 * The wage of the contract resolved for the payroll period, as an AMOUNT.
 * Usable as a percentage base ("50% of WAGE") or inside a formula.
 */
export const WAGE_CODE = 'WAGE'

/** workedDays / expectedDays for the period, as a plain 0..1 multiplier. */
export const WORKED_RATIO_CODE = 'WORKED_RATIO'

/** Days actually worked, as a plain number. */
export const WORKED_DAYS_CODE = 'WORKED_DAYS'

/** Codes no user rule may claim, because the engine supplies them. */
export const RESERVED_CODES = [WAGE_CODE, WORKED_RATIO_CODE, WORKED_DAYS_CODE] as const

/**
 * Reserved codes that are plain numbers rather than amounts.
 *
 * Kept separate from the money results because rounding them to paise would be
 * wrong: a 22/30 proration ratio is 0.7333…, and storing it as Money would
 * round it to 0.73 and quietly underpay every prorated payslip by ~0.5%.
 */
export const SCALAR_CODES = [WORKED_RATIO_CODE, WORKED_DAYS_CODE] as const

export function isScalarCode(code: string): boolean {
  return (SCALAR_CODES as readonly string[]).includes(code)
}

export function isReservedCode(code: string): boolean {
  return (RESERVED_CODES as readonly string[]).includes(code)
}

/**
 * What a rule can see while it computes.
 *
 * Deliberately narrow: results of rules that have ALREADY run, plus the
 * reserved inputs. No payslip, no employee, no database — which is why the
 * whole engine is testable with literals.
 */
export interface RuleComputationContext {
  readonly contractWage: Money
  /** workedDays / expectedDays. 1 when no proration applies. */
  readonly prorationRatio: number

  /**
   * An amount: an earlier rule's result, or WAGE.
   *
   * Throws when the code has not run yet. Returning zero instead would produce
   * a payslip that looks right and is wrong — the worst possible failure.
   */
  get(code: string): Money

  /** A reserved scalar (WORKED_RATIO, WORKED_DAYS), or null if not one. */
  scalar(code: string): number | null
}

export interface ComputationStrategy<TConfig extends ComputationConfig = ComputationConfig> {
  readonly type: TConfig['type']
  compute(config: TConfig, ctx: RuleComputationContext): Money
}
