import { describe, expect, it } from 'vitest'
import { ACTIONS, RESOURCES, ROLES, can, scopeToSelf, type Permission } from './permissions'

/**
 * The authorisation matrix, asserted exhaustively.
 *
 * Every other permission test in this repo checks one path. This one pins the
 * WHOLE table: for each of the five roles it lists exactly what they may do, so
 * a grant added or removed by accident fails here with a diff rather than
 * surfacing months later as somebody seeing a button they should not.
 *
 * Written as explicit lists rather than derived from the same helpers the
 * source uses — a test that rebuilds the table the same way would agree with a
 * mistake.
 */

const EXPECTED: Record<string, Permission[]> = {
  employee: [
    // Read-only, and row-scoped on top (see scopeToSelf).
    'employee:read',
    'attendance:read',
    'attendance:create',
    'leave_request:read',
    'leave_request:create',
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
    // Payroll: may run one, may NOT sign it off.
    'payrun:create',
    'payrun:read',
    'payrun:update',
    'payslip:create',
    'payslip:read',
    'payslip:update',
    // Salary configuration is read-only for this role.
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

/** Everything this role is actually granted, as a sorted list. */
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

  it('an employee may only create their own records, never edit or delete', () => {
    /**
     * Two writes, both self-service: clocking in, and raising leave. Anything
     * they create still passes through `authorizeOwned`, so it can only ever be
     * their own — and there is deliberately no `update` or `delete` anywhere,
     * because correcting attendance and deciding leave are HR's jobs.
     */
    const writes = granted('employee').filter((p) => !p.endsWith(':read')).sort()
    expect(writes).toEqual(['attendance:create', 'leave_request:create'])
    expect(writes.every((p) => p.endsWith(':create'))).toBe(true)
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
    // The matrix is built by spreading the previous role, and the screens rely
    // on that: a manager is never offered less than a user.
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
