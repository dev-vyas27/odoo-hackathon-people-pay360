/**
 * Postgres adapter for SalaryStructureRepositoryPort.
 *
 * A structure spans two tables — `salary_structures` and the
 * `salary_structure_rules` join — so every read batch-loads the join rows for
 * the whole page in ONE extra query rather than one per structure. A payroll
 * config screen with twenty structures issues two queries, not twenty-one.
 *
 * Writes go through a transaction: the structure and its rule set land together
 * or not at all. A structure that saved its name but lost half its rules would
 * compute wrong payslips and look fine on screen.
 */
import { BaseSqlRepository, type SqlValue } from '@/modules/shared/server'
import { query, transaction, type PoolClient } from '@/lib/db'
import type { PageQuery, Paged } from '@/modules/shared'
import type { SalaryStructureRepositoryPort } from '../application/ports/salary-structure-repository.port'
import {
  createSalaryStructure,
  type SalaryStructure,
  type StructureRuleRef,
} from '../domain/salary-structure'
import {
  SALARY_RULES_TABLE,
  SALARY_STRUCTURE_COLUMNS,
  SALARY_STRUCTURE_RULES_TABLE,
  SALARY_STRUCTURES_TABLE,
  type SalaryStructureRow,
} from './salary-rule.table'

/** A join row plus the referenced rule's own sequence, for the COALESCE default. */
interface JoinRow {
  salary_structure_id: string
  salary_rule_id: string
  sequence: number
}

export class PostgresSalaryStructureRepository
  extends BaseSqlRepository<SalaryStructure, SalaryStructureRow>
  implements SalaryStructureRepositoryPort
{
  protected readonly table = SALARY_STRUCTURES_TABLE
  protected readonly columns = SALARY_STRUCTURE_COLUMNS
  protected readonly searchable = ['name', 'code']
  protected readonly defaultSort = 'name'

  /**
   * Rules are attached by the callers below, which is why this takes them as an
   * argument rather than reading them itself — a mapper that queries is a
   * mapper that N+1s.
   */
  protected toDomain(row: SalaryStructureRow, rules: StructureRuleRef[] = []): SalaryStructure {
    return createSalaryStructure({
      id: row.id,
      name: row.name,
      code: row.code,
      rules,
      active: row.is_active,
    })
  }

  async findById(id: string): Promise<SalaryStructure | null> {
    const rows = await query<SalaryStructureRow>(
      `SELECT ${this.selection} FROM "${this.table}" WHERE id = $1`,
      [id],
    )
    if (!rows[0]) return null

    const byStructure = await this.loadRules([id])
    return this.toDomain(rows[0], byStructure.get(id) ?? [])
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<SalaryStructure>> {
    // The base class does the paging, filtering and ORDER BY; it just cannot
    // know about the join, so the rules are attached afterwards.
    const page = await super.findMany(pageQuery)
    if (!page.items.length) return page

    const byStructure = await this.loadRules(page.items.map((s) => s.id))

    return {
      ...page,
      items: page.items.map((structure) =>
        createSalaryStructure({
          id: structure.id,
          name: structure.name,
          code: structure.code,
          rules: byStructure.get(structure.id) ?? [],
          active: structure.active,
        }),
      ),
    }
  }

  async findByRuleId(ruleId: string): Promise<SalaryStructure[]> {
    const qualified = SALARY_STRUCTURE_COLUMNS.map((c) => `s."${c}"`).join(', ')
    const rows = await query<SalaryStructureRow>(
      `SELECT ${qualified}
         FROM "${this.table}" s
         JOIN "${SALARY_STRUCTURE_RULES_TABLE}" ssr ON ssr.salary_structure_id = s.id
        WHERE ssr.salary_rule_id = $1
        ORDER BY s.name ASC`,
      [ruleId],
    )
    if (!rows.length) return []

    const byStructure = await this.loadRules(rows.map((r) => r.id))
    return rows.map((row) => this.toDomain(row, byStructure.get(row.id) ?? []))
  }

  async create(data: Partial<SalaryStructure>): Promise<SalaryStructure> {
    return transaction(async (client) => {
      const inserted = await client.query<SalaryStructureRow>(
        `INSERT INTO "${this.table}" (name, code, is_active) VALUES ($1, $2, $3)
         RETURNING ${this.selection}`,
        [data.name, data.code, data.active ?? true],
      )
      const row = inserted.rows[0]

      const rules = [...(data.rules ?? [])]
      await this.replaceRules(client, row.id, rules)
      return this.toDomain(row, rules)
    })
  }

  async update(id: string, data: Partial<SalaryStructure>): Promise<SalaryStructure | null> {
    return transaction(async (client) => {
      const updated = await client.query<SalaryStructureRow>(
        `UPDATE "${this.table}" SET
           name      = COALESCE($2, name),
           code      = COALESCE($3, code),
           is_active = COALESCE($4, is_active)
         WHERE id = $1
         RETURNING ${this.selection}`,
        [id, data.name ?? null, data.code ?? null, data.active ?? null],
      )
      const row = updated.rows[0]
      if (!row) return null

      // `undefined` means "the caller did not touch the rule set"; an empty
      // array means "remove them all", and those must not be confused.
      if (data.rules === undefined) {
        const existing = await this.loadRules([id])
        return this.toDomain(row, existing.get(id) ?? [])
      }

      const rules = [...data.rules]
      await this.replaceRules(client, id, rules)
      return this.toDomain(row, rules)
    })
  }

  /**
   * Batch-load the rule references for several structures at once.
   *
   * `COALESCE(sequence_override, sr.sequence)` implements the schema's rule:
   * a NULL override means "use the rule's own sequence".
   */
  private async loadRules(structureIds: string[]): Promise<Map<string, StructureRuleRef[]>> {
    const byStructure = new Map<string, StructureRuleRef[]>()
    if (!structureIds.length) return byStructure

    const rows = await query<JoinRow>(
      `SELECT ssr.salary_structure_id,
              ssr.salary_rule_id,
              COALESCE(ssr.sequence_override, sr.sequence) AS sequence
         FROM "${SALARY_STRUCTURE_RULES_TABLE}" ssr
         JOIN "${SALARY_RULES_TABLE}" sr ON sr.id = ssr.salary_rule_id
        WHERE ssr.salary_structure_id = ANY($1)
        ORDER BY sequence ASC`,
      [structureIds],
    )

    for (const row of rows) {
      const list = byStructure.get(row.salary_structure_id) ?? []
      list.push({ ruleId: row.salary_rule_id, sequence: row.sequence })
      byStructure.set(row.salary_structure_id, list)
    }

    return byStructure
  }

  /**
   * Replace the whole rule set.
   *
   * Delete-then-insert rather than a diff: the set is small, the statement is
   * obvious, and it cannot leave a stale row behind the way a partial update
   * can. Runs inside the caller's transaction.
   */
  private async replaceRules(
    client: PoolClient,
    structureId: string,
    rules: StructureRuleRef[],
  ): Promise<void> {
    await client.query(
      `DELETE FROM "${SALARY_STRUCTURE_RULES_TABLE}" WHERE salary_structure_id = $1`,
      [structureId],
    )
    if (!rules.length) return

    // One multi-row INSERT rather than a statement per rule.
    const values: SqlValue[] = []
    const tuples = rules.map((rule, index) => {
      values.push(structureId, rule.ruleId, rule.sequence)
      return `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
    })

    await client.query(
      `INSERT INTO "${SALARY_STRUCTURE_RULES_TABLE}"
         (salary_structure_id, salary_rule_id, sequence_override)
       VALUES ${tuples.join(', ')}`,
      values,
    )
  }
}
