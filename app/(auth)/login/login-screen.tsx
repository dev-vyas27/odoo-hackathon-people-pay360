'use client'

/**
 * Holds the login form and the demo account list together, because picking an
 * account has to fill the form above it.
 *
 * The accounts are decided on the SERVER and passed down as a plain prop — this
 * component never reads the environment, so there is no client-side flag to
 * flip, and with the flag off the list arrives empty rather than hidden.
 *
 * The `key` on LoginForm is doing real work: react-hook-form reads
 * `defaultValues` once, at mount. Remounting on a new prefill is what makes the
 * fields actually change when you pick an account, and it is cheaper and less
 * error-prone than reaching in with `form.reset()` from outside.
 */
import { useState } from 'react'
import type { SeedCredential } from '@/scripts/seed/types'
import { LoginForm } from './login-form'
import { DemoAccountsPanel } from './demo-accounts-panel'

export function LoginScreen({
  next,
  accounts,
}: {
  next?: string
  /** Empty unless DEMO_SEED_ENABLED is set. See login/page.tsx. */
  accounts: SeedCredential[]
}) {
  const [prefill, setPrefill] = useState<{ email: string; password: string } | undefined>()

  return (
    <div className="space-y-6">
      <LoginForm key={prefill?.email ?? 'empty'} next={next} prefill={prefill} />
      <DemoAccountsPanel accounts={accounts} onPick={setPrefill} activeEmail={prefill?.email} />
    </div>
  )
}
