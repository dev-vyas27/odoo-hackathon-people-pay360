

import { DomainError } from '@/modules/shared'
import { Ok, Err, type Result } from '@/modules/shared'
import { isEmployeeType, type EmployeeType } from './employee-type'

export interface EmployeeInput {
  name: string
  email: string
  departmentId?: string | null
  managerId?: string | null
  jobPositionId?: string | null
  workingScheduleId?: string | null
  employeeType: EmployeeType
  bankAccount?: string | null
  isActive?: boolean
}

export interface EmployeePersistence {
  id: string
  name: string
  email: string
  departmentId: string | null
  managerId: string | null
  jobPositionId: string | null
  workingScheduleId: string | null
  employeeType: EmployeeType
  bankAccount: string | null
  isActive: boolean
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class Employee {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly email: string,
    readonly departmentId: string | null,
    readonly managerId: string | null,
    readonly jobPositionId: string | null,
    readonly workingScheduleId: string | null,
    readonly employeeType: EmployeeType,
    readonly bankAccount: string | null,
    readonly isActive: boolean,
  ) {}

  private static validateShape(name: string, email: string, employeeType: EmployeeType): DomainError | null {
    if (!name.trim()) return DomainError.validation('EMPLOYEE_NAME_REQUIRED', 'Employee name is required')
    if (!EMAIL_SHAPE.test(email)) return DomainError.validation('EMPLOYEE_EMAIL_INVALID', 'A valid email is required')
    if (!isEmployeeType(employeeType)) {
      return DomainError.validation('EMPLOYEE_TYPE_INVALID', `Unknown employee type: ${String(employeeType)}`)
    }
    return null
  }

  static create(input: EmployeeInput): Result<Employee> {
    const name = input.name.trim()
    const email = input.email.trim().toLowerCase()
    const shapeError = Employee.validateShape(name, email, input.employeeType)
    if (shapeError) return Err(shapeError)

    return Ok(
      new Employee(
        '',
        name,
        email,
        input.departmentId ?? null,
        input.managerId ?? null,
        input.jobPositionId ?? null,
        input.workingScheduleId ?? null,
        input.employeeType,
        input.bankAccount ?? null,
        input.isActive ?? true,
      ),
    )
  }

  static fromPersistence(row: EmployeePersistence): Employee {
    return new Employee(
      row.id,
      row.name,
      row.email,
      row.departmentId,
      row.managerId,
      row.jobPositionId,
      row.workingScheduleId,
      row.employeeType,
      row.bankAccount,
      row.isActive,
    )
  }

  
  update(patch: Partial<EmployeeInput>): Result<Employee> {
    const name = (patch.name ?? this.name).trim()
    const email = (patch.email ?? this.email).trim().toLowerCase()
    const employeeType = patch.employeeType ?? this.employeeType

    const shapeError = Employee.validateShape(name, email, employeeType)
    if (shapeError) return Err(shapeError)

    const managerId = patch.managerId !== undefined ? patch.managerId : this.managerId
    if (managerId && this.id && managerId === this.id) {
      return Err(DomainError.rule('EMPLOYEE_CANNOT_MANAGE_SELF', 'An employee cannot be their own manager'))
    }

    return Ok(
      new Employee(
        this.id,
        name,
        email,
        patch.departmentId !== undefined ? patch.departmentId : this.departmentId,
        managerId,
        patch.jobPositionId !== undefined ? patch.jobPositionId : this.jobPositionId,
        patch.workingScheduleId !== undefined ? patch.workingScheduleId : this.workingScheduleId,
        employeeType,
        patch.bankAccount !== undefined ? patch.bankAccount : this.bankAccount,
        patch.isActive !== undefined ? patch.isActive : this.isActive,
      ),
    )
  }

  
  archive(): Employee {
    return new Employee(
      this.id,
      this.name,
      this.email,
      this.departmentId,
      this.managerId,
      this.jobPositionId,
      this.workingScheduleId,
      this.employeeType,
      this.bankAccount,
      false,
    )
  }
}
