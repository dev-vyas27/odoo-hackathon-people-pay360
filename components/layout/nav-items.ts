/**
 * The navigation table, and the resource each entry reads.
 *
 * Two things depend on this being data rather than JSX: the top nav filters it
 * with `can(role, resource, 'read')`, and `proxy.ts` guards the same prefixes
 * with the same permission table. A link the user cannot follow is therefore
 * impossible to render — the UI and the API cannot disagree about who sees
 * what, because they consult one source of truth.
 *
 * Order is the spec's order (section B1). Do not sort alphabetically.
 */
import type { Resource, Role } from '@/modules/shared'
import { can } from '@/modules/shared'

export interface NavItem {
  href: string
  label: string
  resource: Resource
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/employees', label: 'Employees', resource: 'employee' },
  { href: '/contracts', label: 'Contracts', resource: 'contract' },
  { href: '/attendance', label: 'Attendance', resource: 'attendance' },
  { href: '/time-off', label: 'Time Off', resource: 'leave_request' },
  { href: '/payroll', label: 'Payroll', resource: 'payrun' },
  { href: '/reports', label: 'Reports', resource: 'dashboard' },
]

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => can(role, item.resource, 'read'))
}

/**
 * Where a role should land after signing in: the first section it may read.
 *
 * A payroll manager wants the dashboard; a plain employee has no dashboard
 * permission at all and would bounce off `/reports` straight into `/forbidden`,
 * which is a terrible first impression of the app.
 */
export function landingPathFor(role: Role): string {
  if (can(role, 'dashboard', 'read')) return '/reports'
  return navItemsFor(role)[0]?.href ?? '/time-off/requests'
}
