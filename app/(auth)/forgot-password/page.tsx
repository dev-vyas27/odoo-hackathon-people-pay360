


import { redirect } from 'next/navigation'
import { getActor } from '@/lib/auth'
import { landingPathFor } from '@/components/layout/nav-items'
import { AuthColumn } from '../_components/auth-column'
import { ForgotPasswordForm } from './forgot-password-form'

export default async function ForgotPasswordPage() {
  const actor = await getActor()
  if (actor) redirect(landingPathFor(actor.role))

  return (
    <AuthColumn>
      <div className="space-y-3">
        <h1 className="text-xl font-medium">Reset your password</h1>
        <p className="text-base text-muted-foreground">
          Enter your work email and we will send you a link to choose a new one.
        </p>
      </div>

      <ForgotPasswordForm />
    </AuthColumn>
  )
}
