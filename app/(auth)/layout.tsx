


import { ThemeToggle } from '@/components/theme/theme-toggle'
import { PayrollHorizon } from './_components/payroll-horizon'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-auth-ground px-4 pt-16 pb-8 sm:px-6 sm:py-8">
      <PayrollHorizon />

      {
}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {children}
    </div>
  )
}
