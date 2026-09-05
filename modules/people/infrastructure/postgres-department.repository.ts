/**
 * Postgres implementation of DepartmentRepositoryPort.
 *
 * Two deliberate mappings, both forced by the schema (which the platform
 * developer owns and we conform to):
 *
 *  * `code` is NOT NULL UNIQUE in the table but is not part of our domain, so
 *    it is derived from the name. Derivation lives here rather than in the
 *    domain because it is a storage requirement, not a business rule.
 *  * `parentDepartmentId` exists in the domain but has no column. It reads back
 *    as null. Flagged to the schema owner: either the column arrives or the
 *    field should leave the domain — silently dropping a value is the one
 *    outcome nobody should be happy with.
 */
import { queryOne } from '@/lib/db'
import { BaseSqlRepository, type SqlValue } from '@/modules/shared/server'
import type { DepartmentRepositoryPort } from '../application/ports/department-repository.port'
import { Department } from '../domain/department'
import { DEPARTMENTS_TABLE, DEPARTMENT_COLUMNS, type DepartmentRow } from './people.tables'

/** "People & Culture" -> "PEOPLE_CULTURE". Stable, readable, and unique enough. */
function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

export class PostgresDepartmentRepository
  extends BaseSqlRepository<Department, DepartmentRow>
  implements DepartmentRepositoryPort
{
  protected readonly table = DEPARTMENTS_TABLE
  protected readonly columns = DEPARTMENT_COLUMNS
  protected readonly searchable = ['name', 'code']
  protected readonly defaultSort = 'name'

  protected toDomain(row: DepartmentRow): Department {
    return Department.fromPersistence({
      id: row.id,
      name: row.name,
      managerId: row.manager_id,
      parentDepartmentId: null, // no column; see the note above
    })
  }

  private toRow(d: Partial<Department>): Record<string, SqlValue> {
    const dept = d as Department
    return {
      name: dept.name,
      code: codeFromName(dept.name),
      manager_id: dept.managerId ?? null,
    }
  }

  async create(data: Partial<Department>): Promise<Department> {
    return this.insertRow(this.toRow(data))
  }

  async update(id: string, data: Partial<Department>): Promise<Department | null> {
    return this.updateRow(id, this.toRow(data))
  }

  async findByName(name: string): Promise<Department | null> {
    const row = await queryOne<DepartmentRow>(
      `SELECT ${this.selection} FROM "${DEPARTMENTS_TABLE}" WHERE lower(name) = lower($1)`,
      [name],
    )
    return row ? this.toDomain(row) : null
  }
}
