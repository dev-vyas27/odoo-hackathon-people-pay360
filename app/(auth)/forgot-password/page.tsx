/**
 * "I forgot my password." Public — `proxy.ts` lists `/forgot-password`.
 *
 * Already signed in? Then there is nothing to recover, so this redirects to the
 * dashboard rather than letting somebody email themselves a reset link out of
 * a working session.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getActor } from '@/lib/auth'
import { landingPathFor } from '@/components/layout/nav-items'
import { ForgotPasswordForm } from './forgot-password-form'

export default async function ForgotPasswordPage() {
  const actor = await getActor()
  if (actor) redirect(landingPathFor(actor.role))

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <Link href="/login" className="text-sm tracking-tight">
            PeoplePay<span className="text-primary">360</span>
          </Link>
          <h1 className="text-2xl font-medium tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your work email and we will send you a link to choose a new password.
          </p>
        </div>

        <ForgotPasswordForm />
      </div>
    </div>
  )
}
