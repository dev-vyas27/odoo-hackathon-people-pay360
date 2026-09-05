'use client'

/**
 * Holds the login form and the optional demo panel together, because picking a
 * demo account has to fill the form above it.
 *
 * `demoEnabled` is decided on the SERVER and passed down as a plain prop. This
 * component never reads the environment, so there is no client-side flag to
 * flip — and with the flag off the endpoint 404s regardless.
 *
 * The `key` on LoginForm is doing real work: react-hook-form reads
 * `defaultValues` once, at mount. Remounting on a new prefill is what makes the
 * fields actually change when you click an account, and it is cheaper and less
 * error-prone than reaching in with `form.reset()` from outside.
 */
import { useState } from 'react'
import { LoginForm } from './login-form'
import { DemoSeedPanel } from './demo-seed-panel'

export function LoginScreen({ next, demoEnabled }: { next?: string; demoEnabled: boolean }) {
  const [prefill, setPrefill] = useState<{ email: string; password: string } | undefined>()

  return (
    <div className="space-y-6">
      <LoginForm key={prefill?.email ?? 'empty'} next={next} prefill={prefill} />
      {demoEnabled ? <DemoSeedPanel onPick={setPrefill} /> : null}
    </div>
  )
}
