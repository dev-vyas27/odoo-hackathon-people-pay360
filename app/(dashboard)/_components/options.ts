'use client'



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
    items: page.items,
    options: page.items.map((s) => ({ value: s.id, label: `${s.name} (${s.weeklyHours}h)` })),
  }
}



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



export function useEmployeeOptions(excludeId?: string) {
  const { page, isLoading } = useResourceList<EmployeeListItem>('employees', PICKER)
  const blocked = reportingSubtree(page.items, excludeId)
  return {
    isLoading,
    


    items: page.items,
    options: page.items
      .filter((e) => !blocked.has(e.id))
      .map((e) => ({ value: e.id, label: e.name })),
  }
}
