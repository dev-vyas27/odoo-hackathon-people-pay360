/**
 * The `salary_rules` and `salary_structures` tables as TypeScript sees them.
 *
 * This file is the seam between the schema (migrations/0003_payroll_config.sql)
 * and the domain. Everything below is snake_case because that is what the
 * database calls these; everything above is camelCase.
 *
 * If you change a column here, there is a migration to write. If there is no
 * migration, this file is lying.
 */
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
  /** numeric(14,2) — `pg` is configured in lib/db.ts to parse these as numbers. */
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

/**
 * Row -> the discriminated union the domain works in.
 *
 * The three branches mirror `salary_rules_parameters_present`, so a row that
 * satisfies the CHECK always produces a valid config. The `?? 0` fallbacks
 * cannot fire on data the constraint allows; they exist so a hand-edited row
 * degrades to a validation error from `createSalaryRule` rather than to
 * `undefined` arithmetic deep inside the engine.
 */
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

/** The domain's config -> the four nullable parameter columns. */
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

/** A row of the join table, plus the owning rule's own sequence for the default. */
export interface StructureRuleRow {
  salary_structure_id: string
  salary_rule_id: string
  /** NULL means "use the rule's own sequence" — see migration 0003. */
  sequence_override: number | null
  rule_sequence: number
}
