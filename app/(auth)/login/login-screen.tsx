'use client'

/**
 * The sign-in sheet: the plum panel and the form, and the one piece of state
 * they share.
 *
 * It has to be one client component because picking an account on the panel
 * fills the fields in the other column — that is a single `prefill`, held here
 * and read by both.
 *
 * The accounts are decided on the SERVER and passed down as a plain prop — this
 * component never reads the environment, so there is no client-side flag to
 * flip, and with the flag off the list arrives empty rather than hidden.
 *
 * The `key` on LoginForm is doing real work: react-hook-form reads
 * `defaultValues` once, at mount. Remounting on a new prefill is what makes the
 * fields actually change when you pick an account, and it is cheaper and less
 * error-prone than reaching in with `form.reset()` from outside.
 *
 * ── The grid ──────────────────────────────────────────────────────────────
 *
 * Two columns from `md`, one below it, and the panel is ordered SECOND on a
 * phone so the form is the first thing under the mark. `items-stretch` is what
 * makes the plum run the full height of the sheet rather than stopping where
 * its own content does.
 */
import { useState } from 'react'
import type { SeedCredential } from '@/scripts/seed/types'
import { BrandLockup } from '../_components/brand-lockup'
import { LoginForm } from './login-form'
import { BrandPanel } from './brand-panel'

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
    <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-lg md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BrandPanel accounts={accounts} onPick={setPrefill} activeEmail={prefill?.email} />

      <div className="order-1 flex flex-col justify-center gap-5 p-6 sm:p-8 md:order-2">
        {/* The panel carries the mark from `md` up, where it is hidden below
            that — so the mark has to appear here or the phone layout opens on
            an unbranded pair of fields. */}
        <BrandLockup className="md:hidden" />

        <div className="space-y-1.5">
          <h1 className="text-lg font-medium">Sign in</h1>
          {/* The second half of that sentence is only true when the demo
              flag is on. With it off the panel is empty and the copy must not
              point at a list that is not there. */}
          <p className="text-sm text-muted-foreground">
            {accounts.length > 0
              ? 'Use your work email, or pick a demo account.'
              : 'Sign in with your work email.'}
          </p>
        </div>

        <LoginForm key={prefill?.email ?? 'empty'} next={next} prefill={prefill} />
      </div>
    </div>
  )
}
