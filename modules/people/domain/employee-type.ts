

export const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const

export type EmployeeType = (typeof EMPLOYEE_TYPES)[number]

export function isEmployeeType(value: unknown): value is EmployeeType {
  return typeof value === 'string' && (EMPLOYEE_TYPES as readonly string[]).includes(value)
}

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  intern: 'Intern',
}
