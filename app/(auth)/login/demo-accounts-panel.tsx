'use client'

/**
 * The demo accounts, on the plum panel of the sign-in sheet.
 *
 * This replaced a "Load demo data" button. That button seeded the database and
 * only THEN showed the credentials, which meant the first thing an evaluator
 * did was wait — and the second was wonder whether they had broken something.
 * The data is seeded by `npm run seed`; by the time anyone opens this page it
 * is already there, so the accounts can simply be listed.
 *
 * Tap an account to fill the form beside it, then Sign in. Two taps, no typing,
 * and the password is never guessed at from a screenshot.
 *
 * ── Two up, not five down ─────────────────────────────────────────────────
 *
 * Five full-width rows was 320px of list. As a 2-column grid the same five
 * accounts are three rows and half the height, and the odd one out spans the
 * full width rather than leaving a hole — a ragged last row reads as a
 * rendering bug. The height mattered: see brand-panel.tsx.
 *
 * Each tile is name over role, not name over email. The role is what you choose
 * ON; the email is what you are choosing, and it lands in the field beside it
 * the moment you pick, where it is bigger and selectable. It stays on the
 * tile's `title` for anyone who wants it before committing.
 *
 * ── Set on plum ───────────────────────────────────────────────────────────
 *
 * Tiles are white at 10% rather than `bg-card`: on this panel a white tile
 * would be a hole punched in the brand colour, and five of them would be the
 * loudest thing on the page. The tint keeps them legible and lets the chosen
 * one step forward simply by getting brighter.
 *
 * Deliberately NOT a one-tap sign-in. Filling the form leaves the chosen
 * account visible in the fields, so whoever is presenting can say which role
 * they are about to demonstrate before they demonstrate it — and can correct a
 * mis-tap without being dropped into the wrong dashboard.
 *
 * Rendered only when `DEMO_SEED_ENABLED` is set, decided on the server. These
 * are plaintext passwords on a public page; the flag is the only thing that
 * makes that acceptable, and it is checked where it cannot be flipped from a
 * client bundle.
 */
import { LuCheck } from 'react-icons/lu'
import type { SeedCredential } from '@/scripts/seed/types'
import { cn } from '@/lib/utils'

/** "Aarav Menon" → "AM". Two letters at most; one for a mononym. */
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function DemoAccountsPanel({
  accounts,
  onPick,
  activeEmail,
}: {
  accounts: SeedCredential[]
  /** Fills the sign-in form. See login-screen.tsx for how it is applied. */
  onPick: (credential: { email: string; password: string }) => void
  /** The account currently filled in, so the list shows where you are. */
  activeEmail?: string
}) {
  if (accounts.length === 0) return null

  // A trailing odd tile spans both columns. With five accounts that is the
  // employee — the one an evaluator is most likely to want anyway.
  const oddLast = accounts.length % 2 === 1

  return (
    <section className="relative space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="eyebrow text-primary-200">Demo accounts</h2>
        <p className="text-xs text-primary-300">Pick one to fill the form</p>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {accounts.map((account, index) => {
          const active = activeEmail === account.email
          return (
            <li
              key={account.email}
              className={cn(oddLast && index === accounts.length - 1 && 'sm:col-span-2')}
            >
              <button
                type="button"
                onClick={() => onPick({ email: account.email, password: account.password })}
                aria-current={active ? 'true' : undefined}
                title={account.email}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none',
                  active
                    ? 'border-white/45 bg-white/20'
                    : 'border-white/15 bg-white/10 hover:border-white/30 hover:bg-white/15',
                )}
              >
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-medium',
                    active ? 'bg-white text-primary-800' : 'bg-white/15 text-primary-100',
                  )}
                  aria-hidden
                >
                  {/* The tick replaces the initials rather than sitting at the
                      end of the row: a trailing glyph would steal 20px from the
                      name and role the moment you picked, and "HR Payroll
                      Manager" would truncate as you clicked it. */}
                  {active ? <LuCheck className="size-3.5" /> : initials(account.name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm leading-tight text-white">
                    {account.name}
                  </span>
                  <span className="block truncate text-xs text-primary-200">{account.role}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
