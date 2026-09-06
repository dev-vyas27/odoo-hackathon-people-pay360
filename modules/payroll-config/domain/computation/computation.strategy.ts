


import type { Money } from '@/modules/shared'


export interface FixedAmountConfig {
  readonly type: 'fixed'
  readonly amount: number
}



export interface PercentageConfig {
  readonly type: 'percentage'
  readonly percent: number
  readonly ofCode: string
}


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



export const WAGE_CODE = 'WAGE'


export const WORKED_RATIO_CODE = 'WORKED_RATIO'


export const WORKED_DAYS_CODE = 'WORKED_DAYS'


export const RESERVED_CODES = [WAGE_CODE, WORKED_RATIO_CODE, WORKED_DAYS_CODE] as const



export const SCALAR_CODES = [WORKED_RATIO_CODE, WORKED_DAYS_CODE] as const

export function isScalarCode(code: string): boolean {
  return (SCALAR_CODES as readonly string[]).includes(code)
}

export function isReservedCode(code: string): boolean {
  return (RESERVED_CODES as readonly string[]).includes(code)
}



export interface RuleComputationContext {
  readonly contractWage: Money
  
  readonly prorationRatio: number

  


  get(code: string): Money

  
  scalar(code: string): number | null
}

export interface ComputationStrategy<TConfig extends ComputationConfig = ComputationConfig> {
  readonly type: TConfig['type']
  compute(config: TConfig, ctx: RuleComputationContext): Money
}
