


import type { SalaryCategory } from '@/modules/shared'
import type { ComputationConfig, ComputationType } from '../domain/computation/computation.strategy'

export const SALARY_RULES_TABLE = 'salary_rules'

export interface SalaryRuleRow {
  id: string
  name: string
  code: string
  category: SalaryCategory
  sequence: number
  computation_type: ComputationType
  
  amount: number | null
  percentage: number | null
  base_rule_code: string | null
  expression: string | null
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const SALARY_RULE_COLUMNS = [
  'id',
  'name',
  'code',
  'category',
  'sequence',
  'computation_type',
  'amount',
  'percentage',
  'base_rule_code',
  'expression',
  'is_active',
  'created_at',
  'updated_at',
] as const



export function toComputation(row: SalaryRuleRow): ComputationConfig {
  switch (row.computation_type) {
    case 'percentage':
      return {
        type: 'percentage',
        percent: row.percentage ?? 0,
        ofCode: row.base_rule_code ?? '',
      }
    case 'formula':
      return { type: 'formula', expression: row.expression ?? '' }
    case 'fixed':
      return { type: 'fixed', amount: row.amount ?? 0 }
  }
}


export function toComputationColumns(computation: ComputationConfig): {
  computation_type: ComputationType
  amount: number | null
  percentage: number | null
  base_rule_code: string | null
  expression: string | null
} {
  switch (computation.type) {
    case 'fixed':
      return {
        computation_type: 'fixed',
        amount: computation.amount,
        percentage: null,
        base_rule_code: null,
        expression: null,
      }
    case 'percentage':
      return {
        computation_type: 'percentage',
        amount: null,
        percentage: computation.percent,
        base_rule_code: computation.ofCode,
        expression: null,
      }
    case 'formula':
      return {
        computation_type: 'formula',
        amount: null,
        percentage: null,
        base_rule_code: null,
        expression: computation.expression,
      }
  }
}

export const SALARY_STRUCTURES_TABLE = 'salary_structures'
export const SALARY_STRUCTURE_RULES_TABLE = 'salary_structure_rules'

export interface SalaryStructureRow {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export const SALARY_STRUCTURE_COLUMNS = [
  'id',
  'name',
  'code',
  'is_active',
  'created_at',
  'updated_at',
] as const


export interface StructureRuleRow {
  salary_structure_id: string
  salary_rule_id: string
  
  sequence_override: number | null
  rule_sequence: number
}
