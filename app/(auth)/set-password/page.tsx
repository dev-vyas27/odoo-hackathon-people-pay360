/**
 * Redeem an invitation. Public — `proxy.ts` lists `/set-password`.
 *
 * The token arrives in the query string. It is read here on the server only to
 * hand it to the client component; validity is checked against the API, because
 * a link can be spent or expired and the person deserves to know that before
 * they type a password twice.
 */
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
