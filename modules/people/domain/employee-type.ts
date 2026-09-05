/**
 * EmployeeType — value object / enum.
 *
 * Kept as a plain string union + guard rather than a class: it has no
 * behaviour of its own, only a closed set of valid values that every layer
 * (domain, zod schema, Mongo enum) must agree on.
 */
export const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const

export type EmployeeType = (typeof EMPLOYEE_TYPES)[number]

export function isEmployeeType(value: unknown): value is EmployeeType {
  return typeof value === 'string' && (EMPLOYEE_TYPES as readonly string[]).includes(value)
}

/**
 * Human labels for the Employee Type dropdown and the dashboard's employee-type
 * filter (spec A7). Kept beside the union so adding a type without a label is a
 * compile error rather than a blank option in the UI.
 */
export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  intern: 'Intern',
}
