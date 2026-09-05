/**
 * Sign in. Public — `proxy.ts` lists `/login` so it is reachable anonymously.
 *
 * The `next` parameter is sanitised here rather than in the form: it arrives
 * from a redirect the proxy built, but anyone can type a URL, and blindly
 * following `?next=https://evil.example` after a successful login is a textbook
 * open redirect. Only same-origin absolute paths survive.
 */
import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { isDemoSeedEnabled } from '@/lib/demo-mode'
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
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm tracking-tight">
            PeoplePay<span className="text-primary">360</span>
          </p>
          <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            HR and payroll operations for your organisation.
          </p>
        </div>

        {/* The flag is read here, on the server, and passed down as a prop —
            it never reaches a client bundle. */}
        <LoginScreen next={safeNext(next)} demoEnabled={isDemoSeedEnabled()} />
      </div>
    </div>
  )
}
