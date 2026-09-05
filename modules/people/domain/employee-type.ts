/**
 * Employment type of an employee.
 *
 * Lives in the People domain because that is where it is decided, but it is
 * re-exported from the module index because Payroll and Analytics both filter
 * on it (the spec's "Employee Type filters" on the dashboard, section A7).
 */
export const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const

export type EmployeeType = (typeof EMPLOYEE_TYPES)[number]

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  intern: 'Intern',
}

export function isEmployeeType(value: string): value is EmployeeType {
  return (EMPLOYEE_TYPES as readonly string[]).includes(value)
}
