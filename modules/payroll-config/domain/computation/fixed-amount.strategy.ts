/**
 * A flat amount — a transport allowance, a fixed stipend.
 *
 * Deliberately NOT prorated: a rule that should shrink with attendance says so
 * explicitly as a formula (`WAGE * WORKED_RATIO`, `1600 * WORKED_RATIO`), which
 * is legible on the rule itself rather than hidden behind a boolean flag.
 */
import { Money } from '@/modules/shared'
import type { ComputationStrategy, FixedAmountConfig } from './computation.strategy'

export class FixedAmountStrategy implements ComputationStrategy<FixedAmountConfig> {
  readonly type = 'fixed' as const

  compute(config: FixedAmountConfig): Money {
    return Money.of(config.amount)
  }
}
