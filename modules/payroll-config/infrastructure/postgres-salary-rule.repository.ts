


import { BaseSqlRepository, type SqlValue } from '@/modules/shared/server'
import { query } from '@/lib/db'
import type { SalaryRuleRepositoryPort } from '../application/ports/salary-rule-repository.port'
import { createSalaryRule, type SalaryRule } from '../domain/salary-rule'
import {
  SALARY_RULE_COLUMNS,
  SALARY_RULES_TABLE,
  toComputation,
  toComputationColumns,
  type SalaryRuleRow,
} from './salary-rule.table'

export class PostgresSalaryRuleRepository
  extends BaseSqlRepository<SalaryRule, SalaryRuleRow>
  implements SalaryRuleRepositoryPort
{
  protected readonly table = SALARY_RULES_TABLE
  protected readonly columns = SALARY_RULE_COLUMNS
  protected readonly searchable = ['name', 'code']
  
  protected readonly defaultSort = 'sequence'

  protected toDomain(row: SalaryRuleRow): SalaryRule {
    return createSalaryRule({
      id: row.id,
      name: row.name,
      code: row.code,
      category: row.category,
      sequence: row.sequence,
      computation: toComputation(row),
      active: row.is_active,
    })
  }

  


  private toColumns(rule: Partial<SalaryRule>): Record<string, SqlValue> {
    return {
      name: rule.name,
      code: rule.code,
      category: rule.category,
      sequence: rule.sequence,
      ...(rule.computation ? toComputationColumns(rule.computation) : {}),
      is_active: rule.active,
    }
  }

  async create(data: Partial<SalaryRule>): Promise<SalaryRule> {
    return this.insertRow(this.toColumns(data))
  }

  async update(id: string, data: Partial<SalaryRule>): Promise<SalaryRule | null> {
    


    return this.updateRow(id, this.toColumns(data))
  }

  async findManyByIds(ids: string[]): Promise<SalaryRule[]> {
    if (!ids.length) return []

    const rows = await query<SalaryRuleRow>(
      `SELECT ${this.selection} FROM "${this.table}" WHERE id = ANY($1) ORDER BY "sequence" ASC`,
      [ids],
    )
    return rows.map((row) => this.toDomain(row))
  }

  async findByCode(code: string): Promise<SalaryRule | null> {
    const rows = await query<SalaryRuleRow>(
      `SELECT ${this.selection} FROM "${this.table}" WHERE code = $1`,
      [code.trim().toUpperCase()],
    )
    return rows[0] ? this.toDomain(rows[0]) : null
  }
}
