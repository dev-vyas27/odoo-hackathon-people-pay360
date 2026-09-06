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
  /**
   * Roles that HOLD the permission but have no use for the section.
   *
   * Not the same thing as removing the grant. An employee needs
   * `employee:read` — it is what lets them open their own record, scoped — but
   * the Employees tab is an HR directory, and offering it to somebody who will
   * only ever find themselves in it is offering a filing cabinet with one
   * drawer. Dropping the permission instead would break the record they are
   * entitled to see.
   */
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

/**
 * Where a role should land after signing in: the first section it may read.
 *
 * A payroll manager wants the dashboard; a plain employee has no dashboard
 * permission at all and would bounce off `/reports` straight into `/forbidden`,
 * which is a terrible first impression of the app.
 *
 * Reading the FILTERED list rather than the raw one is what makes Attendance an
 * employee's home page: it is the first section left once the Employees
 * directory is hidden from them, so the landing page follows the navigation
 * instead of having to be kept in step with it by hand.
 */
export function landingPathFor(role: Role): string {
  if (can(role, 'dashboard', 'read')) return '/reports'
  return navItemsFor(role)[0]?.href ?? '/time-off/requests'
}
