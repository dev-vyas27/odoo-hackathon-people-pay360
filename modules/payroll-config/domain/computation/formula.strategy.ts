/**
 * An arithmetic expression over earlier rule codes — "GROSS - PF - TAX", or
 * "WAGE * WORKED_RATIO" for a prorated basic.
 *
 * The expression is parsed and walked by our own evaluator (formula.parser.ts);
 * `eval` is never involved. Parsing happens per computation, which is cheap at
 * payroll volumes and keeps the strategy stateless.
 */
import { Money } from '@/modules/shared'
import type {
  ComputationStrategy,
  FormulaConfig,
  RuleComputationContext,
} from './computation.strategy'
import { evaluateFormula, parseFormula } from './formula.parser'

export class FormulaStrategy implements ComputationStrategy<FormulaConfig> {
  readonly type = 'formula' as const

  compute(config: FormulaConfig, ctx: RuleComputationContext): Money {
    const ast = parseFormula(config.expression)

    /**
     * Scalars first: WORKED_RATIO is a 0..1 multiplier, not an amount, and
     * reading it through the money path would round 0.7333 to 0.73 and underpay
     * every prorated payslip.
     */
    const value = evaluateFormula(ast, (code) => ctx.scalar(code) ?? ctx.get(code).toNumber())

    // The one rounding point: major units in, Money out, rounded half-up once.
    return Money.of(value)
  }
}
