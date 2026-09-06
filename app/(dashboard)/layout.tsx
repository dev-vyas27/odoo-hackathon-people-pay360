


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
      {
}
      <CurrentUserProvider user={user}>
        <div className="flex min-h-full flex-col">
          <TopNav user={user} />
          <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-6">{children}</main>
        </div>
      </CurrentUserProvider>
    </Providers>
  )
}
