/**
 * The plum half of the sign-in sheet: what the product is, and the accounts you
 * can walk in with.
 *
 * ── Why the demo accounts live HERE ────────────────────────────────────────
 *
 * They started under the form, which is where "pick one to fill the form
 * above" would suggest. Two problems with that, and the second is fatal:
 *
 *   1. The right column carried everything — heading, two fields, button, five
 *      accounts — while the left carried a logo and three sentences. The sheet
 *      was lopsided.
 *   2. It was 664px tall. That fits a 900px viewport and does NOT fit a laptop
 *      at 150% Windows scaling, where a maximised browser leaves about 610
 *      CSS pixels. Those machines got a scrollbar on a sign-in screen.
 *
 * Splitting the content across both columns is what actually fixes the height,
 * rather than shaving type sizes until it just barely fits: the card is now as
 * tall as its TALLER column instead of the sum of both stacks.
 *
 * The panel keeps its order in the DOM under `md` — the form comes first on a
 * phone, the accounts follow it — so the list is never between somebody and the
 * fields they came to fill in.
 */
import { LuUsers, LuCalendarClock, LuWallet } from 'react-icons/lu'
import type { SeedCredential } from '@/scripts/seed/types'
import { BrandLockup } from '../_components/brand-lockup'
import { DemoAccountsPanel } from './demo-accounts-panel'

/**
 * What the app does, in three chips rather than three paragraphs.
 *
 * The paragraphs read well and cost 150px of height that the accounts below
 * them need more. A chip still names the module; nobody signs in because the
 * second sentence about attendance was persuasive.
 */
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
      {/*
        Two enormous soft rings, bled off the corners. They echo the 360 ring in
        the mark rather than being generic blobs, and at 5% white they read as a
        sheen on the plum — enough to keep a flat fill from looking like a
        rectangle of paint, not enough to compete with the text on top.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full border-[28px] border-white/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-28 size-72 rounded-full border-[36px] border-white/5"
      />

      {/* The mark and the pitch belong to the wide layout. Below `md` this
          panel sits UNDER the form and the right column has already said who
          we are — repeating it here would be a second logo on one screen. */}
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
