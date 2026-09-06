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

/**
 * `items` is returned alongside `options` because callers need the weekly hours
 * to decide which schedules suit an employee type — a `{label, value}` pair
 * cannot answer "is this full time".
 */
export function useScheduleOptions() {
  const { page, isLoading } = useResourceList<ScheduleListItem>('schedules', PICKER)
  return {
    isLoading,
    items: page.items,
    options: page.items.map((s) => ({ value: s.id, label: `${s.name} (${s.weeklyHours}h)` })),
  }
}

/**
 * Everyone who could report to `excludeId`, including `excludeId` itself.
 *
 * Walks DOWN the reporting line, not just one level. If Rahul reports to Sahil
 * and Priya reports to Rahul, then neither Rahul nor Priya may become Sahil's
 * manager — picking either closes a loop, and a reporting line with a loop
 * makes any walk up it run forever.
 *
 * `seen` doubles as the result and as the cycle guard, so pre-existing bad data
 * cannot hang this.
 */
function reportingSubtree(employees: EmployeeListItem[], rootId?: string): Set<string> {
  const seen = new Set<string>()
  if (!rootId) return seen

  seen.add(rootId)
  let growing = true
  while (growing) {
    growing = false
    for (const employee of employees) {
      if (!seen.has(employee.id) && employee.managerId && seen.has(employee.managerId)) {
        seen.add(employee.id)
        growing = true
      }
    }
  }
  return seen
}

/**
 * Managers are just employees — minus anyone who already reports to this one,
 * at any depth. The server refuses a cycle too (see UpdateEmployeeUseCase);
 * this is so the choice never appears in the first place.
 */
export function useEmployeeOptions(excludeId?: string) {
  const { page, isLoading } = useResourceList<EmployeeListItem>('employees', PICKER)
  const blocked = reportingSubtree(page.items, excludeId)
  return {
    isLoading,
    /**
     * The full records, not just labels. A contract copies the employee's
     * department, position and schedule, and `{label, value}` cannot answer
     * "which department is this person in".
     */
    items: page.items,
    options: page.items
      .filter((e) => !blocked.has(e.id))
      .map((e) => ({ value: e.id, label: e.name })),
  }
}
