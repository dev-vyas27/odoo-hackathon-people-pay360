/**
 * Where an employee worked a shift.
 *
 * Asked at check-in because it is only knowable then — where somebody worked on
 * a Tuesday in March cannot be reconstructed afterwards from anything the
 * system stores.
 *
 * `other` is deliberately present and deliberately vague. Without it the honest
 * answer for a client site, a train, or a conference is to pick one of the two
 * wrong ones, and a field people are forced to lie in stops being worth
 * reporting on.
 */
export const WORK_MODES = ['office', 'home', 'other'] as const

export type WorkMode = (typeof WORK_MODES)[number]

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  office: 'Office',
  home: 'Home',
  other: 'Other',
}

export function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === 'string' && (WORK_MODES as readonly string[]).includes(value)
}
