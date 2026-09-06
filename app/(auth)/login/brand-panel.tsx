


import { LuUsers, LuCalendarClock, LuWallet } from 'react-icons/lu'
import type { SeedCredential } from '@/scripts/seed/types'
import { BrandLockup } from '../_components/brand-lockup'
import { DemoAccountsPanel } from './demo-accounts-panel'



const CAPABILITIES = [
  { icon: LuUsers, label: 'People & contracts' },
  { icon: LuCalendarClock, label: 'Attendance & time off' },
  { icon: LuWallet, label: 'Payroll runs' },
]

export function BrandPanel({
  accounts,
  onPick,
  activeEmail,
}: {
  accounts: SeedCredential[]
  onPick: (credential: { email: string; password: string }) => void
  activeEmail?: string
}) {
  return (
    <div className="relative order-2 flex flex-col justify-center gap-6 overflow-hidden bg-linear-to-br from-primary-700 via-primary-800 to-primary-950 p-6 sm:p-7 md:order-1">
      {

}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full border-[28px] border-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-28 size-72 rounded-full border-[36px] border-white/5"
      />

      {

}
      <div className="relative hidden space-y-4 md:block">
        <BrandLockup size={40} inverted />

        <div className="space-y-2">
          <h2 className="text-lg text-white">HR and payroll, on one record.</h2>
          <p className="text-sm text-primary-200">
            Hire, track and pay the same person without exporting a spreadsheet in between.
          </p>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-primary-100 ring-1 ring-white/15"
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <DemoAccountsPanel accounts={accounts} onPick={onPick} activeEmail={activeEmail} />
    </div>
  )
}
