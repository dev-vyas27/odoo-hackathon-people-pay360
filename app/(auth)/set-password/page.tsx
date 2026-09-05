/**
 * Redeem an invitation. Public — `proxy.ts` lists `/set-password`.
 *
 * The token arrives in the query string. It is read here on the server only to
 * hand it to the client component; validity is checked against the API, because
 * a link can be spent or expired and the person deserves to know that before
 * they type a password twice.
 */
import { SetPasswordForm } from './set-password-form'

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm tracking-tight">
            PeoplePay<span className="text-primary">360</span>
          </p>
          <h1 className="text-2xl font-medium tracking-tight">Choose a password</h1>
        </div>

        <SetPasswordForm token={token ?? ''} />
      </div>
    </div>
  )
}
