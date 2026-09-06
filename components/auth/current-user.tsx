'use client'

import { createContext, useContext } from 'react'
import { can, scopeToSelf, type Action, type CurrentUser, type Resource } from '@/modules/shared'

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

export function useCurrentUser(): CurrentUser {
  const user = useContext(CurrentUserContext)
  if (!user) {
    throw new Error('useCurrentUser must be used inside the dashboard layout’s CurrentUserProvider')
  }
  return user
}

export function useCan(resource: Resource, action: Action): boolean {
  return can(useCurrentUser().role, resource, action)
}

export function useScopedToSelf(): boolean {
  return scopeToSelf(useCurrentUser().role)
}
