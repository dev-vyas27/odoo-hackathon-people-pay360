'use client'

/**
 * Who is signed in, available to client components.
 *
 * Seeded by the dashboard layout, which already read the cookie — so there is
 * no extra request and no flash of a button the user cannot use. A client page
 * that fetched `/api/auth/me` would render the wrong UI first and correct it a
 * moment later, which for an action button means offering something and then
 * snatching it away.
 *
 * ── This is a courtesy, never the control ──────────────────────────────────
 *
 * Every use case re-checks the same permission server-side, so hiding a button
 * changes nothing about what a hand-crafted request can do. The point is that a
 * user is not shown an action that will fail: an `employee` clicking
 * "New employee" got a 403 and no explanation, which reads as a broken app
 * rather than as a permission boundary.
 *
 * `can()` comes from `modules/shared/contracts/permissions` — the SAME table
 * the server authorises against. That is the whole reason the matrix is data
 * rather than a pile of if-statements: the screen and the API cannot drift.
 */
import { createContext, useContext } from 'react'
import { can, type Action, type CurrentUser, type Resource } from '@/modules/shared'

const CurrentUserContext = createContext<CurrentUser | null>(null)

export function CurrentUserProvider({
  user,
  children,
}: {
  user: CurrentUser
  children: React.ReactNode
}) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>
}

/**
 * Throws outside the provider rather than returning null.
 *
 * A component that silently got `null` would render as though nobody were
 * signed in — which, for a permission check, means hiding everything and
 * looking like a bug. Failing loudly puts the mistake where it happened.
 */
export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext)
  if (!user) {
    throw new Error('useCurrentUser must be used inside the dashboard layout’s CurrentUserProvider')
  }
  return user
}

/** `useCan('employee', 'create')` — the same question the use case asks. */
export function useCan(resource: Resource, action: Action): boolean {
  return can(useCurrentUser().role, resource, action)
}
