/**
 * Postgres implementation of EmployeeRepositoryPort.
 *
 * Extends BaseSqlRepository for the uniform list/get/delete behaviour and
 * supplies explicit create/update, because those are the two places where the
 * camelCase domain has to be spelled out as snake_case columns.
 */
import { queryOne } from '@/lib/db'
import type { PageQuery } from '@/modules/shared'
import { BaseSqlRepository, type SqlValue } from '@/modules/shared/server'
import type { EmployeeRepositoryPort } from '../application/ports/employee-repository.port'
import { Employee } from '../domain/employee'
import {
  EMPLOYEES_TABLE,
  EMPLOYEE_COLUMNS,
  NOT_AN_ADMIN,
  type EmployeeRow,
} from './people.tables'

export class PostgresEmployeeRepository
  extends BaseSqlRepository<Employee, EmployeeRow>
  implements EmployeeRepositoryPort
{
  protected readonly table = EMPLOYEES_TABLE
  protected readonly columns = EMPLOYEE_COLUMNS
  protected readonly searchable = ['name', 'email']
  protected readonly defaultSort = 'created_at'

  /**
   * Hide administrator accounts from employee LISTS.
   *
   * Migration 0010 made every login an employee row, which means the account
   * somebody administers the system with now appears on the HR list beside real
   * staff. It has no department, no contract and no job position, because it is
   * not a person on the payroll — it is the operator. Showing it makes the list
   * read as though the company employs its own admin console.
   *
   * Three things worth knowing about doing it here:
   *
   *  - `findMany` derives BOTH the page query and its COUNT from one call to
   *    `buildWhere`, so filtering here keeps the total and the rows agreeing.
   *    A filter applied in the UI would leave the pagination lying.
   *  - `findById` does not go through `buildWhere`, so an administrator's own
   *    record is still reachable directly. Hidden from a list is not deleted.
   *  - The `EmployeeLookupPort` adapter runs its own SQL, so payroll
   *    eligibility and the dashboard are deliberately untouched by this.
   *
   * The predicate is `NOT_AN_ADMIN`, shared with the dashboard's people
   * statistics so the list and the headcount cannot disagree. It is a constant,
   * never a caller's identifier, which is why `role` can stay out of
   * `EMPLOYEE_COLUMNS` and therefore off the wire.
   */
  protected buildWhere(
    q: PageQuery,
    startIndex = 1,
  ): { clause: string; values: SqlValue[]; nextIndex: number } {
    const built = super.buildWhere(q, startIndex)

    // An explicit opt-in, for a screen that genuinely wants every account.
    const includeAdmins = q.filters?.includeAdmins
    if (includeAdmins === true || includeAdmins === 'true') return built

    return {
      ...built,
      clause: built.clause ? `${built.clause} AND ${NOT_AN_ADMIN}` : `WHERE ${NOT_AN_ADMIN}`,
    }
  }

  protected toDomain(row: EmployeeRow): Employee {
    return Employee.fromPersistence({
      id: row.id,
      name: row.name,
      email: row.email,
      departmentId: row.department_id,
      managerId: row.manager_id,
      jobPositionId: row.job_position_id,
      workingScheduleId: row.working_schedule_id,
      employeeType: row.employee_type,
      bankAccount: row.bank_account,
      isActive: row.is_active,
    })
  }

  /** Domain -> columns. The one place the two vocabularies meet. */
  private toRow(employee: Partial<Employee>): Record<string, SqlValue> {
    const e = employee as Employee
    return {
      name: e.name,
      email: e.email,
      department_id: e.departmentId ?? null,
      job_position_id: e.jobPositionId ?? null,
      manager_id: e.managerId ?? null,
      working_schedule_id: e.workingScheduleId ?? null,
      employee_type: e.employeeType,
      bank_account: e.bankAccount ?? null,
      is_active: e.isActive,
    }
  }

  async create(data: Partial<Employee>): Promise<Employee> {
    return this.insertRow(this.toRow(data))
  }

  async update(id: string, data: Partial<Employee>): Promise<Employee | null> {
    return this.updateRow(id, this.toRow(data))
  }

  /**
   * lower(email) matches the way the uniqueness constraint is enforced, so a
   * lookup for Admin@x.com finds the row stored as admin@x.com.
   */
  async findByEmail(email: string): Promise<Employee | null> {
    const row = await queryOne<EmployeeRow>(
      `SELECT ${this.selection} FROM "${EMPLOYEES_TABLE}" WHERE lower(email) = lower($1)`,
      [email],
    )
    return row ? this.toDomain(row) : null
  }
}
