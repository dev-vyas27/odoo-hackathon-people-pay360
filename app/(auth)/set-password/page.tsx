


import { AuthColumn } from '../_components/auth-column'
import { SetPasswordForm } from './set-password-form'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <AuthColumn>
      <div className="space-y-3">
        <h1 className="text-xl font-medium">Choose a password</h1>
        <p className="text-base text-muted-foreground">
          This is the last step. Pick something you have not used elsewhere.
        </p>
      </div>

      <SetPasswordForm token={token ?? ''} />
    </AuthColumn>
  )
}
