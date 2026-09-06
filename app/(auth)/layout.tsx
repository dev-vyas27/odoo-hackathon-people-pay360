/**
 * The shell every unauthenticated screen shares: sign in, forgot password,
 * set password.
 *
 * It owns the GROUND and nothing else — the wash, the backdrop, the theme
 * toggle, and centring whatever the route puts on top. It deliberately does not
 * own the card any more: sign-in is a wide two-panel sheet and the password
 * screens are a 28rem column, and a layout that imposed one width on both was
 * what kept sign-in cramped. `AuthColumn` is the narrow shape, opted into.
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
 *
 * The padding is deliberately modest (`py-8`, not `py-16`). Sign-in is designed
 * to land inside one viewport on a laptop; generous page padding was buying
 * whitespace nobody sees at the price of a scrollbar everybody does. The extra
 * top padding below `sm` is for the theme toggle: on a phone the card runs
 * nearly edge to edge and the toggle would otherwise sit on its corner.
 */
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { PayrollHorizon } from './_components/payroll-horizon'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-auth-ground px-4 pt-16 pb-8 sm:px-6 sm:py-8">
      <PayrollHorizon />

      {/* Reachable before signing in: somebody handed a laptop at a stand
          should not have to authenticate to turn the brightness down. */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {children}
    </div>
  )
}
