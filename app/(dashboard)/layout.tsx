/**
 * The authenticated shell.
 *
 * `proxy.ts` already blocks anonymous requests, but this layout re-reads the
 * cookie rather than trusting that: defence in depth costs one await, and it is
 * what gives every page below a guaranteed non-null user without prop drilling
 * or a client-side loading flash.
 */
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { Providers } from '@/app/providers'
import { CurrentUserProvider } from '@/components/auth/current-user'
import { TopNav } from '@/components/layout/top-nav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor()
  if (!actor) redirect('/login')

  const user = {
    employeeId: actor.employeeId,
    role: actor.role,
    email: actor.email,
    name: actor.name,
  }

  return (
    <Providers>
      {/* The layout already read the cookie, so client pages get the role with
          no extra request and no flash of an action the user cannot take. */}
      <CurrentUserProvider user={user}>
        <div className="flex min-h-full flex-col">
          <TopNav user={user} />
          <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </CurrentUserProvider>
    </Providers>
  )
}
