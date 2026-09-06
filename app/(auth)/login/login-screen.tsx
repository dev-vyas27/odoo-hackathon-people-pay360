'use client'



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
  
  accounts: SeedCredential[]
}) {
  const [prefill, setPrefill] = useState<{ email: string; password: string } | undefined>()

  return (
    <div className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-lg md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <BrandPanel accounts={accounts} onPick={setPrefill} activeEmail={prefill?.email} />

      <div className="order-1 flex flex-col justify-center gap-5 p-6 sm:p-8 md:order-2">
        {

}
        <BrandLockup className="md:hidden" />

        <div className="space-y-1.5">
          <h1 className="text-lg font-medium">Sign in</h1>
          {

}
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
