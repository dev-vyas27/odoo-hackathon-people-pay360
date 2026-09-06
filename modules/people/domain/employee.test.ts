import { describe, expect, it } from 'vitest'
import { Employee } from './employee'
import type { EmployeeType } from './employee-type'

const validInput = {
  name: 'Ada Lovelace',
  email: 'Ada@Example.com',
  employeeType: 'full_time' as const,
}

describe('Employee.create', () => {
  it('creates a valid employee, normalising email and defaulting isActive', () => {
    const result = Employee.create(validInput)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.email).toBe('ada@example.com')
    expect(result.value.isActive).toBe(true)
    expect(result.value.departmentId).toBeNull()
  })

  it('rejects a blank name', () => {
    const result = Employee.create({ ...validInput, name: '   ' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EMPLOYEE_NAME_REQUIRED')
  })

  it('rejects a malformed email', () => {
    const result = Employee.create({ ...validInput, email: 'not-an-email' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EMPLOYEE_EMAIL_INVALID')
  })

  it('rejects an unknown employee type', () => {
    const result = Employee.create({ ...validInput, employeeType: 'freelancer' as EmployeeType })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EMPLOYEE_TYPE_INVALID')
  })

  it('respects an explicit isActive: false', () => {
    const result = Employee.create({ ...validInput, isActive: false })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.isActive).toBe(false)
  })
})

describe('Employee.update', () => {
  const base = () => {
    const created = Employee.create(validInput)
    if (!created.ok) throw new Error('fixture setup failed')
    return Employee.fromPersistence({
      id: 'emp-1',
      name: created.value.name,
      email: created.value.email,
      departmentId: null,
      managerId: null,
      jobPositionId: null,
      workingScheduleId: null,
      employeeType: created.value.employeeType,
      bankAccount: null,
      isActive: true,
    })
  }

  it('applies a partial patch and keeps unset fields', () => {
    const result = base().update({ bankAccount: '000111222' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.bankAccount).toBe('000111222')
    expect(result.value.name).toBe('Ada Lovelace')
  })

  it('rejects assigning the employee as their own manager', () => {
    const result = base().update({ managerId: 'emp-1' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EMPLOYEE_CANNOT_MANAGE_SELF')
  })

  it('re-validates shape on update', () => {
    const result = base().update({ email: 'nope' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('EMPLOYEE_EMAIL_INVALID')
  })
})

describe('Employee.archive', () => {
  it('flips isActive to false without touching other fields', () => {
    const created = Employee.create(validInput)
    if (!created.ok) throw new Error('fixture setup failed')
    const archived = created.value.archive()
    expect(archived.isActive).toBe(false)
    expect(archived.name).toBe(created.value.name)
  })
})
