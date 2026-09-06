


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

    


    const value = evaluateFormula(ast, (code) => ctx.scalar(code) ?? ctx.get(code).toNumber())

    
    return Money.of(value)
  }
}
