/**
 * Department — simple aggregate. Organisational grouping for employees.
 *
 * A department may itself have a parent (org chart) and a manager (an
 * employee id). Both are optional and unvalidated for existence here — that
 * is a cross-aggregate concern the use case resolves via the repository.
 */
import { DomainError } from '@/modules/shared'
import { Ok, Err, type Result } from '@/modules/shared'

export interface DepartmentInput {
  name: string
  managerId?: string | null
  parentDepartmentId?: string | null
}

export interface DepartmentPersistence extends DepartmentInput {
  id: string
  managerId: string | null
  parentDepartmentId: string | null
}

export class Department {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly managerId: string | null,
    readonly parentDepartmentId: string | null,
  ) {}

  static create(input: DepartmentInput): Result<Department> {
    const name = input.name.trim()
    if (!name) {
      return Err(DomainError.validation('DEPARTMENT_NAME_REQUIRED', 'Department name is required'))
    }
    return Ok(new Department('', name, input.managerId ?? null, input.parentDepartmentId ?? null))
  }

  static fromPersistence(row: DepartmentPersistence): Department {
    return new Department(row.id, row.name, row.managerId, row.parentDepartmentId)
  }

  update(patch: Partial<DepartmentInput>): Result<Department> {
    const name = (patch.name ?? this.name).trim()
    if (!name) {
      return Err(DomainError.validation('DEPARTMENT_NAME_REQUIRED', 'Department name is required'))
    }
    return Ok(
      new Department(
        this.id,
        name,
        patch.managerId !== undefined ? patch.managerId : this.managerId,
        patch.parentDepartmentId !== undefined ? patch.parentDepartmentId : this.parentDepartmentId,
      ),
    )
  }
}
