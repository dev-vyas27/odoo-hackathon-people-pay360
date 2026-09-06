import { describe, expect, it } from 'vitest'
import { ACTIONS, RESOURCES, ROLES, can, scopeToSelf, type Permission } from './permissions'

const EXPECTED: Record<string, Permission[]> = {
  employee: [
    'employee:read',
    'attendance:read',
    'attendance:create',
    'leave_request:read',
    'leave_request:create',
    'leave_request:update',
    'leave_request:delete',
    'allocation:read',
    'time_off_type:read',
  ],
  hr_manager: [
    ...crud('employee', 'department', 'job_position', 'contract', 'working_schedule', 'attendance'),
    ...crud('time_off_type', 'allocation', 'leave_request'),
    'leave_request:approve',
    'allocation:approve',
  ] as Permission[],
  hr_payroll_user: [
    ...crud('employee', 'department', 'job_position', 'contract', 'working_schedule', 'attendance'),
    ...crud('time_off_type', 'allocation', 'leave_request'),
    'leave_request:approve',
    'allocation:approve',
    'payrun:create',
    'payrun:read',
    'payrun:update',
    'payslip:create',
    'payslip:read',
    'payslip:update',
    'salary_structure:read',
    'salary_rule:read',
    'dashboard:read',
  ] as Permission[],
  hr_payroll_manager: [
    ...crud('employee', 'department', 'job_position', 'contract', 'working_schedule', 'attendance'),
    ...crud('time_off_type', 'allocation', 'leave_request'),
    'leave_request:approve',
    'allocation:approve',
    ...crud('payrun', 'payslip', 'salary_structure', 'salary_rule'),
    'payrun:approve',
    'dashboard:read',
  ] as Permission[],
  admin: [
    ...crud('employee', 'department', 'job_position', 'contract', 'working_schedule', 'attendance'),
    ...crud('time_off_type', 'allocation', 'leave_request'),
    'leave_request:approve',
    'allocation:approve',
    ...crud('payrun', 'payslip', 'salary_structure', 'salary_rule'),
    'payrun:approve',
    'dashboard:read',
    ...crud('user'),
  ] as Permission[],
}

function crud(...resources: string[]): Permission[] {
  return resources.flatMap((r) =>
    ['create', 'read', 'update', 'delete'].map((a) => `${r}:${a}` as Permission),
  )
}

function granted(role: string): string[] {
  const out: string[] = []
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      if (can(role as never, resource, action)) out.push(`${resource}:${action}`)
    }
  }
  return out.sort()
}

describe('the authorisation matrix', () => {
  for (const role of ROLES) {
    it(`${role} is granted exactly what it should be`, () => {
      expect(granted(role)).toEqual([...new Set(EXPECTED[role])].sort())
    })
  }

  it('covers every role', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ROLES].sort())
  })
})

describe('the rules that make each role different', () => {
  it('only a plain employee is scoped to their own rows', () => {
    expect(scopeToSelf('employee')).toBe(true)
    for (const role of ROLES.filter((r) => r !== 'employee')) {
      expect(scopeToSelf(role), `${role} must see the whole company`).toBe(false)
    }
  })

  it('an employee writes only their own attendance and their own leave', () => {
    const writes = granted('employee').filter((p) => !p.endsWith(':read')).sort()
    expect(writes).toEqual([
      'attendance:create',
      'leave_request:create',
      'leave_request:delete',
      'leave_request:update',
    ])
  })

  it('an employee still cannot touch anybody else’s records', () => {
    expect(can('employee', 'leave_request', 'approve')).toBe(false)
    expect(can('employee', 'allocation', 'approve')).toBe(false)
    expect(can('employee', 'employee', 'update')).toBe(false)
    expect(can('employee', 'employee', 'delete')).toBe(false)
    expect(can('employee', 'attendance', 'update')).toBe(false)
  })

  it('an employee cannot touch payroll at all', () => {
    for (const resource of ['payrun', 'payslip', 'salary_rule', 'salary_structure', 'dashboard'] as const) {
      for (const action of ACTIONS) {
        expect(can('employee', resource, action), `${resource}:${action}`).toBe(false)
      }
    }
  })

  it('hr_manager has no payroll access — that is the whole distinction', () => {
    for (const resource of ['payrun', 'payslip', 'salary_rule', 'salary_structure', 'dashboard'] as const) {
      for (const action of ACTIONS) {
        expect(can('hr_manager', resource, action), `${resource}:${action}`).toBe(false)
      }
    }
  })

  it('hr_payroll_user may run a payrun but not sign it off', () => {
    expect(can('hr_payroll_user', 'payrun', 'create')).toBe(true)
    expect(can('hr_payroll_user', 'payrun', 'update')).toBe(true)
    expect(
      can('hr_payroll_user', 'payrun', 'approve'),
      'validate and mark-paid are approvals — a manager signs those',
    ).toBe(false)
    expect(can('hr_payroll_user', 'payrun', 'delete')).toBe(false)
  })

  it('hr_payroll_user reads salary configuration but cannot change it', () => {
    expect(can('hr_payroll_user', 'salary_rule', 'read')).toBe(true)
    expect(can('hr_payroll_user', 'salary_rule', 'create')).toBe(false)
    expect(can('hr_payroll_user', 'salary_rule', 'update')).toBe(false)
    expect(can('hr_payroll_user', 'salary_structure', 'update')).toBe(false)
  })

  it('only an admin administers accounts', () => {
    for (const role of ROLES.filter((r) => r !== 'admin')) {
      for (const action of ACTIONS) {
        expect(can(role, 'user', action), `${role} must not manage users`).toBe(false)
      }
    }
    expect(can('admin', 'user', 'create')).toBe(true)
  })

  it('each role includes everything the one below it can do', () => {
    const ladder = ['hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'] as const
    for (let i = 1; i < ladder.length; i++) {
      const lower = new Set(granted(ladder[i - 1]))
      const higher = new Set(granted(ladder[i]))
      for (const permission of lower) {
        expect(higher.has(permission), `${ladder[i]} lost ${permission}`).toBe(true)
      }
    }
  })
})
