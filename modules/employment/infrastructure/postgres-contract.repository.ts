/**
 * Postgres implementation of ContractRepositoryPort.
 *
 * `wage` crosses the boundary here: Money in the domain, numeric in the table.
 * Nothing above this file sees a raw number, and nothing below sees Money.
 */
import { query } from '@/lib/db'
import { Money, type PageQuery } from '@/modules/shared'
import { BaseSqlRepository, type SqlValue } from '@/modules/shared/server'
import type { ContractRepositoryPort } from '../application/ports/contract-repository.port'
import type { Contract } from '../domain/contract'
import { CONTRACTS_TABLE, CONTRACT_COLUMNS, type ContractRow } from './employment.tables'

export class PostgresContractRepository
  extends BaseSqlRepository<Contract, ContractRow>
  implements ContractRepositoryPort
{
  protected readonly table = CONTRACTS_TABLE
  protected readonly columns = CONTRACT_COLUMNS
  protected readonly defaultSort = 'starts_on'

  /**
   * `contracts` has no free-text column of its own — `searchable` stays empty
   * on purpose, or every keystroke would ILIKE a uuid or a decimal wage and
   * never match. What a person typing into this screen's search box actually
   * means is "find the employee named X", and that name lives on `employees`,
   * a table this repository does not otherwise touch. An EXISTS subquery,
   * bolted onto whatever the base class already built, reaches it without
   * turning this into a join-aware repository for every other filter too.
   */
  protected buildWhere(
    q: PageQuery,
    startIndex = 1,
  ): { clause: string; values: SqlValue[]; nextIndex: number } {
    const built = super.buildWhere(q, startIndex)
    if (!q.search) return built

    const index = built.nextIndex
    const exists = `EXISTS (SELECT 1 FROM "employees" e WHERE e.id = "${CONTRACTS_TABLE}"."employee_id" AND e.name ILIKE $${index})`
    return {
      clause: built.clause ? `${built.clause} AND ${exists}` : `WHERE ${exists}`,
      values: [...built.values, `%${q.search}%`],
      nextIndex: index + 1,
    }
  }

  protected toDomain(row: ContractRow): Contract {
    return {
      id: row.id,
      employeeId: row.employee_id,
      wage: Money.of(Number(row.wage)),
      salaryStructureId: row.salary_structure_id,
      workingScheduleId: row.working_schedule_id,
      // Neither column exists on `contracts`; the ContractQueryPort adapter
      // supplies them by joining through the employee. A repository returning
      // the aggregate leaves them null rather than inventing a value.
      departmentId: null,
      jobPositionName: null,
      start: row.starts_on,
      end: row.ends_on,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private toRow(c: Partial<Contract>): Record<string, SqlValue> {
    return {
      employee_id: c.employeeId,
      wage: c.wage ? c.wage.toNumber() : undefined,
      salary_structure_id: c.salaryStructureId ?? null,
      working_schedule_id: c.workingScheduleId ?? null,
      starts_on: c.start,
      ends_on: c.end ?? null,
    }
  }

  async create(data: Partial<Contract>): Promise<Contract> {
    return this.insertRow(this.toRow(data))
  }

  async update(id: string, data: Partial<Contract>): Promise<Contract | null> {
    return this.updateRow(id, this.toRow(data))
  }

  /** Newest first — this drives the Contracts smart button on the employee form. */
  async findByEmployee(employeeId: string): Promise<Contract[]> {
    const rows = await query<ContractRow>(
      `SELECT ${this.selection} FROM "${CONTRACTS_TABLE}"
       WHERE employee_id = $1 ORDER BY starts_on DESC`,
      [employeeId],
    )
    return rows.map((r) => this.toDomain(r))
  }
}
