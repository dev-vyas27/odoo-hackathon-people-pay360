


import { Money } from '@/modules/shared'
import type { ComputationStrategy, FixedAmountConfig } from './computation.strategy'

export class FixedAmountStrategy implements ComputationStrategy<FixedAmountConfig> {
  readonly type = 'fixed' as const

  compute(config: FixedAmountConfig): Money {
    return Money.of(config.amount)
  }
}
