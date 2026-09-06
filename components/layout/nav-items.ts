


import type { Resource, Role } from '@/modules/shared'
import { can } from '@/modules/shared'

export interface NavItem {
  href: string
  label: string
  resource: Resource
  


  hiddenFor?: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/employees', label: 'Employees', resource: 'employee', hiddenFor: ['employee'] },
  { href: '/contracts', label: 'Contracts', resource: 'contract' },
  { href: '/attendance', label: 'Attendance', resource: 'attendance' },
  { href: '/time-off', label: 'Time Off', resource: 'leave_request' },
  { href: '/payroll', label: 'Payroll', resource: 'payrun' },
  { href: '/reports', label: 'Reports', resource: 'dashboard' },
]

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => can(role, item.resource, 'read') && !item.hiddenFor?.includes(role),
  )
}



export function landingPathFor(role: Role): string {
  if (can(role, 'dashboard', 'read')) return '/reports'
  return navItemsFor(role)[0]?.href ?? '/time-off/requests'
}
