/**
 * The payroll section shell.
 *
 * Sits INSIDE the dashboard layout (top nav, current user) rather than
 * replacing it: this file owns only the payroll sub-navigation, so when the
 * dashboard chrome lands these screens pick it up with no change here.
 */
import { PayrollTabs } from './_components/payroll-tabs'

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PayrollTabs />
      {children}
    </div>
  )
}
