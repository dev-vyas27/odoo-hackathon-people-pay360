'use client'

/**
 * Select options and reference-data hooks shared by the HR forms.
 *
 * Every dropdown that points at another table goes through here, so a form
 * never hand-rolls a fetch and every picker sorts and labels the same way.
 */
import { useResourceList } from '@/hooks/use-resource'
import {
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  type DepartmentListItem,
  type EmployeeListItem,
  type JobPositionListItem,
} from '@/modules/people/schemas'
import type { ScheduleListItem, Weekday } from '@/modules/employment/schemas'
import { WEEKDAY_LABELS } from '@/modules/employment/schemas'

export const EMPLOYEE_TYPE_OPTIONS = EMPLOYEE_TYPES.map((value) => ({
  value,
  label: EMPLOYEE_TYPE_LABELS[value],
}))

export const WEEKDAY_OPTIONS = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((day) => ({
  value: String(day),
  label: WEEKDAY_LABELS[day],
}))

export const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Archived' },
]

/**
 * Pickers ask for a large page rather than paging.
 *
 * A department or schedule list is tens of rows, not thousands, and a combobox
 * that silently omits option 21 is worse than one extra round trip.
 */
const PICKER = { limit: 200 } as const

export function useDepartmentOptions() {
  const { page, isLoading } = useResourceList<DepartmentListItem>('departments', PICKER)
  return {
    isLoading,
    options: page.items.map((d) => ({ value: d.id, label: d.name })),
  }
}

export function useJobPositionOptions() {
  const { page, isLoading } = useResourceList<JobPositionListItem>('job-positions', PICKER)
  return {
    isLoading,
    options: page.items.map((j) => ({ value: j.id, label: j.title })),
  }
}

export function useScheduleOptions() {
  const { page, isLoading } = useResourceList<ScheduleListItem>('schedules', PICKER)
  return {
    isLoading,
    options: page.items.map((s) => ({ value: s.id, label: `${s.name} (${s.weeklyHours}h)` })),
  }
}

/** Managers are just employees; the list excludes nobody, the form excludes self. */
export function useEmployeeOptions(excludeId?: string) {
  const { page, isLoading } = useResourceList<EmployeeListItem>('employees', PICKER)
  return {
    isLoading,
    options: page.items
      .filter((e) => e.id !== excludeId)
      .map((e) => ({ value: e.id, label: e.name })),
  }
}
