


import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { isDemoSeedEnabled } from '@/lib/demo-mode'
import { DEMO_CREDENTIALS } from '@/scripts/seed/parts/identity.seed'
import { landingPathFor } from '@/components/layout/nav-items'
import { LoginScreen } from './login-screen'

function safeNext(value: string | undefined): string | undefined {
  
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined
  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const actor = await getActor()
  if (actor) redirect(landingPathFor(actor.role))

  const { next } = await searchParams

  return (
    <div className="relative z-10 w-full max-w-4xl">
      {

}
      <LoginScreen next={safeNext(next)} accounts={isDemoSeedEnabled() ? DEMO_CREDENTIALS : []} />
    </div>
  )
}
