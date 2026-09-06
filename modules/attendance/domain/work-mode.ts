


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
