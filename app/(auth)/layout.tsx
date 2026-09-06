/**
 * The shell every unauthenticated screen shares: sign in, forgot password,
 * set password.
 *
 * One centred column. A sign-in box has exactly one job and no second thing
 * worth putting beside it — an art panel next to four fields only pushes the
 * form off-centre and leaves a half-empty field of colour that has to be
 * justified. The brand shows up in the ground and the wordmark instead.
 *
 * The ground is `primary-100`, a soft plum wash. It does two things: it tells
 * you at a glance that you are not signed in yet — the application behind sits
 * on the cool `secondary-50` grey — and it gives the white card something to
 * stand on. At `primary-50` the card and the page were both near-white and the
 * card simply disappeared.
 *
 * Behind it all, `PayrollHorizon` — a drifting skyline of bars. It sits only on
 * the signed-out screens: ambient motion is a welcome, and nobody wants it
 * moving underneath a payslip they are trying to read.
 */
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { PayrollHorizon } from './_components/payroll-horizon'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-auth-ground px-6 py-16">
      <PayrollHorizon />

      {/* Reachable before signing in: somebody handed a laptop at a stand
          should not have to authenticate to turn the brightness down. */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Above the backdrop, and its own stacking context so the card's shadow
          lands on the bars rather than under them. */}
      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Left-aligned to the card below it, so the column has one edge. */}
        <Link href="/login" className="inline-block rounded-md text-xl font-medium">
          PeoplePay<span className="text-primary">360</span>
        </Link>

        <div className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  )
}
