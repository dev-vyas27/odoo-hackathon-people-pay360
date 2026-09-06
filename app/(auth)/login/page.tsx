/**
 * Sign in. Public — `proxy.ts` lists `/login` so it is reachable anonymously.
 *
 * The `next` parameter is sanitised here rather than in the form: it arrives
 * from a redirect the proxy built, but anyone can type a URL, and blindly
 * following `?next=https://evil.example` after a successful login is a textbook
 * open redirect. Only same-origin absolute paths survive.
 *
 * The page itself is thin: it decides who may see what, and hands the whole
 * decision to `LoginScreen`, which owns the two-panel sheet. See brand-panel.tsx
 * for why the sheet is shaped the way it is.
 */
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { isDemoSeedEnabled } from '@/lib/demo-mode'
import { DEMO_CREDENTIALS } from '@/scripts/seed/parts/identity.seed'
import { landingPathFor } from '@/components/layout/nav-items'
import { LoginScreen } from './login-screen'

function safeNext(value: string | undefined): string | undefined {
  // A single leading slash only: "//evil.example" is a protocol-relative URL.
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
      {/*
        The flag is read here, on the SERVER, and the accounts are passed down
        already resolved — the credentials never reach a client bundle unless
        the flag is on, and there is no client-side check to bypass.

        `DEMO_CREDENTIALS` is the same array the seeder prints, so a password
        changed in the seed cannot leave a stale one on this screen.
      */}
      <LoginScreen next={safeNext(next)} accounts={isDemoSeedEnabled() ? DEMO_CREDENTIALS : []} />
    </div>
  )
}
