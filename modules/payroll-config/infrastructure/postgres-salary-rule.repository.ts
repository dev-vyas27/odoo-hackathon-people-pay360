/**
 * Postgres adapter for SalaryRuleRepositoryPort.
 *
 * Inherits paging, filtering, search and sorting from BaseSqlRepository and adds
 * only what is genuinely rule-specific. Note that `toDomain` runs every row
 * through the domain factory: anything read out of the database is therefore as
 * valid as anything created through the API, even if it was seeded or edited by
 * hand in psql.
 */
import { BaseSqlRepository, type SqlValue } from '@/modules/shared/infrastructure/sql-repository'
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
  /** Sequence is the order the rules actually run in — the only useful default. */
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

  /**
   * Column mapping written out rather than spread: this is the one place a
   * domain field name meets a column name, and it is worth being able to point
   * at. `id` is deliberately absent — the database assigns it.
   */
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
    /**
     * Switching computation type must NULL the parameters of the old one,
     * otherwise a rule that was a percentage and is now fixed keeps a stale
     * base_rule_code and the parameters CHECK rejects the update with a message
     * about a constraint the user has never heard of.
     *
     * `toComputationColumns` already returns explicit nulls for the branches it
     * does not use, so the update below clears them by construction — provided
     * they are not filtered out as `undefined`, which is why it returns `null`
     * rather than omitting them.
     */
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
