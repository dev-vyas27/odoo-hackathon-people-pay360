


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

  


  protected buildWhere(
    q: PageQuery,
    startIndex = 1,
  ): { clause: string; values: SqlValue[]; nextIndex: number } {
    const built = super.buildWhere(q, startIndex)

    
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

  


  async findByEmail(email: string): Promise<Employee | null> {
    const row = await queryOne<EmployeeRow>(
      `SELECT ${this.selection} FROM "${EMPLOYEES_TABLE}" WHERE lower(email) = lower($1)`,
      [email],
    )
    return row ? this.toDomain(row) : null
  }
}
