/**
 * The narrow signed-out column: wordmark, then one white card.
 *
 * Used by the password screens. It used to live in the auth layout, which meant
 * every signed-out route was locked to the same 28rem card — fine for "enter
 * your email", wrong for sign-in, which now carries a brand panel and a grid of
 * demo accounts beside the form. The layout keeps the ground and the backdrop;
 * the shape of the sheet on top of it is each screen's own business.
 */
import Link from 'next/link'
import { BrandLockup } from './brand-lockup'

export function AuthColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 w-full max-w-md space-y-6">
      {/* Left-aligned to the card below it, so the column has one edge. */}
      <Link href="/login" className="inline-block rounded-md">
        <BrandLockup />
      </Link>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        {children}
      </div>
    </div>
  )
}
