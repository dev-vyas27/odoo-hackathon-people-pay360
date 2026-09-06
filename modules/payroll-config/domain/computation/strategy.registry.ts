/**
 * computation type -> strategy.
 *
 * The engine looks a rule's strategy up here and calls it. Supporting a new kind
 * of computation is therefore one new class plus one line in this map, with no
 * edit to the engine, the aggregates or the persistence layer. Strategy +
 * Registry is what makes the rule engine open for extension and closed for
 * modification.
 */
import { DomainError } from '@/modules/shared'
import type {
  ComputationConfig,
  ComputationStrategy,
  ComputationType,
  RuleComputationContext,
} from './computation.strategy'
import { FixedAmountStrategy } from './fixed-amount.strategy'
import { PercentageStrategy } from './percentage.strategy'
import { FormulaStrategy } from './formula.strategy'

const STRATEGIES: Record<ComputationType, ComputationStrategy> = {
  fixed: new FixedAmountStrategy() as ComputationStrategy,
  percentage: new PercentageStrategy() as ComputationStrategy,
  formula: new FormulaStrategy() as ComputationStrategy,
}

export function getStrategy(type: ComputationType): ComputationStrategy {
  const strategy = STRATEGIES[type]
  if (!strategy) {
    throw DomainError.rule(
      'UNKNOWN_COMPUTATION_TYPE',
      `No computation strategy is registered for "${type}".`,
      { type },
    )
  }
  return strategy
}

/** Convenience for the engine: look the strategy up and run it. */
export function computeWith(config: ComputationConfig, ctx: RuleComputationContext) {
  return getStrategy(config.type).compute(config, ctx)
}
