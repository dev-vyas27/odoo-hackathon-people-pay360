/**
 * A percentage OF an earlier rule, addressed by that rule's code.
 *
 * "HRA is 40% of BASIC" and "PF is 12% of BASIC" are the two rules every Indian
 * payslip has, and both are this strategy. The base is read through the context,
 * so if the referenced rule has not run yet the context throws rather than
 * quietly treating it as zero.
 */
import type { Money } from '@/modules/shared'
import type {
  ComputationStrategy,
  PercentageConfig,
  RuleComputationContext,
} from './computation.strategy'

export class PercentageStrategy implements ComputationStrategy<PercentageConfig> {
  readonly type = 'percentage' as const

  compute(config: PercentageConfig, ctx: RuleComputationContext): Money {
    return ctx.get(config.ofCode).percentage(config.percent)
  }
}
