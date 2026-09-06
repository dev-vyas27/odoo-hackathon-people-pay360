


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
