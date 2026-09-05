/**
 * The authorization matrix, as data.
 *
 * Roles and their grants come straight from section 3 of the spec. Encoding it
 * as a table (rather than `if (role === 'hr_manager' || ...)` sprinkled through
 * controllers) means: one place to audit, one place to change, and the UI can
 * import the exact same table to decide which buttons to render.
 */

export const ROLES = [
  'employee',
  'hr_manager',
  'hr_payroll_user',
  'hr_payroll_manager',
  'admin',
] as const
export type Role = (typeof ROLES)[number]

export const RESOURCES = [
  'employee',
  'department',
  'job_position',
  'contract',
  'working_schedule',
  'attendance',
  'time_off_type',
  'allocation',
  'leave_request',
  'salary_structure',
  'salary_rule',
  'payrun',
  'payslip',
  'dashboard',
  'user',
] as const
export type Resource = (typeof RESOURCES)[number]

export const ACTIONS = ['create', 'read', 'update', 'delete', 'approve'] as const
export type Action = (typeof ACTIONS)[number]

export type Permission = `${Resource}:${Action}`

export const perm = (resource: Resource, action: Action): Permission =>
  `${resource}:${action}` as Permission

/** Every action on the listed resources. */
const crud = (...resources: Resource[]): Permission[] =>
  resources.flatMap((r) => (['create', 'read', 'update', 'delete'] as Action[]).map((a) => perm(r, a)))

const readOnly = (...resources: Resource[]): Permission[] => resources.map((r) => perm(r, 'read'))

/**
 * Role grants. Higher roles inherit by spreading the role beneath them, which
 * mirrors the spec's own wording ("All HR Manager permissions plus...").
 */
const EMPLOYEE: Permission[] = [
  // Own records only — row-level scoping is enforced separately, see scopeToSelf below.
  perm('employee', 'read'),
  perm('attendance', 'read'),
  perm('attendance', 'create'),
  perm('leave_request', 'read'),
  perm('leave_request', 'create'),
  perm('allocation', 'read'),
  perm('time_off_type', 'read'),
]

const HR_MANAGER: Permission[] = [
  ...crud('employee', 'department', 'job_position', 'contract', 'working_schedule', 'attendance'),
  ...crud('time_off_type', 'allocation', 'leave_request'),
  perm('leave_request', 'approve'),
  perm('allocation', 'approve'),
]

const HR_PAYROLL_USER: Permission[] = [
  ...HR_MANAGER,
  perm('payrun', 'create'),
  perm('payrun', 'read'),
  perm('payrun', 'update'),
  perm('payslip', 'create'),
  perm('payslip', 'read'),
  perm('payslip', 'update'),
  ...readOnly('salary_structure', 'salary_rule'),
  perm('dashboard', 'read'),
]

const HR_PAYROLL_MANAGER: Permission[] = [
  ...HR_PAYROLL_USER,
  ...crud('payrun', 'payslip', 'salary_structure', 'salary_rule'),
  perm('payrun', 'approve'),
]

const ADMIN: Permission[] = [
  ...HR_PAYROLL_MANAGER,
  ...crud('user'),
]

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  employee: new Set(EMPLOYEE),
  hr_manager: new Set(HR_MANAGER),
  hr_payroll_user: new Set(HR_PAYROLL_USER),
  hr_payroll_manager: new Set(HR_PAYROLL_MANAGER),
  admin: new Set(ADMIN),
}

export function can(role: Role, resource: Resource, action: Action): boolean {
  return ROLE_PERMISSIONS[role].has(perm(resource, action))
}

/**
 * True when this role may only see its OWN rows.
 *
 * The plain `employee` role has `employee:read` like everyone else — the
 * difference is not WHICH permission but WHICH ROWS. Repositories consult this
 * to add an ownership filter. Keeping it here stops each module inventing its
 * own idea of "self".
 */
export function scopeToSelf(role: Role): boolean {
  return role === 'employee'
}

/** Human labels for the role dropdown in user administration. */
export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  hr_manager: 'HR Manager',
  hr_payroll_user: 'HR Payroll User',
  hr_payroll_manager: 'HR Payroll Manager',
  admin: 'Admin',
}
