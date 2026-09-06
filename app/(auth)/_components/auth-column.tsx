


import Link from 'next/link'
import { BrandLockup } from './brand-lockup'

export function AuthColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-md space-y-6">
      {}
      <Link href="/login" className="inline-block rounded-md">
        <BrandLockup />
      </Link>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        {children}
      </div>
    </div>
  )
}
