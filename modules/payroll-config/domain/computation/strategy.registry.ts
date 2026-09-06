


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


export function computeWith(config: ComputationConfig, ctx: RuleComputationContext) {
  return getStrategy(config.type).compute(config, ctx)
}
